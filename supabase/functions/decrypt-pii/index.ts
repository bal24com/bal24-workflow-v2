// 박경수님 + SkyClaw STEP-RBAC-RLS-PHASE1 (2026-05-28)
// 주민번호 복호화 Edge Function — rpc_decrypt_resident 호출 wrapper
// admin/finance 또는 본인만 호출 가능. SQL 함수가 권한 검사 + 복호화를 모두 수행.
//
// 호출 예시 (클라이언트):
//   const { data, error } = await supabase.functions.invoke('decrypt-pii', {
//     body: { employeeId: 'uuid-...' }
//   });
//
// 환경변수:
//   SUPABASE_URL          (자동 주입)
//   SUPABASE_ANON_KEY     (자동 주입)
//   ENCRYPT_KEY           (Vault 또는 GUC 에 등록되어 SQL 함수에서 사용. Edge Function 직접 사용 X)

import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import { createClient } from 'https://esm.sh/@supabase/supabase-js@2';

const SUPABASE_URL = Deno.env.get('SUPABASE_URL') ?? '';
const SUPABASE_ANON_KEY = Deno.env.get('SUPABASE_ANON_KEY') ?? '';

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

interface RequestBody {
  employeeId: string;
}

function jsonResponse(body: unknown, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ error: 'POST 메서드만 허용돼요.' }, 405);
  }

  // 사용자 JWT 필수 — RLS + rpc 권한 검사용
  const authHeader = req.headers.get('Authorization') ?? '';
  if (!authHeader || !authHeader.startsWith('Bearer ')) {
    return jsonResponse({ error: '로그인이 필요해요.' }, 401);
  }

  let body: RequestBody;
  try {
    body = await req.json() as RequestBody;
  } catch (_err) {
    return jsonResponse({ error: '요청 본문이 올바르지 않아요.' }, 400);
  }

  if (!body?.employeeId || typeof body.employeeId !== 'string') {
    return jsonResponse({ error: 'employeeId 가 필요해요.' }, 400);
  }

  // 사용자 JWT 로 클라이언트 생성 — auth.uid() 가 RLS 안에서 정상 동작
  const supabase = createClient(SUPABASE_URL, SUPABASE_ANON_KEY, {
    global: { headers: { Authorization: authHeader } },
    auth: { persistSession: false, autoRefreshToken: false },
  });

  const { data, error } = await supabase.rpc('rpc_decrypt_resident', {
    p_employee_id: body.employeeId,
  });

  if (error) {
    // 42501 = insufficient_privilege (rpc 안에서 RAISE EXCEPTION)
    const status = error.code === '42501' ? 403 : 500;
    console.error('[decrypt-pii] rpc 오류:', error.code, error.message);
    return jsonResponse({ error: error.message ?? '복호화에 실패했어요.' }, status);
  }

  return jsonResponse({ residentNumber: data ?? null });
});
