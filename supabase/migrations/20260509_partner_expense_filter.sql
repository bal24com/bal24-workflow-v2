-- bal24 v2 — STEP-PARTNER-EXPENSE-FILTER 마이그레이션 (2026-05-09)
-- expenses 테이블에 consortium_member_id 추가 + 인덱스 + 자동 백필.

-- ============================================================
-- 1. consortium_member_id 컬럼 추가
-- ============================================================
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS consortium_member_id UUID
    REFERENCES consortium_members(id) ON DELETE SET NULL;

-- ============================================================
-- 2. 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_expenses_consortium_member_id
  ON expenses (consortium_member_id);

-- ============================================================
-- 3. 기존 expenses 자동 매핑 — program_assignments 기반
-- (program_id 가 expenses 에 있을 때만 동작 — 보정: 컬럼 존재 체크)
-- expenses 에 program_id 컬럼이 없으면 SKIP, NULL 유지.
-- ============================================================
DO $$
BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_name = 'expenses' AND column_name = 'program_id'
  ) THEN
    UPDATE expenses e
    SET consortium_member_id = pa.consortium_member_id
    FROM program_assignments pa
    WHERE e.program_id = pa.program_id
      AND pa.consortium_member_id IS NOT NULL
      AND e.consortium_member_id IS NULL;
  END IF;
END $$;
