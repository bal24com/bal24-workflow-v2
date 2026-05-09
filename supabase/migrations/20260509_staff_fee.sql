-- bal24 v2 — STEP-STAFF-FEE-TAX 마이그레이션 (2026-05-09)
-- 프로그램별 강사·전문가 지급 기준 + 원천징수 계산.

-- ============================================================
-- program_staff_fees — 프로그램별 강사·전문가 지급 기준
-- ============================================================
CREATE TABLE IF NOT EXISTS program_staff_fees (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  -- 강사 연결: staff_pool(외부 전문가) 또는 profiles(내부 직원) 중 하나
  expert_id       UUID REFERENCES staff_pool(id) ON DELETE SET NULL,
  profile_id      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  -- 활동 유형
  fee_type        TEXT NOT NULL CHECK (fee_type IN (
                    'education',    -- 교육 강의
                    'mentoring',    -- 멘토링
                    'consulting',   -- 컨설팅
                    'facilitation', -- 진행/퍼실리테이션
                    'etc'           -- 기타
                  )),
  -- 활동 세부 내용 (예: "오프라인 9/11", "컨벤션영어")
  description     TEXT,
  -- 단가 입력 방식
  input_mode      TEXT NOT NULL DEFAULT 'unit'
                    CHECK (input_mode IN ('unit', 'total')),
                  -- unit: unit_price × quantity 자동 계산
                  -- total: gross_amount 직접 입력
  unit_price      NUMERIC(12, 2) DEFAULT 0 CHECK (unit_price >= 0),
  quantity        NUMERIC(7, 2) DEFAULT 1 CHECK (quantity > 0),
  gross_amount    NUMERIC(12, 2) NOT NULL DEFAULT 0 CHECK (gross_amount >= 0),
  -- input_mode='unit'  → gross_amount = unit_price × quantity (앱에서 계산 후 저장)
  -- input_mode='total' → gross_amount 직접 입력
  -- 원천징수
  tax_type        TEXT NOT NULL DEFAULT '3.3'
                    CHECK (tax_type IN ('3.3', '8.8', '면세')),
  tax_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- 원 단위 절사
  net_amount      NUMERIC(12, 2) NOT NULL DEFAULT 0,  -- gross - tax
  -- 지급 상태
  payment_status  TEXT NOT NULL DEFAULT '미지급'
                    CHECK (payment_status IN ('미지급', '신고완료', '지급완료')),
  paid_at         DATE,   -- 지급 완료일
  note            TEXT,
  created_by      UUID REFERENCES profiles(id),
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 동일 프로그램·강사·활동유형 중복 방지
  UNIQUE (program_id, expert_id, fee_type),
  UNIQUE (program_id, profile_id, fee_type),
  -- expert_id 또는 profile_id 중 하나는 반드시 있어야 함
  CHECK (expert_id IS NOT NULL OR profile_id IS NOT NULL)
);

CREATE INDEX IF NOT EXISTS idx_program_staff_fees_program_id ON program_staff_fees(program_id);
CREATE INDEX IF NOT EXISTS idx_program_staff_fees_expert_id  ON program_staff_fees(expert_id);
CREATE INDEX IF NOT EXISTS idx_program_staff_fees_profile_id ON program_staff_fees(profile_id);
