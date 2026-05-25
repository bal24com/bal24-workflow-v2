-- bal24 v2 — payroll_expenses 위아래 이동 (수동 정렬) — 박경수님 요청

ALTER TABLE payroll_expenses
  ADD COLUMN IF NOT EXISTS order_index INTEGER NOT NULL DEFAULT 0;

-- 기존 row 의 order_index 초기화 (created_at 순)
WITH ordered AS (
  SELECT id, ROW_NUMBER() OVER (PARTITION BY program_id ORDER BY created_at) - 1 AS rn
  FROM payroll_expenses
  WHERE program_id IS NOT NULL
)
UPDATE payroll_expenses pe SET order_index = ordered.rn
FROM ordered WHERE pe.id = ordered.id;

SELECT id, expense_type, payee_name, order_index, program_id
FROM payroll_expenses WHERE program_id IS NOT NULL
ORDER BY program_id, order_index LIMIT 10;
