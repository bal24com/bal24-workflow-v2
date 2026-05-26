-- 박경수님 + SkyClaw STEP-INCOME-CONTRACT-FIX (2026-05-26)
-- 누락된 프로젝트 income_contracts 백필 — income_contracts 가 없는 프로젝트에 자동 생성
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)
-- 멱등성: 이미 존재하는 프로젝트는 skip (NOT EXISTS 절)

INSERT INTO income_contracts (
  id,
  project_id,
  contract_name,
  contract_amount,
  status,
  lifecycle_stage,
  vat_type,
  auto_created,
  created_at,
  updated_at
)
SELECT
  gen_random_uuid(),
  p.id,
  '[자동] ' || p.name,
  COALESCE(p.budget, 0),
  'draft',
  'proposal',
  '과세',
  true,
  NOW(),
  NOW()
FROM projects p
WHERE p.deleted_at IS NULL
  AND NOT EXISTS (
    SELECT 1 FROM income_contracts ic
    WHERE ic.project_id = p.id
      AND ic.deleted_at IS NULL
  );

-- 확인 — 백필 후 프로젝트별 계약 현황
SELECT
  p.name AS 프로젝트,
  p.status AS 단계,
  COALESCE(p.budget, 0) AS 사업비,
  (SELECT COUNT(*) FROM income_contracts WHERE project_id = p.id AND deleted_at IS NULL) AS 계약수,
  (SELECT SUM(contract_amount) FROM income_contracts WHERE project_id = p.id AND deleted_at IS NULL) AS 계약금액합
FROM projects p
WHERE p.deleted_at IS NULL
ORDER BY p.created_at DESC;
