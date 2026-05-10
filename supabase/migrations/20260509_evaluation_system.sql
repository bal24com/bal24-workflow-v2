-- bal24 v2 — STEP-EVALUATION-SYSTEM (2026-05-09)
-- 평가위원 배정 + 외부 평가 포털 + 점수 집계.

-- ============================================================
-- 1. program_evaluators — 프로그램별 평가위원
-- ============================================================
CREATE TABLE IF NOT EXISTS program_evaluators (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  staff_pool_id   UUID NOT NULL REFERENCES staff_pool(id) ON DELETE RESTRICT,
  /** 외부 평가 포털 토큰 (anon 접근) */
  eval_token      TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  /** 평가비 — program_staff_fees 와 일관 */
  fee_amount      NUMERIC(12, 0) NOT NULL DEFAULT 0 CHECK (fee_amount >= 0),
  fee_type        TEXT NOT NULL DEFAULT '3.3'
                    CHECK (fee_type IN ('3.3', '8.8', '면세')),
  status          TEXT NOT NULL DEFAULT 'invited'
                    CHECK (status IN ('invited', 'accepted', 'completed', 'declined')),
  invited_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  accepted_at     TIMESTAMPTZ,
  completed_at    TIMESTAMPTZ,
  note            TEXT,
  created_by      UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (program_id, staff_pool_id)
);

CREATE INDEX IF NOT EXISTS idx_program_evaluators_program_id ON program_evaluators(program_id);
CREATE INDEX IF NOT EXISTS idx_program_evaluators_eval_token  ON program_evaluators(eval_token);
CREATE INDEX IF NOT EXISTS idx_program_evaluators_status      ON program_evaluators(status);

-- ============================================================
-- 2. evaluation_scores — 평가 점수
-- ============================================================
CREATE TABLE IF NOT EXISTS evaluation_scores (
  id                    UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_evaluator_id  UUID NOT NULL REFERENCES program_evaluators(id) ON DELETE CASCADE,
  application_id        UUID NOT NULL REFERENCES participant_applications(id) ON DELETE CASCADE,
  /** 카테고리 한글 라벨 (UI 와 동일하게) */
  category              TEXT NOT NULL,
  score                 NUMERIC(5, 1) NOT NULL DEFAULT 0 CHECK (score >= 0),
  max_score             NUMERIC(5, 1) NOT NULL DEFAULT 100 CHECK (max_score > 0),
  comment               TEXT,
  created_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at            TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  -- 평가위원 + 신청자 + 카테고리 조합 UNIQUE → UPSERT 로 갱신
  UNIQUE (program_evaluator_id, application_id, category),
  CHECK (score <= max_score)
);

CREATE INDEX IF NOT EXISTS idx_evaluation_scores_evaluator   ON evaluation_scores(program_evaluator_id);
CREATE INDEX IF NOT EXISTS idx_evaluation_scores_application ON evaluation_scores(application_id);

-- ============================================================
-- 3. RLS — program_evaluators
-- ============================================================
ALTER TABLE program_evaluators ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "evaluators_select_auth"   ON program_evaluators;
DROP POLICY IF EXISTS "evaluators_insert_admin"  ON program_evaluators;
DROP POLICY IF EXISTS "evaluators_update_admin"  ON program_evaluators;
DROP POLICY IF EXISTS "evaluators_anon_token"    ON program_evaluators;

CREATE POLICY "evaluators_select_auth" ON program_evaluators
  FOR SELECT TO authenticated USING (true);

CREATE POLICY "evaluators_insert_admin" ON program_evaluators
  FOR INSERT TO authenticated WITH CHECK (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','pm'))
  );

CREATE POLICY "evaluators_update_admin" ON program_evaluators
  FOR UPDATE TO authenticated USING (
    EXISTS (SELECT 1 FROM profiles WHERE id = auth.uid() AND role IN ('admin','pm'))
  );

-- 외부 평가 포털: anon 토큰 기반 단건 조회 + UPDATE (status 'accepted' 표기용)
CREATE POLICY "evaluators_anon_token" ON program_evaluators
  FOR SELECT TO anon USING (eval_token IS NOT NULL);

DROP POLICY IF EXISTS "evaluators_anon_update_status" ON program_evaluators;
CREATE POLICY "evaluators_anon_update_status" ON program_evaluators
  FOR UPDATE TO anon USING (eval_token IS NOT NULL);

-- ============================================================
-- 4. RLS — evaluation_scores
-- ============================================================
ALTER TABLE evaluation_scores ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "scores_select_auth" ON evaluation_scores;
DROP POLICY IF EXISTS "scores_anon_insert" ON evaluation_scores;
DROP POLICY IF EXISTS "scores_anon_update" ON evaluation_scores;

CREATE POLICY "scores_select_auth" ON evaluation_scores
  FOR SELECT TO authenticated USING (true);

-- 외부 평가자가 anon 으로 INSERT/UPDATE — 토큰 검증은 앱 단에서.
CREATE POLICY "scores_anon_insert" ON evaluation_scores
  FOR INSERT TO anon WITH CHECK (true);

CREATE POLICY "scores_anon_update" ON evaluation_scores
  FOR UPDATE TO anon USING (true);
