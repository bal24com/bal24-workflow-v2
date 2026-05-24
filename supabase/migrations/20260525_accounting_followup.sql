-- ============================================================
-- bal24 v2 — STEP-ACCOUNTING-FOLLOWUP2
-- 박경수님 요청: 부가세 10% 옵션 + 구분 자유 입력
--
-- 1. payroll_expenses.tax_rate_type 에 '10' (부가세 10% 포함) 추가
-- 2. payroll_expenses.expense_type CHECK 제약 제거
--    → 박경수님이 자유롭게 세부 항목명 입력 가능
--    (예: "강사료-OT", "운영비-사무용품")
-- ============================================================

-- 1. tax_rate_type CHECK 갱신
ALTER TABLE public.payroll_expenses
  DROP CONSTRAINT IF EXISTS payroll_expenses_tax_rate_type_check;

ALTER TABLE public.payroll_expenses
  ADD CONSTRAINT payroll_expenses_tax_rate_type_check
  CHECK (tax_rate_type IN ('3.3','8.8','10','면세','없음'));

-- 2. expense_type CHECK 제거 — 자유 입력 허용
ALTER TABLE public.payroll_expenses
  DROP CONSTRAINT IF EXISTS payroll_expenses_expense_type_check;

-- 끝.
