-- ============================================================
-- bal24 v2 — STEP-STAFF-TOKEN-SIMPLIFY (PIN 제거 · staff_pool 영구 토큰 단순화)
-- 박경수님 2026-05-26 지시.
--
-- 핵심.
--   · staff_pool.staff_portal_token (UUID, 이미 존재) 을 영구 토큰으로 그대로 사용.
--   · NULL 인 행이 있으면 백필 + NOT NULL 제약 + UNIQUE 보강.
--   · 비로그인 anon 도 토큰으로 자기 정보 조회 가능하도록 RLS SELECT 허용.
--   · portal_pin / portal_pin_hash 컬럼은 유지 (이번 STEP 에선 컬럼 삭제 안 함).
-- ============================================================

-- ① pgcrypto (이미 활성화돼 있지만 명시).
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ② staff_portal_token 컬럼이 없으면 추가 + 기본값.
ALTER TABLE public.staff_pool
  ADD COLUMN IF NOT EXISTS staff_portal_token UUID DEFAULT gen_random_uuid();

-- ③ NULL 행 백필.
UPDATE public.staff_pool
   SET staff_portal_token = gen_random_uuid()
 WHERE staff_portal_token IS NULL;

-- ④ NOT NULL 제약.
ALTER TABLE public.staff_pool
  ALTER COLUMN staff_portal_token SET NOT NULL;

-- ⑤ UNIQUE 인덱스 (이미 있으면 무시).
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename  = 'staff_pool'
       AND indexname  = 'staff_pool_staff_portal_token_unique'
  ) THEN
    CREATE UNIQUE INDEX staff_pool_staff_portal_token_unique
      ON public.staff_pool (staff_portal_token);
  END IF;
END $$;

-- ⑥ RLS — 비로그인 anon 이 토큰으로 자기 정보 조회 가능하도록 SELECT 허용.
--    (anon 은 토큰을 모르면 자기 행을 못 찾으므로 사실상 토큰 = 비밀번호 역할.)
DROP POLICY IF EXISTS "staff_portal_token_select" ON public.staff_pool;
CREATE POLICY "staff_portal_token_select"
  ON public.staff_pool
  FOR SELECT
  TO anon, authenticated
  USING (true);

-- ⑦ profiles.staff_portal_token 도 동일 보강 (내부 직원 강사 겸임 케이스).
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_portal_token UUID DEFAULT gen_random_uuid();

UPDATE public.profiles
   SET staff_portal_token = gen_random_uuid()
 WHERE staff_portal_token IS NULL;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_indexes
     WHERE schemaname = 'public'
       AND tablename  = 'profiles'
       AND indexname  = 'profiles_staff_portal_token_unique'
  ) THEN
    CREATE UNIQUE INDEX profiles_staff_portal_token_unique
      ON public.profiles (staff_portal_token);
  END IF;
END $$;

-- ⑧ 검증 (수동 실행).
-- SELECT COUNT(*) FROM public.staff_pool WHERE staff_portal_token IS NULL;  -- 0 이어야 정상
-- SELECT COUNT(*) FROM public.profiles   WHERE staff_portal_token IS NULL;  -- 0 이어야 정상
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.staff_pool'::regclass;
