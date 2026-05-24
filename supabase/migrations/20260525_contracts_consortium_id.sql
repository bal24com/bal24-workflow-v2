-- ============================================================
-- bal24 v2 — STEP-ACCOUNTING-FOLLOWUP4
-- income_contracts.consortium_id — 컨소시엄 단위 계약 지원
-- ============================================================

ALTER TABLE public.income_contracts
  ADD COLUMN IF NOT EXISTS consortium_id uuid REFERENCES public.consortiums(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_income_contracts_consortium
  ON public.income_contracts(consortium_id)
  WHERE deleted_at IS NULL;

-- 끝.
