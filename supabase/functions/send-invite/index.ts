// bal24 v2 — STEP-MEMBER-INVITE Edge Function: 팀원 초대 이메일 발송
// 환경변수 (Supabase Dashboard > Edge Functions > Secrets):
//   - RESEND_API_KEY
//   - SUPABASE_URL (자동 주입)
//   - SUPABASE_SERVICE_ROLE_KEY (자동 주입)
//   - APP_URL (예: https://bal24-workflow-v2.netlify.app)
//
// 호출:
//   POST /functions/v1/send-invite
//   body: { invitation_id: string }

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';
const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';
const APP_URL = Deno.env.get('APP_URL') ?? 'https://bal24-workflow-v2.netlify.app';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

const ROLE_LABELS: Record<string, string> = {
  admin: '관리자',
  pm: 'PM',
  staff: '직원',
  finance: '재무',
  partner: '파트너',
  member: '멤버',
};

interface InvitationRow {
  email: string;
  role: string;
  department: string | null;
  position: string | null;
  token: string;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: CORS_HEADERS });
  }

  if (req.method !== 'POST') {
    return jsonResponse({ error: '허용되지 않은 요청 방식이에요.' }, 405);
  }

  try {
    if (!RESEND_API_KEY) {
      throw new Error('RESEND_API_KEY 환경변수가 설정되지 않았어요.');
    }

    const body = await req.json().catch(() => ({} as Record<string, unknown>));
    const invitationId = (body as { invitation_id?: unknown }).invitation_id;
    if (typeof invitationId !== 'string' || !invitationId) {
      return jsonResponse({ error: 'invitation_id 가 필요해요.' }, 400);
    }

    const supabase = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY);
    const { data: inv, error: invError } = await supabase
      .from('member_invitations')
      .select('email, role, department, position, token')
      .eq('id', invitationId)
      .maybeSingle();

    if (invError) {
      console.error('[send-invite] 초대 조회 실패:', invError.message);
      return jsonResponse({ error: '초대 정보를 찾을 수 없어요.' }, 404);
    }
    if (!inv) {
      return jsonResponse({ error: '초대 정보를 찾을 수 없어요.' }, 404);
    }

    const invitation = inv as InvitationRow;
    const inviteUrl = `${APP_URL}/invite/member/${invitation.token}`;
    const roleLabel = ROLE_LABELS[invitation.role] ?? invitation.role;

    const html = `
      <div style="font-family: 'Pretendard', system-ui, sans-serif; max-width: 560px; margin: 0 auto; padding: 32px;">
        <h2 style="color: #7C3AED; margin: 0 0 16px;">🚀 BalanceDot WorkFlow 초대</h2>
        <p style="color: #1E1B4B; line-height: 1.6;">안녕하세요!</p>
        <p style="color: #1E1B4B; line-height: 1.6;">
          <strong>BalanceDot WorkFlow</strong> 의 팀원으로 초대되셨어요.
        </p>
        <table style="width: 100%; border-collapse: collapse; margin: 16px 0;">
          <tr><td style="padding: 6px 12px; color: #64748B; font-size: 13px;">역할</td>
              <td style="padding: 6px 12px; color: #1E1B4B; font-weight: 600;">${escapeHtml(roleLabel)}</td></tr>
          ${invitation.department ? `<tr><td style="padding: 6px 12px; color: #64748B; font-size: 13px;">부서</td><td style="padding: 6px 12px; color: #1E1B4B;">${escapeHtml(invitation.department)}</td></tr>` : ''}
          ${invitation.position ? `<tr><td style="padding: 6px 12px; color: #64748B; font-size: 13px;">직책</td><td style="padding: 6px 12px; color: #1E1B4B;">${escapeHtml(invitation.position)}</td></tr>` : ''}
        </table>
        <p style="color: #1E1B4B; line-height: 1.6;">아래 버튼을 눌러 가입을 완료해 주세요.</p>
        <div style="margin: 24px 0;">
          <a href="${inviteUrl}" style="display: inline-block; padding: 14px 32px; background: linear-gradient(135deg, #7C3AED 0%, #6D28D9 100%); color: white; border-radius: 12px; text-decoration: none; font-weight: 700; font-size: 15px;">
            초대 수락하기
          </a>
        </div>
        <p style="color: #94A3B8; font-size: 12px; line-height: 1.6; margin-top: 32px;">
          이 링크는 <strong>7일 후 만료</strong>돼요.<br>
          버튼이 안 눌리면 아래 주소를 복사해서 브라우저에 붙여넣어 주세요.<br>
          <span style="color: #64748B; word-break: break-all;">${inviteUrl}</span>
        </p>
        <hr style="border: 0; border-top: 1px solid #EDE9FE; margin: 24px 0;">
        <p style="color: #94A3B8; font-size: 11px;">© 2026 (주)밸런스닷 · WorkFlow</p>
      </div>
    `;

    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'WorkFlow <no-reply@bal24.kr>',
        to: [invitation.email],
        subject: 'BalanceDot WorkFlow 팀원 초대',
        html,
      }),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[send-invite] Resend 발송 실패:', res.status, text);
      return jsonResponse({ error: '이메일 발송에 실패했어요. 잠시 후 다시 시도해 주세요.' }, 502);
    }

    return jsonResponse({ success: true, invite_url: inviteUrl }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    console.error('[send-invite] 처리 중 오류:', message);
    return jsonResponse({ error: '초대 메일 발송 중 오류가 발생했어요.' }, 500);
  }
});

function jsonResponse(body: Record<string, unknown>, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

function escapeHtml(text: string): string {
  return text
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}
