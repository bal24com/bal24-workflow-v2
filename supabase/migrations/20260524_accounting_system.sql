-- ============================================================
-- bal24 v2 — STEP-ACCOUNTING-ALL
-- 회계 관리 시스템 4개 테이블 + Storage 3개 버킷 + RLS
-- 박경수님이 Supabase Dashboard 의 SQL Editor 에서 실행.
-- ============================================================

-- 1. income_contracts — 수입/계약
CREATE TABLE IF NOT EXISTS income_contracts (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id        uuid REFERENCES projects(id) ON DELETE SET NULL,
  client_id         uuid REFERENCES clients(id)  ON DELETE SET NULL,
  contract_name     text NOT NULL,
  contract_amount   bigint NOT NULL DEFAULT 0,
  vat_type          text NOT NULL DEFAULT '과세'
                    CHECK (vat_type IN ('과세','면세','영세율')),
  contract_date     date,
  billing_schedule  jsonb DEFAULT '[]',
  status            text NOT NULL DEFAULT '진행중'
                    CHECK (status IN ('진행중','완료','취소','보류')),
  tax_invoice_url   text,
  contract_file_url text,
  deposited_at      timestamptz,
  memo              text,
  created_by        uuid REFERENCES profiles(id),
  created_at        timestamptz DEFAULT now(),
  updated_at        timestamptz DEFAULT now(),
  deleted_at        timestamptz
);

CREATE INDEX IF NOT EXISTS idx_income_contracts_project ON income_contracts(project_id);
CREATE INDEX IF NOT EXISTS idx_income_contracts_client ON income_contracts(client_id);
CREATE INDEX IF NOT EXISTS idx_income_contracts_status ON income_contracts(status) WHERE deleted_at IS NULL;

-- 2. payroll_expenses — 외주/급여
CREATE TABLE IF NOT EXISTS payroll_expenses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id       uuid REFERENCES projects(id) ON DELETE SET NULL,
  program_id       uuid REFERENCES programs(id) ON DELETE SET NULL,
  expense_type     text NOT NULL DEFAULT '강사료'
                   CHECK (expense_type IN ('강사료','촬영','운영비','운영인건비','기타외주')),
  description      text,
  payee_name       text NOT NULL,
  payee_id_no      text,
  bank_name        text,
  bank_account     text,
  unit_price       bigint NOT NULL DEFAULT 0,
  quantity         integer NOT NULL DEFAULT 1,
  subtotal         bigint GENERATED ALWAYS AS (unit_price * quantity) STORED,
  tax_rate_type    text DEFAULT '3.3'
                   CHECK (tax_rate_type IN ('3.3','8.8','면세','없음')),
  tax_amount       bigint NOT NULL DEFAULT 0,
  net_amount       bigint NOT NULL DEFAULT 0,
  payment_status   text NOT NULL DEFAULT '대기'
                   CHECK (payment_status IN ('대기','완료','후순위','취소')),
  paid_at          timestamptz,
  receipt_urls     text[] DEFAULT '{}',
  staff_pool_id    uuid REFERENCES staff_pool(id) ON DELETE SET NULL,
  memo             text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz DEFAULT now(),
  updated_at       timestamptz DEFAULT now(),
  deleted_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payroll_expenses_project ON payroll_expenses(project_id);
CREATE INDEX IF NOT EXISTS idx_payroll_expenses_program ON payroll_expenses(program_id);
CREATE INDEX IF NOT EXISTS idx_payroll_expenses_type ON payroll_expenses(expense_type) WHERE deleted_at IS NULL;
CREATE INDEX IF NOT EXISTS idx_payroll_expenses_payment ON payroll_expenses(payment_status) WHERE deleted_at IS NULL;

-- 3. accounting_reviews — 회계사무소 검토 세션
CREATE TABLE IF NOT EXISTS accounting_reviews (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  period_label    text NOT NULL,
  project_ids     uuid[] DEFAULT '{}',
  token           uuid DEFAULT gen_random_uuid() UNIQUE,
  firm_name       text,
  firm_email      text,
  status          text NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending','reviewing','completed')),
  sent_at         timestamptz,
  completed_at    timestamptz,
  expires_at      timestamptz DEFAULT (now() + interval '30 days'),
  created_by      uuid REFERENCES profiles(id),
  created_at      timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_accounting_reviews_token ON accounting_reviews(token);
CREATE INDEX IF NOT EXISTS idx_accounting_reviews_status ON accounting_reviews(status);

-- 4. accounting_review_items — 항목별 검토 결과
CREATE TABLE IF NOT EXISTS accounting_review_items (
  id                  uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  review_id           uuid REFERENCES accounting_reviews(id) ON DELETE CASCADE,
  payroll_expense_id  uuid REFERENCES payroll_expenses(id) ON DELETE CASCADE,
  review_status       text NOT NULL DEFAULT 'pending'
                      CHECK (review_status IN ('pending','approved','revision')),
  revision_note       text,
  reviewed_at         timestamptz,
  created_at          timestamptz DEFAULT now(),
  UNIQUE (review_id, payroll_expense_id)
);

-- 5. Storage 버킷 (contracts·payroll — receipts 는 기존 v2 에 이미 있을 수 있으므로 ON CONFLICT)
INSERT INTO storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
VALUES
  ('contracts', 'contracts', false, 20971520,
   ARRAY['application/pdf','image/png','image/jpeg','image/webp']),
  ('payroll',   'payroll',   false, 10485760,
   ARRAY['application/pdf','image/png','image/jpeg']),
  ('receipts',  'receipts',  false, 10485760,
   ARRAY['application/pdf','image/png','image/jpeg'])
ON CONFLICT (id) DO NOTHING;

-- 6. RLS 정책
ALTER TABLE income_contracts        ENABLE ROW LEVEL SECURITY;
ALTER TABLE payroll_expenses        ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_reviews      ENABLE ROW LEVEL SECURITY;
ALTER TABLE accounting_review_items ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "income_contracts_authenticated" ON income_contracts;
CREATE POLICY "income_contracts_authenticated"
  ON income_contracts FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);

DROP POLICY IF EXISTS "payroll_expenses_authenticated" ON payroll_expenses;
CREATE POLICY "payroll_expenses_authenticated"
  ON payroll_expenses FOR ALL TO authenticated USING (deleted_at IS NULL) WITH CHECK (true);

DROP POLICY IF EXISTS "accounting_reviews_authenticated" ON accounting_reviews;
CREATE POLICY "accounting_reviews_authenticated"
  ON accounting_reviews FOR ALL TO authenticated USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "accounting_review_items_authenticated" ON accounting_review_items;
CREATE POLICY "accounting_review_items_authenticated"
  ON accounting_review_items FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 회계사무소 외부 접근 (anon — 토큰 검증, 만료 확인)
DROP POLICY IF EXISTS "accounting_reviews_anon_token" ON accounting_reviews;
CREATE POLICY "accounting_reviews_anon_token"
  ON accounting_reviews FOR SELECT TO anon USING (expires_at > now());

DROP POLICY IF EXISTS "accounting_review_items_anon_read" ON accounting_review_items;
CREATE POLICY "accounting_review_items_anon_read"
  ON accounting_review_items FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "accounting_review_items_anon_update" ON accounting_review_items;
CREATE POLICY "accounting_review_items_anon_update"
  ON accounting_review_items FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "accounting_review_items_anon_insert" ON accounting_review_items;
CREATE POLICY "accounting_review_items_anon_insert"
  ON accounting_review_items FOR INSERT TO anon WITH CHECK (true);

-- payroll_expenses 도 anon SELECT (포털에서 항목 표시용)
DROP POLICY IF EXISTS "payroll_expenses_anon_select" ON payroll_expenses;
CREATE POLICY "payroll_expenses_anon_select"
  ON payroll_expenses FOR SELECT TO anon USING (deleted_at IS NULL);

-- Storage RLS (contracts/payroll/receipts 버킷 인증 사용자 전체 접근)
DROP POLICY IF EXISTS "accounting_storage_auth_all" ON storage.objects;
CREATE POLICY "accounting_storage_auth_all"
  ON storage.objects FOR ALL TO authenticated
  USING (bucket_id IN ('contracts','payroll','receipts'))
  WITH CHECK (bucket_id IN ('contracts','payroll','receipts'));

-- 7. 검증 쿼리 (Run 후 결과 확인용)
SELECT table_name FROM information_schema.tables
 WHERE table_schema = 'public'
   AND table_name IN ('income_contracts','payroll_expenses',
                      'accounting_reviews','accounting_review_items');

-- 끝.
