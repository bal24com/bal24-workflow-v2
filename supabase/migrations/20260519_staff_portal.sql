-- bal24 WorkFlow v2 — STEP-STAFF-PORTAL-P1
-- 강사 통합 포털 /staff-portal/:token 인프라
--  · staff_pool / profiles 에 영구 staff_portal_token 컬럼 추가
--  · staff_personal_events (강사 자체 일정, P4에서 UI 구현)
--  · RLS (anon 토큰 기반 접근 허용)
-- 박경수님이 Supabase SQL Editor 에서 직접 실행 후 사이트 적용.

-- 1) staff_pool 영구 포털 토큰
ALTER TABLE public.staff_pool
  ADD COLUMN IF NOT EXISTS staff_portal_token TEXT UNIQUE
    DEFAULT encode(gen_random_bytes(24), 'hex');
CREATE INDEX IF NOT EXISTS idx_staff_pool_portal_token
  ON public.staff_pool (staff_portal_token);

-- 2) profiles 영구 포털 토큰 (내부 직원 강사 겸임)
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS staff_portal_token TEXT UNIQUE
    DEFAULT encode(gen_random_bytes(24), 'hex');
CREATE INDEX IF NOT EXISTS idx_profiles_portal_token
  ON public.profiles (staff_portal_token);

-- 3) staff_personal_events (강사 자체 일정 입력용 — P4에서 UI 구현)
CREATE TABLE IF NOT EXISTS public.staff_personal_events (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     UUID NOT NULL,
  staff_source TEXT NOT NULL CHECK (staff_source IN ('staff_pool','profile')),
  title        TEXT NOT NULL,
  event_date   DATE NOT NULL,
  start_time   TIME,
  end_time     TIME,
  note         TEXT,
  created_at   TIMESTAMPTZ NOT NULL DEFAULT NOW()
);
CREATE INDEX IF NOT EXISTS idx_staff_personal_events_staff
  ON public.staff_personal_events (staff_id, staff_source);

-- 4) RLS — anon (토큰 기반 외부 접근) + authenticated 모두 허용
--    실제 접근 제어는 앱 측에서 token 매칭으로 처리.
ALTER TABLE public.staff_pool ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_pool' AND policyname='anon_read_staff_pool'
  ) THEN
    CREATE POLICY "anon_read_staff_pool"
      ON public.staff_pool FOR SELECT TO anon USING (true);
  END IF;
END $$;

ALTER TABLE public.staff_personal_events ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_personal_events' AND policyname='anon_all_staff_personal_events'
  ) THEN
    CREATE POLICY "anon_all_staff_personal_events"
      ON public.staff_personal_events FOR ALL TO anon
      USING (true) WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='staff_personal_events' AND policyname='auth_all_staff_personal_events'
  ) THEN
    CREATE POLICY "auth_all_staff_personal_events"
      ON public.staff_personal_events FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;
