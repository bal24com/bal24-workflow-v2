-- ============================================================
-- bal24 v2 — STEP-CONTRACT-AUTO
-- 프로젝트/프로그램 생성 시 income_contracts 자동 생성 + lifecycle 단계 + 주관기관 서류 요청 portal 연결
-- ============================================================

-- 1. status CHECK 에 'draft' 추가 (자동 생성 row 의 대기 상태)
ALTER TABLE public.income_contracts
  DROP CONSTRAINT IF EXISTS income_contracts_status_check;
ALTER TABLE public.income_contracts
  ADD CONSTRAINT income_contracts_status_check
  CHECK (status IN ('draft', '진행중', '완료', '취소', '보류'));

-- 2. lifecycle_stage / auto_created / doc_request_pending 컬럼
ALTER TABLE public.income_contracts
  ADD COLUMN IF NOT EXISTS lifecycle_stage text DEFAULT 'proposal'
    CHECK (lifecycle_stage IN ('proposal', 'contract', 'operation', 'closing')),
  ADD COLUMN IF NOT EXISTS auto_created boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS doc_request_pending boolean NOT NULL DEFAULT false;

-- 3. portal_id — 주관기관 서류 요청 외부 링크 (project_portals FK)
ALTER TABLE public.income_contracts
  ADD COLUMN IF NOT EXISTS portal_id uuid REFERENCES public.project_portals(id) ON DELETE SET NULL;

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_income_contracts_lifecycle
  ON public.income_contracts(lifecycle_stage) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_income_contracts_doc_pending
  ON public.income_contracts(doc_request_pending)
  WHERE deleted_at IS NULL AND doc_request_pending = true;
CREATE INDEX IF NOT EXISTS idx_income_contracts_portal
  ON public.income_contracts(portal_id) WHERE deleted_at IS NULL;

-- 끝.
