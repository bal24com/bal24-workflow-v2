-- ============================================================
-- 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE
-- PM → 외부 공유 시스템 — 수혜기관 등록·PIN 발급·신청 설문·주관기관 조회.
-- 기존 5단계 토큰 (project_portals.operator_token 등) 과 별개 레벨.
-- portal_beneficiary_orgs.token 은 수혜기관별 1개씩 발급 (포털당 N개).
-- ============================================================

-- 1) 수혜기관 등록 + 개별 토큰 + PIN
CREATE TABLE IF NOT EXISTS public.portal_beneficiary_orgs (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id     UUID NOT NULL REFERENCES public.project_portals(id) ON DELETE CASCADE,
  org_name      TEXT NOT NULL,
  contact_name  TEXT,
  contact_phone TEXT,
  pin           TEXT NOT NULL,
  token         TEXT NOT NULL UNIQUE DEFAULT gen_random_uuid()::text,
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','submitted','confirmed')),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_pbo_portal_id ON public.portal_beneficiary_orgs(portal_id);
CREATE INDEX IF NOT EXISTS idx_pbo_token     ON public.portal_beneficiary_orgs(token);
ALTER TABLE public.portal_beneficiary_orgs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_read_pbo" ON public.portal_beneficiary_orgs;
CREATE POLICY "anon_read_pbo" ON public.portal_beneficiary_orgs
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_update_pbo_status" ON public.portal_beneficiary_orgs;
CREATE POLICY "anon_update_pbo_status" ON public.portal_beneficiary_orgs
  FOR UPDATE TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_pbo" ON public.portal_beneficiary_orgs;
CREATE POLICY "auth_all_pbo" ON public.portal_beneficiary_orgs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) 설문 응답 저장
CREATE TABLE IF NOT EXISTS public.portal_survey_responses (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id          UUID NOT NULL REFERENCES public.project_portals(id) ON DELETE CASCADE,
  beneficiary_org_id UUID REFERENCES public.portal_beneficiary_orgs(id) ON DELETE SET NULL,
  org_name           TEXT,
  answers            JSONB NOT NULL DEFAULT '{}'::jsonb,
  submitted_at       TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_psr_portal     ON public.portal_survey_responses(portal_id);
CREATE INDEX IF NOT EXISTS idx_psr_bo         ON public.portal_survey_responses(beneficiary_org_id);
ALTER TABLE public.portal_survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "anon_all_psr" ON public.portal_survey_responses;
CREATE POLICY "anon_all_psr" ON public.portal_survey_responses
  FOR ALL TO anon USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all_psr" ON public.portal_survey_responses;
CREATE POLICY "auth_all_psr" ON public.portal_survey_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) project_portals 안내·설문 컬럼 추가
ALTER TABLE public.project_portals
  ADD COLUMN IF NOT EXISTS intro_title   TEXT,
  ADD COLUMN IF NOT EXISTS intro_content TEXT,
  ADD COLUMN IF NOT EXISTS survey_config JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 검증.
-- SELECT to_regclass('public.portal_beneficiary_orgs');   -- NULL 아니어야
-- SELECT to_regclass('public.portal_survey_responses');   -- NULL 아니어야
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='project_portals' AND column_name IN ('intro_title','intro_content','survey_config');
