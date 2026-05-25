-- bal24 v2 — 견적 항목에 프로그램 연결 + subtotal 3중 곱 재정의 (2026-05-25)
-- 박경수님 요청: 견적은 프로그램과 연동되어야 함 (1 프로젝트 : N 프로그램).

-- 1. headcount 컬럼 (이전 마이그레이션과 호환 — IF NOT EXISTS)
ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS headcount NUMERIC(7, 2) NOT NULL DEFAULT 1
  CHECK (headcount > 0);

-- 2. program_id FK 신규
ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS program_id UUID REFERENCES programs(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_estimate_items_program
  ON estimate_items(program_id) WHERE program_id IS NOT NULL;

-- 3. subtotal GENERATED 재정의 (unit_price × quantity × headcount 3중 곱)
ALTER TABLE estimate_items DROP COLUMN IF EXISTS subtotal;
ALTER TABLE estimate_items
  ADD COLUMN subtotal NUMERIC GENERATED ALWAYS AS (unit_price * quantity * headcount) STORED;

-- 4. 확인
SELECT id, program_id, category, unit_price, quantity, headcount, subtotal
FROM estimate_items ORDER BY created_at DESC LIMIT 5;
