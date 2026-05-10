-- STEP-SURVEY — 만족도 문항·응답 (운영자 in-page 직접 입력형)
-- ============================================================
-- 기존 surveys / public_forms (외부 폼 발송) 와 별개. 운영자가 빠르게
-- 문항을 등록하고 참여자가 그 자리에서 응답하는 단순 모델.
-- ============================================================

-- 만족도 문항 정의
CREATE TABLE IF NOT EXISTS survey_questions (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  order_index   integer NOT NULL DEFAULT 0,
  question_text text NOT NULL,
  question_type text NOT NULL DEFAULT 'star'
                CHECK (question_type IN ('star', 'text')),
  phase         text NOT NULL DEFAULT 'post'
                CHECK (phase IN ('pre', 'post', 'both')),
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_questions_program
  ON survey_questions(program_id, order_index);

ALTER TABLE survey_questions ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_survey_questions" ON survey_questions;
CREATE POLICY "auth_all_survey_questions" ON survey_questions
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 만족도 응답
CREATE TABLE IF NOT EXISTS survey_responses (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id       uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  question_id      uuid NOT NULL REFERENCES survey_questions(id) ON DELETE CASCADE,
  respondent_token text,                                -- 외부 참여자 토큰 (nullable)
  respondent_id    uuid REFERENCES profiles(id),         -- 내부 사용자 (nullable)
  answer_score     integer CHECK (answer_score BETWEEN 1 AND 5),
  answer_text      text,
  phase            text NOT NULL CHECK (phase IN ('pre', 'post')),
  created_at       timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_survey_responses_program  ON survey_responses(program_id);
CREATE INDEX IF NOT EXISTS idx_survey_responses_question ON survey_responses(question_id);

ALTER TABLE survey_responses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "auth_all_survey_responses"  ON survey_responses;
DROP POLICY IF EXISTS "anon_insert_survey_responses" ON survey_responses;

CREATE POLICY "auth_all_survey_responses" ON survey_responses
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 외부 참여자 (anon) 응답 INSERT 허용 (token 검증은 앱 단)
CREATE POLICY "anon_insert_survey_responses" ON survey_responses
  FOR INSERT TO anon WITH CHECK (true);
