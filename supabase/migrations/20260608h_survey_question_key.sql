-- bal24 WorkFlow v2 — 설문 응답 문항 정렬 버그 수정
-- 박경수님 2026-06-08 — 응답행에 문항 식별키가 없어 표시 순서가 어긋나는 문제.
--   question_key(폼 문항 id 'q_xxx')를 저장해 문항↔답변을 정확히 매핑. Supabase 실행. (멱등)

alter table public.survey_responses
  add column if not exists question_key text;

comment on column public.survey_responses.question_key is '폼 문항 식별키(SurveyFormQuestion.id) — 답변↔문항 정확 매핑용';
