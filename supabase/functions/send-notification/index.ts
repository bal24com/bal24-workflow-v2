// bal24 v2 — STEP-EMAIL-NOTIFY Edge Function: 신청자 상태 변경 이메일 발송
// 환경변수 (Supabase Dashboard > Edge Functions > Secrets):
//   - RESEND_API_KEY (send-invite 와 공유)
//
// 호출:
//   POST /functions/v1/send-notification
//   body: NotifyRequest

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';

const RESEND_API_KEY = Deno.env.get('RESEND_API_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

type NotifyType = 'applied' | 'accepted' | 'rejected' | 'returned';

interface NotifyRequest {
  type: NotifyType;
  recipientEmail: string;
  recipientName: string;
  programTitle: string;
  projectTitle?: string;
  note?: string;
  rejectReason?: string;
}

interface Template { subject: string; body: string }

function buildTemplate(req: NotifyRequest): Template {
  const name = escapeHtml(req.recipientName);
  const program = escapeHtml(req.programTitle);
  switch (req.type) {
    case 'applied':
      return {
        subject: `[WorkFlow] 신청이 접수되었습니다 — ${req.programTitle}`,
        body: `<p>${name}님,</p>
<p><strong>${program}</strong> 신청이 정상적으로 접수되었어요.</p>
<p>결과는 검토 완료 후 이메일로 안내드릴게요.</p>`,
      };
    case 'accepted':
      return {
        subject: `[WorkFlow] 합격을 축하드립니다 — ${req.programTitle}`,
        body: `<p>${name}님,</p>
<p><strong>${program}</strong>에 최종 합격하셨어요. 축하드려요!</p>
<p>담당자가 곧 추가 안내를 드릴 예정이에요.</p>`,
      };
    case 'rejected': {
      const noteHtml = req.note?.trim()
        ? `<p style="color:#64748B;font-size:13px;">사유: ${escapeHtml(req.note.trim())}</p>` : '';
      return {
        subject: `[WorkFlow] 심사 결과 안내 — ${req.programTitle}`,
        body: `<p>${name}님,</p>
<p>아쉽게도 <strong>${program}</strong> 심사에서 선정되지 않으셨어요.</p>
${noteHtml}
<p>더 좋은 기회에 다시 뵙기를 바라겠습니다.</p>`,
      };
    }
    case 'returned': {
      const reasonHtml = req.rejectReason?.trim()
        ? `<p style="color:#64748B;font-size:13px;white-space:pre-wrap;">반려 사유: ${escapeHtml(req.rejectReason.trim())}</p>` : '';
      return {
        subject: `[WorkFlow] 보고서 반려 안내 — ${req.programTitle}`,
        body: `<p>${name}님,</p>
<p>제출하신 <strong>${program}</strong> 보고서가 반려되었어요.</p>
${reasonHtml}
<p>수정 후 다시 제출해 주세요.</p>`,
      };
    }
  }
}

function buildHtml(template: Template, projectTitle?: string): string {
  const projectLine = projectTitle?.trim()
    ? `<p style="color:#94A3B8;font-size:11px;margin-top:0;">프로젝트: ${escapeHtml(projectTitle.trim())}</p>` : '';
  return `<div style="font-family:'Pretendard',system-ui,sans-serif;max-width:560px;margin:0 auto;padding:32px;color:#1E1B4B;line-height:1.6;">
  <h2 style="color:#7C3AED;margin:0 0 8px;">🚀 BalanceDot WorkFlow</h2>
  ${projectLine}
  <div style="margin-top:16px;">${template.body}</div>
  <hr style="border:0;border-top:1px solid #EDE9FE;margin:24px 0;">
  <p style="color:#94A3B8;font-size:11px;">© 2026 (주)밸런스닷 · WorkFlow</p>
</div>`;
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ success: false, error: '허용되지 않은 요청 방식이에요.' }, 405);

  if (!RESEND_API_KEY) {
    return jsonResponse({ success: false, error: '이메일 서비스 설정이 필요해요.' }, 400);
  }

  let body: NotifyRequest;
  try { body = (await req.json()) as NotifyRequest; }
  catch { return jsonResponse({ success: false, error: '요청 본문을 읽을 수 없어요.' }, 400); }

  if (!body || !body.type || !body.recipientEmail || !body.programTitle) {
    return jsonResponse({ success: false, error: '필수 필드가 누락되었어요.' }, 400);
  }

  const template = buildTemplate(body);
  const html = buildHtml(template, body.projectTitle);

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${RESEND_API_KEY}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from: 'WorkFlow <no-reply@bal24.kr>',
        to: [body.recipientEmail],
        subject: template.subject,
        html,
      }),
    });
    if (!res.ok) {
      const text = await res.text().catch(() => '');
      console.error('[send-notification] Resend 발송 실패:', res.status, text);
      return jsonResponse({ success: false, error: '이메일 발송에 실패했어요.' }, 200);
    }
    return jsonResponse({ success: true }, 200);
  } catch (err) {
    const message = err instanceof Error ? err.message : '';
    console.error('[send-notification] 처리 중 오류:', message);
    return jsonResponse({ success: false, error: '이메일 발송 중 오류가 발생했어요.' }, 200);
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
    .replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;').replace(/'/g, '&#39;');
}
