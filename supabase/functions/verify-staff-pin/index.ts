// bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY · 보안 강화 (박경수님 2026-05-26)
// portal_pin_hash (bcrypt) 비교 + 서버 측 rate limit (5회 실패 → 5분 잠금).
// SERVICE_ROLE 로 staff_pool 직접 조회 + verify_staff_pin RPC 호출.

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
    const { name, pin } = await req.json() as { name?: string; pin?: string };

    if (!name?.trim() || !pin?.trim()) {
      return json({ error: '이름과 PIN을 모두 입력해 주세요.' }, 400);
    }
    if (!/^\d{4,6}$/.test(pin)) {
      return json({ error: 'PIN은 4~6자리 숫자여야 해요.' }, 400);
    }

    const supabase = createClient(
      Deno.env.get('SUPABASE_URL') ?? '',
      Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '',
    );

    // 1) 이름으로 후보 staff_pool 조회 (SERVICE_ROLE 로 portal_pin_hash·lock 컬럼 직접 SELECT)
    const trimmedName = name.trim();
    const { data: staffList, error } = await supabase
      .from('staff_pool')
      .select('id, name, portal_pin_hash, pin_fail_count, pin_locked_until, staff_portal_token')
      .ilike('name', trimmedName)
      .is('deleted_at', null);

    if (error) {
      console.error('[verify-staff-pin] DB 오류:', error);
      return json({ error: '서버 오류가 발생했어요.' }, 500);
    }

    type StaffRow = {
      id: string; name: string; portal_pin_hash: string | null;
      pin_fail_count: number | null; pin_locked_until: string | null;
      staff_portal_token: string | null;
    };
    const candidates = (staffList ?? []) as StaffRow[];
    if (candidates.length === 0) {
      // 이름 매칭 자체 실패. 공통 메시지로 계정 존재 노출 차단.
      return json({ error: '이름 또는 PIN이 올바르지 않아요.' }, 401);
    }

    // 2) 각 후보에 대해 RPC verify_staff_pin 호출 (서버 측 bcrypt 비교 + rate limit)
    //    잠금 상태 강사가 먼저 매칭되면 잠금 메시지 우선.
    for (const c of candidates) {
      // 잠금 상태 즉시 확인 (RPC 안 호출하고도 응답 가능)
      if (c.pin_locked_until && new Date(c.pin_locked_until) > new Date()) {
        const secs = Math.ceil((new Date(c.pin_locked_until).getTime() - Date.now()) / 1000);
        return json({ error: `PIN 5회 오류로 잠겼어요. ${secs}초 후 다시 시도해 주세요.`, locked: true, seconds_left: secs }, 401);
      }
      // RPC verify_staff_pin — { ok, reason?: 'no_pin'|'mismatch'|'locked', seconds_left?, remaining? }
      const { data: result, error: rpcErr } = await supabase.rpc('verify_staff_pin', {
        p_staff_id: c.id, p_pin: pin,
      });
      if (rpcErr) {
        console.error('[verify-staff-pin] RPC 오류:', rpcErr);
        continue;
      }
      const r = (result ?? {}) as { ok?: boolean; reason?: string; seconds_left?: number; remaining?: number };
      if (r.ok) {
        // 매칭 성공. staff_portal_token 없으면 즉석 발급.
        let token = c.staff_portal_token;
        if (!token) {
          const newToken = crypto.randomUUID();
          await supabase.from('staff_pool').update({ staff_portal_token: newToken }).eq('id', c.id);
          token = newToken;
        }
        return json({ portal_token: token, staff_name: c.name }, 200);
      }
      if (r.reason === 'locked') {
        return json({
          error: `PIN 5회 오류로 잠겼어요. ${r.seconds_left ?? 300}초 후 다시 시도해 주세요.`,
          locked: true, seconds_left: r.seconds_left ?? 300,
        }, 401);
      }
      // mismatch / no_pin → 다음 후보 시도
    }

    // 모든 후보 mismatch
    return json({ error: '이름 또는 PIN이 올바르지 않아요.' }, 401);
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
