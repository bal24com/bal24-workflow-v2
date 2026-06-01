-- ============================================================
-- 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE
-- 5단계 역할별 포털 (운영사·지원기관·수혜기관·수혜자·관리자) + 체크리스트.
-- 기존 project_portals / portal_items / portal_responses 보존하며 컬럼 추가.
-- ============================================================

-- 1) project_portals — 4종 역할 토큰 + 수혜기관 PIN
ALTER TABLE public.project_portals
  ADD COLUMN IF NOT EXISTS operator_token    TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS supporter_token   TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS beneficiary_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS participant_token TEXT UNIQUE DEFAULT gen_random_uuid()::text,
  ADD COLUMN IF NOT EXISTS beneficiary_pin   TEXT;

-- 2) portal_items — 역할별 노출·액션 권한 컬럼 추가 (기존 label·sort_order·required 유지)
ALTER TABLE public.portal_items
  ADD COLUMN IF NOT EXISTS visible_roles    TEXT[] NOT NULL DEFAULT
    ARRAY['admin','operator','supporter','beneficiary_org','participant'],
  ADD COLUMN IF NOT EXISTS actionable_roles TEXT[] NOT NULL DEFAULT
    ARRAY['admin','operator','supporter','beneficiary_org','participant'];

-- text_info 타입 추가 (기존 CHECK 가 6종 type 만 허용)
DO $$ BEGIN
  ALTER TABLE public.portal_items DROP CONSTRAINT IF EXISTS portal_items_item_type_check;
EXCEPTION WHEN OTHERS THEN NULL; END $$;
ALTER TABLE public.portal_items
  ADD CONSTRAINT portal_items_item_type_check
  CHECK (item_type IN ('file_download','file_upload','text_info','feedback','approval','auto_data','tax_invoice'));

-- 3) portal_responses — 역할·응답자 컬럼 추가 (기존 response_type 유지)
ALTER TABLE public.portal_responses
  ADD COLUMN IF NOT EXISTS portal_role   TEXT,
  ADD COLUMN IF NOT EXISTS respondent_id TEXT,
  ADD COLUMN IF NOT EXISTS is_approved   BOOLEAN;

-- 4) portal_teams 신규 — 수혜자 팀 등록 (참여사·동아리·소그룹)
CREATE TABLE IF NOT EXISTS public.portal_teams (
  id         UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id  UUID NOT NULL REFERENCES public.project_portals(id) ON DELETE CASCADE,
  team_code  TEXT NOT NULL,
  team_name  TEXT NOT NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (portal_id, team_code)
);
CREATE INDEX IF NOT EXISTS idx_portal_teams_portal ON public.portal_teams(portal_id);

-- RLS
ALTER TABLE public.portal_teams ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "portal_teams_auth_all" ON public.portal_teams;
CREATE POLICY "portal_teams_auth_all" ON public.portal_teams
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "portal_teams_anon_read" ON public.portal_teams;
CREATE POLICY "portal_teams_anon_read" ON public.portal_teams
  FOR SELECT TO anon USING (true);

-- 검증.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='project_portals' AND column_name IN
--    ('operator_token','supporter_token','beneficiary_token','participant_token','beneficiary_pin');
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='portal_items' AND column_name IN ('visible_roles','actionable_roles');
-- SELECT to_regclass('public.portal_teams');
