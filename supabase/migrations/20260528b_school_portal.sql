-- ══════════════════════════════════════════════════════════════
-- STEP-SCHOOL-PORTAL · PART A 마이그레이션 (박경수님 2026-05-28)
-- 옵션 A 통합 — 기존 테이블 유지 + 신규 컬럼 ALTER ADD
-- ══════════════════════════════════════════════════════════════

-- ① programs.school_client_id (수혜학교 연결)
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS school_client_id UUID REFERENCES clients(id);

-- ② program_portals (학교담당자 + 팀 포털)
CREATE TABLE IF NOT EXISTS program_portals (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  client_id       UUID REFERENCES clients(id),
  portal_token    UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  access_scope    TEXT NOT NULL DEFAULT 'school',   -- 'school' | 'team'
  team_label      TEXT,
  participant_ids JSONB DEFAULT '[]',
  is_active       BOOLEAN DEFAULT true,
  created_at      TIMESTAMPTZ DEFAULT now()
);

-- ③ project_portals (교육지원청 포털)
CREATE TABLE IF NOT EXISTS project_portals (
  id           UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  project_id   UUID NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  portal_token UUID DEFAULT gen_random_uuid() UNIQUE NOT NULL,
  access_scope TEXT DEFAULT 'supervisor',
  is_active    BOOLEAN DEFAULT true,
  created_at   TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE project_portals
  ADD COLUMN IF NOT EXISTS access_scope TEXT DEFAULT 'supervisor';

-- ④ program_surveys — 1차(bdecb92)에 token/survey_key 컬럼 이미 있을 수 있음.
--    신규 환경 대비 CREATE TABLE IF NOT EXISTS 후, 신규 컬럼만 ALTER ADD.
CREATE TABLE IF NOT EXISTS program_surveys (
  id         UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES programs(id),
  title      TEXT NOT NULL,
  is_active  BOOLEAN DEFAULT true,
  created_at TIMESTAMPTZ DEFAULT now()
);
ALTER TABLE program_surveys
  ADD COLUMN IF NOT EXISTS project_id   UUID REFERENCES projects(id),
  ADD COLUMN IF NOT EXISTS description  TEXT,
  ADD COLUMN IF NOT EXISTS target_scope TEXT NOT NULL DEFAULT 'team',
  ADD COLUMN IF NOT EXISTS survey_type  TEXT DEFAULT 'satisfaction',
  ADD COLUMN IF NOT EXISTS due_date     DATE,
  ADD COLUMN IF NOT EXISTS created_by   UUID REFERENCES profiles(id);

-- ⑤ survey_questions
CREATE TABLE IF NOT EXISTS survey_questions (
  id            UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id     UUID REFERENCES program_surveys(id) ON DELETE CASCADE,
  question_text TEXT NOT NULL,
  question_type TEXT DEFAULT 'rating',  -- 'rating' | 'choice' | 'text'
  options       JSONB DEFAULT '[]',
  is_required   BOOLEAN DEFAULT true,
  order_index   INT DEFAULT 0
);

-- ⑥ survey_responses (팀원 개별 응답)
CREATE TABLE IF NOT EXISTS survey_responses (
  id               UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  survey_id        UUID REFERENCES program_surveys(id),
  portal_token     UUID,
  respondent_name  TEXT,
  answers          JSONB NOT NULL DEFAULT '{}',
  submitted_at     TIMESTAMPTZ DEFAULT now()
);

-- ⑦ RLS
ALTER TABLE program_portals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE project_portals   ENABLE ROW LEVEL SECURITY;
ALTER TABLE program_surveys   ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_questions  ENABLE ROW LEVEL SECURITY;
ALTER TABLE survey_responses  ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "program_portals_token_read"  ON program_portals;
DROP POLICY IF EXISTS "program_portals_staff_write" ON program_portals;
CREATE POLICY "program_portals_token_read"  ON program_portals FOR SELECT USING (is_active = true);
CREATE POLICY "program_portals_staff_write" ON program_portals FOR ALL   USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "project_portals_token_read"  ON project_portals;
DROP POLICY IF EXISTS "project_portals_staff_write" ON project_portals;
CREATE POLICY "project_portals_token_read"  ON project_portals FOR SELECT USING (is_active = true);
CREATE POLICY "project_portals_staff_write" ON project_portals FOR ALL   USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "surveys_authenticated_all" ON program_surveys;
DROP POLICY IF EXISTS "surveys_public_read"       ON program_surveys;
CREATE POLICY "surveys_authenticated_all" ON program_surveys FOR ALL    USING (auth.role() = 'authenticated');
CREATE POLICY "surveys_public_read"       ON program_surveys FOR SELECT USING (is_active = true);

DROP POLICY IF EXISTS "survey_questions_read"  ON survey_questions;
DROP POLICY IF EXISTS "survey_questions_write" ON survey_questions;
CREATE POLICY "survey_questions_read"  ON survey_questions FOR SELECT USING (true);
CREATE POLICY "survey_questions_write" ON survey_questions FOR ALL    USING (auth.role() = 'authenticated');

DROP POLICY IF EXISTS "survey_responses_insert" ON survey_responses;
DROP POLICY IF EXISTS "survey_responses_read"   ON survey_responses;
CREATE POLICY "survey_responses_insert" ON survey_responses FOR INSERT WITH CHECK (true);
CREATE POLICY "survey_responses_read"   ON survey_responses FOR SELECT USING (auth.role() = 'authenticated');
