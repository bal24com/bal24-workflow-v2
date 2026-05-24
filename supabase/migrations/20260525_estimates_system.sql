-- ============================================================
-- bal24 v2 — STEP-ACCOUNTING-FOLLOWUP7-Phase2
-- 견적서 시스템 — project_estimates + estimate_items
-- 박경수님 흐름: 프로젝트/프로그램 설정 시 견적 작성 → 항목 → 외주/급여 일괄 변환
-- ============================================================

-- 1. project_estimates — 견적 헤더
CREATE TABLE IF NOT EXISTS public.project_estimates (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id   uuid REFERENCES public.projects(id)         ON DELETE CASCADE,
  program_id   uuid REFERENCES public.programs(id)         ON DELETE CASCADE,
  contract_id  uuid REFERENCES public.income_contracts(id) ON DELETE SET NULL,
  title        text NOT NULL,
  total_amount bigint NOT NULL DEFAULT 0,
  memo         text,
  created_by   uuid REFERENCES public.profiles(id),
  created_at   timestamptz DEFAULT now(),
  updated_at   timestamptz DEFAULT now(),
  deleted_at   timestamptz
);

CREATE INDEX IF NOT EXISTS idx_estimates_project    ON public.project_estimates(project_id)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_estimates_program    ON public.project_estimates(program_id)    WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_estimates_contract   ON public.project_estimates(contract_id)   WHERE deleted_at IS NULL;

-- 2. estimate_items — 견적 항목 (강사료·운영비 등)
CREATE TABLE IF NOT EXISTS public.estimate_items (
  id                 uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  estimate_id        uuid NOT NULL REFERENCES public.project_estimates(id) ON DELETE CASCADE,
  category           text NOT NULL DEFAULT '강사료',
  description        text,
  payee_name         text,
  unit_price         bigint NOT NULL DEFAULT 0,
  quantity           integer NOT NULL DEFAULT 1,
  subtotal           bigint GENERATED ALWAYS AS (unit_price * quantity) STORED,
  tax_rate_type      text DEFAULT '3.3' CHECK (tax_rate_type IN ('3.3','8.8','10','면세','없음')),
  memo               text,
  order_index        integer NOT NULL DEFAULT 0,
  -- 실집행 추적: 견적 항목 → 외주/급여 변환 시 그 row 참조
  payroll_expense_id uuid REFERENCES public.payroll_expenses(id) ON DELETE SET NULL,
  created_at         timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_estimate_items_estimate ON public.estimate_items(estimate_id);
CREATE INDEX IF NOT EXISTS idx_estimate_items_payroll  ON public.estimate_items(payroll_expense_id);

-- 3. RLS
ALTER TABLE public.project_estimates ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.estimate_items    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_estimates_authenticated" ON public.project_estimates;
CREATE POLICY "project_estimates_authenticated"
  ON public.project_estimates FOR ALL TO authenticated
  USING (deleted_at IS NULL) WITH CHECK (true);

DROP POLICY IF EXISTS "estimate_items_authenticated" ON public.estimate_items;
CREATE POLICY "estimate_items_authenticated"
  ON public.estimate_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4. 검증
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('project_estimates', 'estimate_items');

-- 끝.
