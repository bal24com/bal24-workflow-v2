// bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY (박경수님 2026-05-26)
// 강사 본인 PIN 변경 Edge Function.
// portal_token 으로 본인 확인 → 현재 PIN 검증 → 새 PIN 저장. SERVICE_ROLE.

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

interface ChangePayload {
  portal_token?: string;
  current_pin?: string;
  new_pin?: string;
}

interface StaffRow {
  id: string;
  portal_pin: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { portal_token, current_pin, new_pin } = await req.json() as ChangePayload;

    if (!portal_token || !current_pin || !new_pin) {
      return json({ error: '모든 항목을 입력해 주세요.' }, 400);
    }
    if (!/^\d{6}$/.test(new_pin)) {
      return json({ error: '새 PIN 은 6자리 숫자여야 해요.' }, 400);
    }
    if (current_pin === new_pin) {
      return json({ error: '현재 PIN 과 다른 번호를 입력해 주세요.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    const { data: staff, error } = await supabase
      .from('staff_pool')
      .select('id, portal_pin')
      .eq('staff_portal_token', portal_token)
      .is('deleted_at', null)
      .maybeSingle();

    if (error || !staff) {
      console.error('[change-staff-pin] 토큰 조회 실패:', error);
      return json({ error: '인증 정보가 올바르지 않아요.' }, 401);
    }

    const row = staff as StaffRow;
    if (row.portal_pin !== current_pin) {
      return json({ error: '현재 PIN 이 올바르지 않아요.' }, 401);
    }

    const { error: upErr } = await supabase
      .from('staff_pool')
      .update({ portal_pin: new_pin, updated_at: new Date().toISOString() })
      .eq('id', row.id);

    if (upErr) {
      console.error('[change-staff-pin] 업데이트 오류:', upErr);
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
