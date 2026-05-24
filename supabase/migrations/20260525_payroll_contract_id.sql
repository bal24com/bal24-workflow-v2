-- ============================================================
-- bal24 v2 — STEP-ACCOUNTING-FOLLOWUP7
-- payroll_expenses.contract_id — 외주/급여 ↔ 수입/계약 연결
-- ============================================================

ALTER TABLE public.payroll_expenses
  ADD COLUMN IF NOT EXISTS contract_id uuid REFERENCES public.income_contracts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_expenses_contract
  ON public.payroll_expenses(contract_id)
  WHERE deleted_at IS NULL;

-- 끝.
