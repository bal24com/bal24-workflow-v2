-- 박경수님 + SkyClaw STEP-ESTIMATE-UPGRADE-FULL PART C (2026-05-28)
-- 견적 부가세 포함 최종금액을 projects 에 반영 + income_contracts.contract_amount 동기화 준비
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)

-- 1) projects 테이블에 견적 부가세 정보 컬럼 추가
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS estimate_includes_vat boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS estimate_final_amount numeric(15,0);

-- 2) 기존 데이터 마이그레이션 — project_estimates 의 use_vat / final_proposal_amount 를 projects 로 복사
-- (project_estimates 가 프로젝트당 1행이라는 가정. n행이면 head 행만 채택)
WITH head_estimates AS (
  SELECT DISTINCT ON (project_id) project_id, use_vat, final_proposal_amount, total_amount
    FROM project_estimates
   WHERE deleted_at IS NULL
   ORDER BY project_id, created_at DESC
)
UPDATE projects p
   SET estimate_includes_vat = COALESCE(he.use_vat, false),
       estimate_final_amount = COALESCE(he.final_proposal_amount, he.total_amount)
  FROM head_estimates he
 WHERE he.project_id = p.id
   AND p.estimate_final_amount IS NULL;

-- 3) 검증 쿼리 (수동 실행)
-- SELECT id, name, budget, estimate_includes_vat, estimate_final_amount FROM projects WHERE estimate_final_amount IS NOT NULL LIMIT 5;
