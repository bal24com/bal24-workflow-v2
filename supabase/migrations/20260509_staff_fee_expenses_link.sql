-- bal24 v2 — STEP-STAFF-FEE-EXPENSES-LINK 마이그레이션 (2026-05-09)
-- 강사료 지급 완료 시 expenses 자동 생성 + 양방향 FK 연동.

-- ============================================================
-- 1. program_staff_fees → expenses 역참조
-- (paid_at 은 STEP-STAFF-FEE-TAX 마이그레이션에서 이미 DATE 타입으로 추가됨 → SKIP)
-- ============================================================
ALTER TABLE program_staff_fees
  ADD COLUMN IF NOT EXISTS expense_id UUID REFERENCES expenses(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_program_staff_fees_expense_id
  ON program_staff_fees(expense_id);

-- ============================================================
-- 2. expenses → program_staff_fees 출처 추적
-- ============================================================
ALTER TABLE expenses
  ADD COLUMN IF NOT EXISTS staff_fee_id UUID REFERENCES program_staff_fees(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_expenses_staff_fee_id
  ON expenses(staff_fee_id);

-- ============================================================
-- 3. 확인 SELECT
-- ============================================================
SELECT
  psf.id           AS fee_id,
  psf.payment_status,
  psf.expense_id,
  psf.paid_at      AS fee_paid_at,
  e.staff_fee_id   AS expense_back_ref,
  e.gross_amount,
  e.expense_date
FROM program_staff_fees psf
LEFT JOIN expenses e ON e.id = psf.expense_id
LIMIT 5;
