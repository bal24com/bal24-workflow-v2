-- 박경수님 + SkyClaw — 지출요청 워크플로우 분리
-- 증상: 외주/급여 페이지에 지급요청 초안까지 즉시 노출돼서 금전 추적이 어려움
-- 해결: submitted_at NULL=초안(지급요청 탭에만), NOT NULL=확정(외주/급여 노출)
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)

ALTER TABLE payroll_expenses
  ADD COLUMN IF NOT EXISTS submitted_at TIMESTAMPTZ NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_submitted
  ON payroll_expenses(submitted_at)
  WHERE deleted_at IS NULL;

COMMENT ON COLUMN payroll_expenses.submitted_at IS
  '지출 요청 실행 시각. NULL=초안(지급요청 탭에만), NOT NULL=외주/급여 페이지 노출';

-- 확인
SELECT column_name, data_type, is_nullable
FROM information_schema.columns
WHERE table_name = 'payroll_expenses'
  AND column_name = 'submitted_at';
