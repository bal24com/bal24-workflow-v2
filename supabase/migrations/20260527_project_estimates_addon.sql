-- 박경수님 + SkyClaw STEP-ESTIMATE-ADDON-FULL (2026-05-27)
-- 견적서 제경비·기술료·부가세·최종금액 컬럼 추가
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)
-- 박경수님 환경 테이블명: project_estimates (가이드의 'estimates' 와 다름)

ALTER TABLE project_estimates
  ADD COLUMN IF NOT EXISTS use_overhead          boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS overhead_label        text         NOT NULL DEFAULT '제경비',
  ADD COLUMN IF NOT EXISTS overhead_rate         numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS use_tech_fee          boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS tech_fee_label        text         NOT NULL DEFAULT '기술료',
  ADD COLUMN IF NOT EXISTS tech_fee_rate         numeric(5,2) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS use_vat               boolean      NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS vat_rate              numeric(5,2) NOT NULL DEFAULT 10,
  ADD COLUMN IF NOT EXISTS final_proposal_amount numeric(15,2);

-- 확인 — 9개 컬럼 추가 확인
SELECT column_name, data_type, is_nullable, column_default
FROM information_schema.columns
WHERE table_name = 'project_estimates'
  AND column_name IN ('use_overhead', 'overhead_label', 'overhead_rate',
                      'use_tech_fee', 'tech_fee_label', 'tech_fee_rate',
                      'use_vat', 'vat_rate', 'final_proposal_amount')
ORDER BY column_name;
