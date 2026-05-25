-- bal24 v2 — STEP-STAFF-FEE-PERIOD (2026-05-25)
-- 강사 지급기준에 강의·운영 기간(시작일·종료일) 컬럼 추가.
-- 박경수님 요청 — "각 기간 설정은 시작일, 종료일 지정할 수 있도록 추가".

ALTER TABLE program_staff_fees
  ADD COLUMN IF NOT EXISTS period_start_date DATE,
  ADD COLUMN IF NOT EXISTS period_end_date   DATE;

-- 시작일 ≤ 종료일 (NULL 허용)
ALTER TABLE program_staff_fees
  DROP CONSTRAINT IF EXISTS chk_psf_period_order;
ALTER TABLE program_staff_fees
  ADD CONSTRAINT chk_psf_period_order CHECK (
    period_start_date IS NULL OR period_end_date IS NULL
    OR period_start_date <= period_end_date
  );

-- 확인 SELECT
SELECT id, program_id, fee_type, period_start_date, period_end_date
FROM program_staff_fees
ORDER BY created_at DESC
LIMIT 5;
