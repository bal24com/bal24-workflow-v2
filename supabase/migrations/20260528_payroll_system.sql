-- 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28)
-- 직원 급여 관리 + 지출결의서 시스템 — 5 테이블
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)

-- 1) 직원 상세 정보
CREATE TABLE IF NOT EXISTS employee_details (
  id              uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  profile_id      uuid NOT NULL REFERENCES profiles(id) ON DELETE CASCADE,
  employee_no     text,
  department      text,
  position        text,
  employment_type text DEFAULT 'full_time',
  hire_date       date,
  base_salary     integer DEFAULT 0,
  resident_number text,
  bank_name       text,
  account_number  text,
  account_holder  text,
  created_at      timestamptz NOT NULL DEFAULT now(),
  updated_at      timestamptz,
  deleted_at      timestamptz,
  UNIQUE(profile_id)
);
CREATE INDEX IF NOT EXISTS idx_employee_details_profile_id ON employee_details(profile_id);
ALTER TABLE employee_details ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "employee_details_policy" ON employee_details;
CREATE POLICY "employee_details_policy" ON employee_details FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 2) 급여대장 (월별 헤더)
CREATE TABLE IF NOT EXISTS payroll_registers (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  year         integer NOT NULL,
  month        integer NOT NULL CHECK (month BETWEEN 1 AND 12),
  payment_date date,
  status       text DEFAULT 'draft' CHECK (status IN ('draft','confirmed','paid')),
  note         text,
  created_by   uuid REFERENCES profiles(id),
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz,
  UNIQUE(year, month)
);
ALTER TABLE payroll_registers ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_registers_policy" ON payroll_registers;
CREATE POLICY "payroll_registers_policy" ON payroll_registers FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 3) 급여명세서 (개인별)
CREATE TABLE IF NOT EXISTS payroll_slips (
  id                   uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id          uuid NOT NULL REFERENCES payroll_registers(id) ON DELETE CASCADE,
  employee_id          uuid NOT NULL REFERENCES employee_details(id),
  base_salary          integer DEFAULT 0,
  national_pension     integer DEFAULT 0,
  health_insurance     integer DEFAULT 0,
  employment_insurance integer DEFAULT 0,
  long_term_care       integer DEFAULT 0,
  income_tax           integer DEFAULT 0,
  local_income_tax     integer DEFAULT 0,
  health_adjustment    integer DEFAULT 0,
  care_adjustment      integer DEFAULT 0,
  other_deductions     integer DEFAULT 0,
  total_payment        integer DEFAULT 0,
  total_deduction      integer DEFAULT 0,
  net_payment          integer DEFAULT 0,
  created_at           timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_payroll_slips_register_id ON payroll_slips(register_id);
ALTER TABLE payroll_slips ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_slips_policy" ON payroll_slips;
CREATE POLICY "payroll_slips_policy" ON payroll_slips FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 4) 지출결의서
CREATE TABLE IF NOT EXISTS expense_claims (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_number  text,
  requester_id  uuid NOT NULL REFERENCES profiles(id),
  approver_id   uuid REFERENCES profiles(id),
  claim_date    date NOT NULL DEFAULT CURRENT_DATE,
  expense_date  date,
  purpose       text NOT NULL,
  account_code  text,
  total_amount  integer DEFAULT 0,
  status        text DEFAULT 'draft' CHECK (status IN ('draft','submitted','approved','rejected','paid')),
  reject_reason text,
  submitted_at  timestamptz,
  approved_at   timestamptz,
  paid_at       timestamptz,
  memo          text,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz,
  deleted_at    timestamptz
);
CREATE INDEX IF NOT EXISTS idx_expense_claims_requester_id ON expense_claims(requester_id);
CREATE INDEX IF NOT EXISTS idx_expense_claims_status ON expense_claims(status) WHERE deleted_at IS NULL;
ALTER TABLE expense_claims ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_claims_policy" ON expense_claims;
CREATE POLICY "expense_claims_policy" ON expense_claims FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 5) 지출결의서 항목
CREATE TABLE IF NOT EXISTS expense_claim_items (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  claim_id    uuid NOT NULL REFERENCES expense_claims(id) ON DELETE CASCADE,
  item_no     integer,
  description text NOT NULL,
  quantity    integer DEFAULT 1,
  unit_price  integer DEFAULT 0,
  amount      integer GENERATED ALWAYS AS (quantity * unit_price) STORED,
  note        text
);
ALTER TABLE expense_claim_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "expense_claim_items_policy" ON expense_claim_items;
CREATE POLICY "expense_claim_items_policy" ON expense_claim_items FOR ALL TO authenticated USING (true) WITH CHECK (true);
