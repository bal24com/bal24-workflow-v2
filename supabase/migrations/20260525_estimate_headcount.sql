-- bal24 v2 — 견적 항목에 수량(인원) 컬럼 추가 (2026-05-25)
-- 박경수님 요청: subtotal = unit_price × quantity × headcount (3중 곱)

ALTER TABLE estimate_items
  ADD COLUMN IF NOT EXISTS headcount NUMERIC(7, 2) NOT NULL DEFAULT 1
  CHECK (headcount > 0);

-- subtotal 이 GENERATED 컬럼인 경우 재정의 필요 (DB 환경마다 다를 수 있어 안전하게 DROP 후 재추가).
-- subtotal 이 일반 컬럼이면 트리거나 앱에서 계산. 이 마이그레이션은 컬럼만 추가하고
-- 계산은 앱(estimateUtils)에서 처리.

SELECT id, category, unit_price, quantity, headcount,
       unit_price * quantity * headcount AS calculated_total
FROM estimate_items
ORDER BY created_at DESC LIMIT 5;
