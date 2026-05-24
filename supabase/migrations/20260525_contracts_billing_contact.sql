-- ============================================================
-- bal24 v2 — STEP-ACCOUNTING-FOLLOWUP6
-- income_contracts.billing_contact_id — 세금계산서 담당자 (client_contacts FK)
-- ============================================================

ALTER TABLE public.income_contracts
  ADD COLUMN IF NOT EXISTS billing_contact_id uuid REFERENCES public.client_contacts(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_income_contracts_billing_contact
  ON public.income_contracts(billing_contact_id)
  WHERE deleted_at IS NULL;

-- 끝.
