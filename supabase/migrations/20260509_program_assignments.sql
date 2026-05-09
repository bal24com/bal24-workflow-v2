-- ============================================================
-- STEP-PROGRAM-ASSIGNMENT: 프로그램 담당사 배정 시스템
-- 실행 대상: Supabase SQL Editor (박경수님 직접 실행)
-- ============================================================

-- ============================================================
-- 1. profiles 테이블 — consortium_member_id 컬럼 추가 (Q6-A)
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS consortium_member_id UUID
    REFERENCES consortium_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_consortium_member_id
  ON profiles(consortium_member_id);

-- ============================================================
-- 2. program_assignments 테이블 신규 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS program_assignments (
  id                       UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id               UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  consortium_member_id     UUID NOT NULL REFERENCES consortium_members(id) ON DELETE CASCADE,
  role                     TEXT NOT NULL DEFAULT 'support'
                             CHECK (role IN ('lead', 'support')),
  can_manage_participants  BOOLEAN DEFAULT true,
  can_manage_files         BOOLEAN DEFAULT true,
  can_view_finance         BOOLEAN DEFAULT false,
  created_by               UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at               TIMESTAMPTZ DEFAULT now(),
  updated_at               TIMESTAMPTZ DEFAULT now(),
  -- 한 프로그램에 같은 참여사 중복 배정 방지
  UNIQUE(program_id, consortium_member_id)
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_program_assignments_program_id
  ON program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_assignments_consortium_member_id
  ON program_assignments(consortium_member_id);

-- RLS
ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자 전체 조회
DROP POLICY IF EXISTS "authenticated_read" ON program_assignments;
CREATE POLICY "authenticated_read" ON program_assignments
  FOR SELECT TO authenticated USING (true);

-- PM/ADMIN만 배정 생성·수정·삭제
DROP POLICY IF EXISTS "pm_admin_manage" ON program_assignments;
CREATE POLICY "pm_admin_manage" ON program_assignments
  FOR ALL TO authenticated
  USING (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    IN ('PM', 'ADMIN')
  )
  WITH CHECK (
    (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid())
    IN ('PM', 'ADMIN')
  );
