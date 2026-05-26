// bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY (박경수님 2026-05-26)
// 강사 포털 PIN 검증 Edge Function.
// SERVICE_ROLE KEY 로 staff_pool 조회 (RLS 우회). 성공 시 staff_portal_token 반환.

// @ts-expect-error — Deno 런타임 전용 (Edge Function)
import { serve } from 'https://deno.land/std@0.168.0/http/server.ts';
// @ts-expect-error — esm.sh URL import
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

declare const Deno: { env: { get: (key: string) => string | undefined } };

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface StaffRow {
  id: string;
  name: string;
  portal_pin: string | null;
  staff_portal_token: string | null;
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: corsHeaders });
  }

  try {
    const { name, pin } = await req.json() as { name?: string; pin?: string };

    if (!name?.trim() || !pin?.trim()) {
      return json({ error: '이름과 PIN을 모두 입력해 주세요.' }, 400);
    }
    if (!/^\d{6}$/.test(pin)) {
      return json({ error: 'PIN은 6자리 숫자여야 해요.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 이름 (대소문자 무시·공백 정규화) 으로 후보 조회 — soft delete 제외
    const trimmedName = name.trim();
    const { data: staffList, error } = await supabase
      .from('staff_pool')
      .select('id, name, portal_pin, staff_portal_token')
      .ilike('name', trimmedName)
      .is('deleted_at', null);

    if (error) {
      console.error('[verify-staff-pin] DB 오류:', error);
      return json({ error: '서버 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' }, 500);
    }

    const candidates = (staffList ?? []) as StaffRow[];
    const matched = candidates.find((s) => s.portal_pin === pin);

    if (!matched) {
      // 이름 매칭 자체가 없거나 PIN 불일치 — 공통 메시지로 (계정 존재 노출 방지)
      return json({ error: '이름 또는 PIN이 올바르지 않아요.' }, 401);
    }

    // staff_portal_token 누락 시 발급
    let token = matched.staff_portal_token;
    if (!token) {
      const newToken = crypto.randomUUID();
      const { error: upErr } = await supabase
        .from('staff_pool')
        .update({ staff_portal_token: newToken })
        .eq('id', matched.id);
      if (upErr) {
        console.error('[verify-staff-pin] 토큰 발급 실패:', upErr);
        return json({ error: '서버 오류 — 담당 PM 에게 문의해 주세요.' }, 500);
      }
      token = newToken;
    }

    return json({ portal_token: token, staff_name: matched.name }, 200);
  } catch (err) {
    console.error('[verify-staff-pin] 예외:', err);
    return json({ error: '서버 오류가 발생했어요.' }, 500);
  }
});

function json(body: unknown, status: number): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...corsHeaders, 'Content-Type': 'application/json' },
  });
}
