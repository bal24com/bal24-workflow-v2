// bal24 v2 — STEP-MEMBER-DIRECT-REGISTER
// 팀원 직접 등록 Edge Function (이메일 초대 없이 admin.createUser + profiles 동시 생성).
// 호출: POST /functions/v1/create-member
//   body: { email, password, name, role, department, position, phone, joined_at, slogan, avatar_url }
//
// 환경변수 (Supabase Dashboard > Edge Functions > Secrets — 자동 주입):
//   - SUPABASE_URL
//   - SUPABASE_SERVICE_ROLE_KEY
//
// verify_jwt: true → 로그인된 ADMIN/PM만 호출 가능 (config.toml 참고)

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

const ALLOWED_ROLES = new Set(['admin', 'pm', 'staff', 'finance', 'partner']);

interface RequestBody {
  email?: string;
  password?: string;
  name?: string;
  role?: string;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  joined_at?: string | null;
  slogan?: string | null;
  avatar_url?: string | null;
}

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

    const body = await req.json().catch(() => ({} as RequestBody)) as RequestBody;
    const email = (body.email ?? '').trim();
    const password = (body.password ?? '').trim();
    const name = (body.name ?? '').trim();
    const role = (body.role ?? 'staff').toLowerCase();

    // 유효성 검증
    if (!email) return jsonResponse({ error: '이메일을 입력해 주세요.' }, 400);
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(email)) {
      return jsonResponse({ error: '이메일 형식이 올바르지 않아요.' }, 400);
    }
    if (!password || password.length < 4) {
      return jsonResponse({ error: '초기 비밀번호가 너무 짧아요 (최소 4자).' }, 400);
    }
    if (!name) return jsonResponse({ error: '이름을 입력해 주세요.' }, 400);
    if (!ALLOWED_ROLES.has(role)) {
      return jsonResponse({ error: `허용되지 않은 역할이에요: ${role}` }, 400);
    }

    const admin = createClient(SUPABASE_URL, SUPABASE_SERVICE_KEY, {
      auth: { autoRefreshToken: false, persistSession: false },
    });

    // 1) Supabase Auth 계정 생성 (이메일 확인 자동 완료)
    const { data: authData, error: authError } = await admin.auth.admin.createUser({
      email,
      password,
      email_confirm: true,
      user_metadata: { name },
    });
    if (authError || !authData?.user) {
      const m = (authError?.message ?? '').toLowerCase();
      if (m.includes('already') || m.includes('exists') || m.includes('duplicate')) {
        return jsonResponse({ error: '이미 등록된 이메일이에요.' }, 409);
      }
      console.error('[create-member] Auth 생성 실패:', authError?.message);
      return jsonResponse({ error: authError?.message ?? '계정 생성에 실패했어요.' }, 400);
    }

    const userId = authData.user.id;

    // 2) profiles 테이블 upsert (auth 트리거가 기본 row 생성하는 경우 대응)
    const { error: profileError } = await admin
      .from('profiles')
      .upsert({
        id: userId,
        email,
        name,
        role,
        department: body.department?.toString().trim() || null,
        position: body.position?.toString().trim() || null,
        phone: body.phone?.toString().trim() || null,
        joined_at: body.joined_at || null,
        slogan: body.slogan?.toString().trim() || null,
        avatar_url: body.avatar_url || null,
        is_active: true,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'id' });

    if (profileError) {
      // profiles 저장 실패 시 auth user 롤백 (고아 계정 방지)
      console.error('[create-member] profiles 저장 실패 — Auth 계정 롤백 시도:', profileError.message);
      await admin.auth.admin.deleteUser(userId).catch((e) => {
        console.error('[create-member] Auth 롤백 실패:', e?.message);
      });
      return jsonResponse({ error: '팀원 정보 저장에 실패했어요. 잠시 후 다시 시도해 주세요.' }, 500);
    }

    return jsonResponse({ success: true, userId, email });
  } catch (err) {
    const msg = err instanceof Error ? err.message : '알 수 없는 오류';
    console.error('[create-member] 처리 실패:', msg);
    return jsonResponse({ error: msg }, 500);
  }
});
