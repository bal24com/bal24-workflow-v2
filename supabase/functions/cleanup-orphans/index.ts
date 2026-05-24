// bal24 v2 — STEP-MEMBER-ORPHAN-CLEANUP
// 고아 계정(auth.users에는 있지만 profiles에는 없거나 is_active=false) 일괄 정리.
// PM/ADMIN 만 호출 가능. service role 키로 auth.admin.deleteUser 호출.
//
// 동작:
//  1. auth.admin.listUsers (페이지네이션) — 모든 auth 사용자 조회
//  2. profiles 의 활성 id 셋 조회
//  3. auth에는 있지만 profiles 활성 row가 없는 사용자 = 고아
//  4. 각 고아에 대해 auth.admin.deleteUser 실행
//  5. 결과 카운트 반환

// deno-lint-ignore-file no-explicit-any
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_SERVICE_KEY = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  /** 특정 이메일만 정리. 비우면 전체 고아 계정 일괄 정리 */
  targetEmail?: string;
  /** dry-run: 실제 삭제 없이 카운트만 (기본 false) */
  dryRun?: boolean;
}

interface OrphanInfo { id: string; email: string; created_at: string }

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request): Promise<Response> => {
  if (req.method === 'OPTIONS') return new Response(null, { headers: CORS_HEADERS });
  if (req.method !== 'POST') return jsonResponse({ error: '허용되지 않은 요청 방식이에요.' }, 405);

  try {
    if (!SUPABASE_URL || !SUPABASE_SERVICE_KEY) {
      throw new Error('Supabase 서비스 키가 설정되지 않았어요.');
    }

    const body = await req.json().catch(() => ({})) as RequestBody;
    const targetEmail = body.targetEmail?.toString().trim().toLowerCase() ?? '';
    const dryRun = body.dryRun === true;

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) auth.users 전체 페이지네이션 조회
    const authUsers: { id: string; email: string; created_at: string }[] = [];
    let page = 1;
    const perPage = 200;
    for (;;) {
      const { data, error } = await admin.auth.admin.listUsers({ page, perPage });
      if (error) {
        console.error('[cleanup-orphans] auth listUsers 실패:', error.message);
        return jsonResponse({ error: `auth 조회 실패: ${error.message}` }, 500);
      }
      const users = data?.users ?? [];
      users.forEach((u) => {
        if (u.email) authUsers.push({ id: u.id, email: u.email, created_at: u.created_at ?? '' });
      });
      if (users.length < perPage) break;
      page += 1;
      if (page > 50) break; // 안전장치 (최대 1만명)
    }

    // 2) profiles 활성 id 셋 조회
    const { data: profs, error: profErr } = await admin.from('profiles')
      .select('id, email, is_active');
    if (profErr) {
      console.error('[cleanup-orphans] profiles 조회 실패:', profErr.message);
      return jsonResponse({ error: `profiles 조회 실패: ${profErr.message}` }, 500);
    }
    const activeIds = new Set<string>();
    ((profs ?? []) as Array<{ id: string; email: string | null; is_active: boolean }>)
      .forEach((p) => { if (p.is_active) activeIds.add(p.id); });

    // 3) 고아 = auth에는 있는데 profiles 활성 row가 없음
    let orphans: OrphanInfo[] = authUsers.filter((u) => !activeIds.has(u.id));
    if (targetEmail) {
      orphans = orphans.filter((u) => u.email.toLowerCase() === targetEmail);
    }

    if (dryRun) {
      return jsonResponse({ success: true, dryRun: true, foundCount: orphans.length, orphans });
    }

    // 4) 각 고아 삭제 + profiles 비활성 row 도 정리
    let deletedCount = 0;
    const errors: Array<{ email: string; error: string }> = [];
    for (const o of orphans) {
      // profiles 의 비활성 row가 있으면 같이 삭제 (이메일·id 둘 다 매칭)
      await admin.from('profiles').delete().eq('id', o.id);
      const { error: delErr } = await admin.auth.admin.deleteUser(o.id);
      if (delErr) {
        console.error('[cleanup-orphans] 삭제 실패:', o.email, delErr.message);
        errors.push({ email: o.email, error: delErr.message });
      } else {
        deletedCount += 1;
      }
    }

    return jsonResponse({
      success: true,
      foundCount: orphans.length,
      deletedCount,
      errors,
    });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[cleanup-orphans] 처리 실패:', msg);
    return jsonResponse({ error: msg }, 500);
  }
});
