-- bal24 v2 — 기존 payroll_expenses 의 net_amount=0 데이터 보정 (박경수님 + SkyClaw)
-- 박경수님 환경에서 PaymentRequestFormModal payload 에 tax/net 누락으로 0 저장된 행 보정.
-- 박경수님 확인 후 직접 실행.

-- 1. 운영비 그룹 (tax_rate_type='10' 또는 운영비/운영인건비 prefix) — net = subtotal, tax = sub/11
UPDATE payroll_expenses
SET
  net_amount = subtotal,
  tax_amount = FLOOR(subtotal::numeric / 11)
WHERE
  net_amount = 0
  AND subtotal > 0
  AND (tax_rate_type = '10' OR expense_type LIKE '운영비%' OR expense_type LIKE '운영인건비%')
  AND deleted_at IS NULL;

-- 2. 인건비 그룹 (tax_rate_type='3.3') — tax = sub*3.3%, net = sub - tax
UPDATE payroll_expenses
SET
  tax_amount = FLOOR(subtotal::numeric * 0.033),
  net_amount = subtotal - FLOOR(subtotal::numeric * 0.033)
WHERE
  net_amount = 0
  AND subtotal > 0
  AND tax_rate_type = '3.3'
  AND deleted_at IS NULL;

-- 3. 인건비 그룹 (tax_rate_type='8.8') — tax = sub*8.8%, net = sub - tax
UPDATE payroll_expenses
SET
  tax_amount = FLOOR(subtotal::numeric * 0.088),
  net_amount = subtotal - FLOOR(subtotal::numeric * 0.088)
WHERE
  net_amount = 0
  AND subtotal > 0
  AND tax_rate_type = '8.8'
  AND deleted_at IS NULL;

-- 4. 면세/없음 — net = subtotal, tax = 0 (그대로)
UPDATE payroll_expenses
SET net_amount = subtotal
WHERE
  net_amount = 0
  AND subtotal > 0
  AND (tax_rate_type IN ('면세', '없음') OR tax_rate_type IS NULL)
  AND deleted_at IS NULL;

-- 확인
SELECT id, expense_type, tax_rate_type, subtotal, tax_amount, net_amount
FROM payroll_expenses
WHERE net_amount > 0 ORDER BY updated_at DESC LIMIT 10;
