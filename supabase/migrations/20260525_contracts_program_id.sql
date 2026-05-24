-- ============================================================
-- bal24 v2 — STEP-ACCOUNTING-FOLLOWUP3
-- income_contracts 에 program_id 추가 — 수입/계약을 프로그램 단위로도 연결
-- ============================================================

ALTER TABLE public.income_contracts
  ADD COLUMN IF NOT EXISTS program_id uuid REFERENCES public.programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_income_contracts_program
  ON public.income_contracts(program_id)
  WHERE deleted_at IS NULL;

-- 끝.
