-- ════════════════════════════════════════════════
-- STEP-CONSORTIUM-PROGRAM-ASSIGN (박경수님 2026-05-28)
-- 컨소시엄 참여사 ↔ 프로그램 다대다 배정.
-- 박경수님 환경 보정 — profiles.id (user_id 컬럼 없음).
-- ════════════════════════════════════════════════

-- ① program_assignments 테이블
CREATE TABLE IF NOT EXISTS program_assignments (
  id                   UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id           UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  consortium_member_id UUID NOT NULL REFERENCES consortium_members(id) ON DELETE CASCADE,
  role                 TEXT NOT NULL DEFAULT '수행사',
  note                 TEXT,
  created_at           TIMESTAMPTZ DEFAULT now(),
  UNIQUE(program_id, consortium_member_id)
);

-- ② role CHECK 제약 — '주관'·'수행사'·'협력'
ALTER TABLE program_assignments
  DROP CONSTRAINT IF EXISTS program_assignments_role_check;
ALTER TABLE program_assignments
  ADD CONSTRAINT program_assignments_role_check
    CHECK (role IN ('주관', '수행사', '협력'));

-- ③ 인덱스
CREATE INDEX IF NOT EXISTS idx_pa_program_id ON program_assignments(program_id);
CREATE INDEX IF NOT EXISTS idx_pa_member_id  ON program_assignments(consortium_member_id);

-- ④ RLS — 박경수님 환경의 profiles(id) 매핑 + role 소문자
ALTER TABLE program_assignments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "program_assignments_select" ON program_assignments;
CREATE POLICY "program_assignments_select"
  ON program_assignments FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND lower(p.role) IN ('admin','finance','pm','staff')
    )
  );

DROP POLICY IF EXISTS "program_assignments_write" ON program_assignments;
CREATE POLICY "program_assignments_write"
  ON program_assignments FOR ALL
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND lower(p.role) IN ('admin','pm')
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.profiles p
       WHERE p.id = auth.uid()
         AND lower(p.role) IN ('admin','pm')
    )
  );

-- ⑤ 검증
SELECT COUNT(*) FROM program_assignments;
