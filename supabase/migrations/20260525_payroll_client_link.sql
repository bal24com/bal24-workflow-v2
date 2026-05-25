-- bal24 v2 — payroll_expenses 거래처 연계 (박경수님 요청 / SkyClaw 지시)
-- 박경수님 적용 전엔 코드가 client_id INSERT 시도 시 'column does not exist' 에러 → 친절 안내됨

ALTER TABLE payroll_expenses
  ADD COLUMN IF NOT EXISTS client_id UUID REFERENCES clients(id) ON DELETE SET NULL,
  ADD COLUMN IF NOT EXISTS biz_reg_no TEXT;

CREATE INDEX IF NOT EXISTS idx_payroll_expenses_client
  ON payroll_expenses(client_id) WHERE client_id IS NOT NULL;

-- tax_type / tax_amount / net_amount 는 이미 tax_rate_type / tax_amount / net_amount 로 존재. 추가 안 함.

SELECT id, expense_type, payee_name, client_id, biz_reg_no FROM payroll_expenses
ORDER BY created_at DESC LIMIT 5;
