-- ============================================================
-- bal24 v2 — STEP-PROGRAM-SURVEY (박경수님 2026-05-28)
-- 사전 수요조사 / 폼 응답 수집 — 프로그램별 token 발급 후 외부 링크 응답.
-- 이번 1건(2026 여수 해양·창업 동아리)부터 시작, 추후 다른 사업 재사용 가능.
-- ============================================================

-- 1) 폼 자체 (program_id 별 1~N개)
CREATE TABLE IF NOT EXISTS public.program_surveys (
  id              uuid primary key default gen_random_uuid(),
  program_id      uuid not null references public.programs(id) on delete cascade,
  -- 어떤 양식인지 식별 (예: 'yeosu-marine-startup-2026')
  survey_key      text not null,
  title           text not null,
  description     text,
  -- 외부 응답 토큰 (16자 hex)
  token           text not null unique,
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  closed_at       timestamptz
);

CREATE INDEX IF NOT EXISTS idx_program_surveys_program_id ON public.program_surveys(program_id);
CREATE INDEX IF NOT EXISTS idx_program_surveys_token      ON public.program_surveys(token);

-- 2) 응답 (jsonb로 자유 구조)
CREATE TABLE IF NOT EXISTS public.program_survey_responses (
  id              uuid primary key default gen_random_uuid(),
  survey_id       uuid not null references public.program_surveys(id) on delete cascade,
  -- 응답 식별 라벨 (예: '경호초 - 꿈틀꿈틀 해양 창업가')
  respondent_label text,
  -- 응답 본문 (질문·답변 jsonb)
  payload         jsonb not null,
  submitted_at    timestamptz not null default now(),
  -- 익명 신원 추적용 (선택)
  user_agent      text,
  ip_hash         text
);

CREATE INDEX IF NOT EXISTS idx_program_survey_responses_survey ON public.program_survey_responses(survey_id);
CREATE INDEX IF NOT EXISTS idx_program_survey_responses_submitted ON public.program_survey_responses(submitted_at DESC);

-- 3) RLS — 비로그인 응답자가 INSERT, 로그인한 PM/관리자는 SELECT
ALTER TABLE public.program_surveys           ENABLE ROW LEVEL SECURITY;
ALTER TABLE public.program_survey_responses  ENABLE ROW LEVEL SECURITY;

-- 폼 자체는 토큰 알면 누구나 조회 (응답 페이지에서 제목·설명 표시용)
DROP POLICY IF EXISTS "program_surveys anon select by token" ON public.program_surveys;
CREATE POLICY "program_surveys anon select by token"
  ON public.program_surveys FOR SELECT
  TO anon, authenticated
  USING (is_active = true);

-- 폼 관리는 로그인 사용자 전체 (RLS 세부 권한은 추후)
DROP POLICY IF EXISTS "program_surveys auth all" ON public.program_surveys;
CREATE POLICY "program_surveys auth all"
  ON public.program_surveys FOR ALL
  TO authenticated
  USING (true) WITH CHECK (true);

-- 응답은 anon insert OK (활성 폼만)
DROP POLICY IF EXISTS "program_survey_responses anon insert" ON public.program_survey_responses;
CREATE POLICY "program_survey_responses anon insert"
  ON public.program_survey_responses FOR INSERT
  TO anon, authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM public.program_surveys s
       WHERE s.id = program_survey_responses.survey_id
         AND s.is_active = true
    )
  );

-- 응답 조회는 로그인 사용자만
DROP POLICY IF EXISTS "program_survey_responses auth select" ON public.program_survey_responses;
CREATE POLICY "program_survey_responses auth select"
  ON public.program_survey_responses FOR SELECT
  TO authenticated
  USING (true);

-- 검증.
-- SELECT * FROM information_schema.tables WHERE table_name IN ('program_surveys','program_survey_responses');
