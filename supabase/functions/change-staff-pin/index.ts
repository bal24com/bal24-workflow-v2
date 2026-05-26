// bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY · 보안 강화 (박경수님 2026-05-26)
// 강사 본인 PIN 변경 Edge Function — portal_token + 현재 PIN(bcrypt 검증) + 새 PIN(set_staff_pin RPC).

// @ts-expect-error — Deno 런타임 전용
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error — esm.sh URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: { env: { get: (key: string) => string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') return new Response('ok', { headers: corsHeaders });

  try {
    const { portal_token, current_pin, new_pin } = await req.json() as {
      portal_token?: string; current_pin?: string; new_pin?: string;
    };

    if (!portal_token || !current_pin || !new_pin) {
      return json({ error: '모든 항목을 입력해 주세요.' }, 400);
    }
    if (!/^\d{4,6}$/.test(new_pin)) {
      return json({ error: '새 PIN 은 4~6자리 숫자여야 해요.' }, 400);
    }
    if (current_pin === new_pin) {
      return json({ error: '현재 PIN 과 다른 번호를 입력해 주세요.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 1) 토큰으로 staff 식별
    const { data: staff, error } = await supabase
      .from('staff_pool')
      .select('id')
      .eq('staff_portal_token', portal_token)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !staff) {
      console.error('[change-staff-pin] 토큰 조회 실패:', error);
      return json({ error: '인증 정보가 올바르지 않아요.' }, 401);
    }
    const staffId = (staff as { id: string }).id;

    // 2) 현재 PIN 검증 — verify_staff_pin RPC (bcrypt + rate limit 자동)
    const { data: vResult, error: vErr } = await supabase.rpc('verify_staff_pin', {
      p_staff_id: staffId, p_pin: current_pin,
    });
    if (vErr) {
      console.error('[change-staff-pin] verify RPC 오류:', vErr);
      return json({ error: '서버 오류가 발생했어요.' }, 500);
    }
    const v = (vResult ?? {}) as { ok?: boolean; reason?: string; seconds_left?: number };
    if (!v.ok) {
      if (v.reason === 'locked') {
        return json({ error: `5회 오류로 잠겼어요. ${v.seconds_left ?? 300}초 후 다시 시도해 주세요.` }, 401);
      }
      return json({ error: '현재 PIN 이 올바르지 않아요.' }, 401);
    }

    // 3) 새 PIN 저장 — set_staff_pin RPC (bcrypt 해시 + fail/lock reset)
    const { error: setErr } = await supabase.rpc('set_staff_pin', {
      p_staff_id: staffId, p_pin: new_pin,
    });
    if (setErr) {
      console.error('[change-staff-pin] set RPC 오류:', setErr);
      return json({ error: 'PIN 변경 중 오류가 발생했어요.' }, 500);
    }

    return json({ success: true }, 200);
  } catch (err) {
    console.error('[change-staff-pin] 예외:', err);
    return json({ error: '서버 오류가 발생했어요.' }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
