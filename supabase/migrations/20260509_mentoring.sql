-- ============================================================
-- STEP-MENTORING: 멘토링 매핑·일지·지급 시스템
-- 실행 대상: Supabase SQL Editor (박경수님 직접 실행)
-- 보강: mentor_access_token / mentee_access_token UNIQUE 컬럼
-- Storage 수동: mentoring-sessions 버킷 (Public ON)
-- ============================================================

-- ============================================================
-- 1. mentoring_assignments — 멘토 ↔ 프로그램 매핑 + 지급 기준 + 토큰
-- ============================================================
CREATE TABLE IF NOT EXISTS mentoring_assignments (
  id                    UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id            UUID REFERENCES programs(id) ON DELETE CASCADE,
  -- 멘토: 외부(staff_pool) 또는 내부(profiles) 중 하나만 값
  mentor_pool_id        UUID REFERENCES staff_pool(id) ON DELETE SET NULL,
  mentor_profile_id     UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- 담당 멘티 (participant_applications.id 배열)
  mentee_ids            UUID[],
  meet_type             TEXT CHECK (meet_type IN ('대면', '비대면', '혼합')),
  -- 지급 방식
  pay_type              TEXT CHECK (pay_type IN ('단가×회수', '전체계약')),
  unit_price            INTEGER,
  session_count         INTEGER,
  contract_amount       INTEGER,
  -- 원천징수 (PM 초안 → 멘토 1회 변경 가능)
  tax_type              TEXT DEFAULT '3.3%' CHECK (tax_type IN ('3.3%', '8.8%', '면세')),
  tax_type_locked       BOOLEAN DEFAULT FALSE,
  -- 외부 접근 토큰 (보강)
  mentor_access_token   UUID DEFAULT gen_random_uuid() UNIQUE,
  mentee_access_token   UUID DEFAULT gen_random_uuid() UNIQUE,
  pm_note               TEXT,
  status                TEXT DEFAULT '진행' CHECK (status IN ('진행', '완료', '취소')),
  created_at            TIMESTAMPTZ DEFAULT NOW(),
  updated_at            TIMESTAMPTZ DEFAULT NOW(),
  CONSTRAINT chk_mentor_fk CHECK (
    (mentor_pool_id IS NOT NULL AND mentor_profile_id IS NULL) OR
    (mentor_pool_id IS NULL AND mentor_profile_id IS NOT NULL)
  )
);

CREATE INDEX IF NOT EXISTS idx_mentoring_assignments_program ON mentoring_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_assignments_pool ON mentoring_assignments(mentor_pool_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_assignments_profile ON mentoring_assignments(mentor_profile_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_assignments_mentor_token ON mentoring_assignments(mentor_access_token);
CREATE INDEX IF NOT EXISTS idx_mentoring_assignments_mentee_token ON mentoring_assignments(mentee_access_token);

ALTER TABLE mentoring_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_mentoring_assignments" ON mentoring_assignments;
CREATE POLICY "authenticated_all_mentoring_assignments" ON mentoring_assignments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_select_mentoring_assignments" ON mentoring_assignments;
CREATE POLICY "anon_select_mentoring_assignments" ON mentoring_assignments
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_update_tax_type_mentoring_assignments" ON mentoring_assignments;
CREATE POLICY "anon_update_tax_type_mentoring_assignments" ON mentoring_assignments
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

-- ============================================================
-- 2. mentoring_sessions — 회차별 멘토링 일지 (보고서)
-- ============================================================
CREATE TABLE IF NOT EXISTS mentoring_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id   UUID REFERENCES mentoring_assignments(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL,
  start_time      TEXT,
  end_time        TEXT,
  duration_min    INTEGER,
  session_no      INTEGER,
  meet_type       TEXT CHECK (meet_type IN ('대면', '비대면')),
  team_name       TEXT,
  item_name       TEXT,
  attendee_names  TEXT,
  title           TEXT NOT NULL,
  content         TEXT NOT NULL,
  photo_urls      TEXT[],
  submitted_by    UUID REFERENCES profiles(id),
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentoring_sessions_assignment ON mentoring_sessions(assignment_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_sessions_date ON mentoring_sessions(session_date);

ALTER TABLE mentoring_sessions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_mentoring_sessions" ON mentoring_sessions;
CREATE POLICY "authenticated_all_mentoring_sessions" ON mentoring_sessions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_select_mentoring_sessions" ON mentoring_sessions;
CREATE POLICY "anon_select_mentoring_sessions" ON mentoring_sessions
  FOR SELECT TO anon USING (true);
DROP POLICY IF EXISTS "anon_insert_mentoring_sessions" ON mentoring_sessions;
CREATE POLICY "anon_insert_mentoring_sessions" ON mentoring_sessions
  FOR INSERT TO anon WITH CHECK (true);

-- ============================================================
-- 3. mentoring_feedbacks — 멘티 피드백
-- ============================================================
CREATE TABLE IF NOT EXISTS mentoring_feedbacks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID REFERENCES mentoring_sessions(id) ON DELETE CASCADE,
  mentee_id       UUID REFERENCES profiles(id),
  mentee_name     TEXT,
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  submitted_at    TIMESTAMPTZ DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_mentoring_feedbacks_session ON mentoring_feedbacks(session_id);

ALTER TABLE mentoring_feedbacks ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "authenticated_all_mentoring_feedbacks" ON mentoring_feedbacks;
CREATE POLICY "authenticated_all_mentoring_feedbacks" ON mentoring_feedbacks
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
DROP POLICY IF EXISTS "anon_insert_mentoring_feedbacks" ON mentoring_feedbacks;
CREATE POLICY "anon_insert_mentoring_feedbacks" ON mentoring_feedbacks
  FOR INSERT TO anon WITH CHECK (true);
DROP POLICY IF EXISTS "anon_select_mentoring_feedbacks" ON mentoring_feedbacks;
CREATE POLICY "anon_select_mentoring_feedbacks" ON mentoring_feedbacks
  FOR SELECT TO anon USING (true);
