-- bal24 v2 — STEP-PROGRAM-VISIBILITY 마이그레이션 (2026-05-09)
-- programs.visibility + RLS SELECT 4 정책 + 인덱스.

-- ============================================================
-- 1. programs.visibility 컬럼 추가
-- ============================================================
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS visibility TEXT
    NOT NULL DEFAULT 'internal'
    CHECK (visibility IN ('private', 'internal', 'public'));

-- 기존 프로그램 모두 internal (팀 전체 공개 유지)
UPDATE programs
SET visibility = 'internal'
WHERE visibility IS NULL;

COMMENT ON COLUMN programs.visibility IS
  'private: 배정된 사람만 / internal: 로그인 사용자 전체 / public: 외부 링크도 공개';

-- ============================================================
-- 2. RLS 활성화 (programs 테이블 한정)
-- ============================================================
ALTER TABLE programs ENABLE ROW LEVEL SECURITY;

-- ============================================================
-- 3. SELECT 정책 4개
-- ============================================================
DROP POLICY IF EXISTS "programs_select_admin" ON programs;
CREATE POLICY "programs_select_admin"
  ON programs FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE profiles.id = auth.uid()
        AND profiles.role = 'admin'
    )
  );

DROP POLICY IF EXISTS "programs_select_internal" ON programs;
CREATE POLICY "programs_select_internal"
  ON programs FOR SELECT
  TO authenticated
  USING (
    visibility = 'internal'
  );

DROP POLICY IF EXISTS "programs_select_public" ON programs;
CREATE POLICY "programs_select_public"
  ON programs FOR SELECT
  TO anon, authenticated
  USING (
    visibility = 'public'
  );

DROP POLICY IF EXISTS "programs_select_private" ON programs;
CREATE POLICY "programs_select_private"
  ON programs FOR SELECT
  TO authenticated
  USING (
    visibility = 'private'
    AND (
      -- ADMIN bypass (정책 1과 중복이지만 명시적으로 포함)
      EXISTS (
        SELECT 1 FROM profiles
        WHERE profiles.id = auth.uid()
          AND profiles.role = 'admin'
      )
      OR
      -- program_assignments 기반: consortium_member_id 매칭 (PARTNER)
      EXISTS (
        SELECT 1
        FROM program_assignments pa
        JOIN profiles p ON p.consortium_member_id = pa.consortium_member_id
        WHERE pa.program_id = programs.id
          AND p.id = auth.uid()
      )
      OR
      -- mentoring_assignments 기반: 멘토로 배정된 경우
      EXISTS (
        SELECT 1
        FROM mentoring_assignments ma
        WHERE ma.program_id = programs.id
          AND ma.mentor_profile_id = auth.uid()
      )
      OR
      -- mentoring_assignments 기반: 멘티로 배정된 경우 (mentee_ids UUID[])
      EXISTS (
        SELECT 1
        FROM mentoring_assignments ma
        WHERE ma.program_id = programs.id
          AND auth.uid() = ANY(ma.mentee_ids)
      )
    )
  );

-- ============================================================
-- 4. 인덱스 (RLS 서브쿼리 성능)
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_program_assignments_program_id
  ON program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_assignments_consortium_member_id
  ON program_assignments(consortium_member_id);
CREATE INDEX IF NOT EXISTS idx_profiles_consortium_member_id
  ON profiles(consortium_member_id);
CREATE INDEX IF NOT EXISTS idx_programs_visibility
  ON programs(visibility);
CREATE INDEX IF NOT EXISTS idx_mentoring_assignments_mentor_profile_id
  ON mentoring_assignments(mentor_profile_id);
CREATE INDEX IF NOT EXISTS idx_mentoring_assignments_mentee_ids
  ON mentoring_assignments USING GIN (mentee_ids);
