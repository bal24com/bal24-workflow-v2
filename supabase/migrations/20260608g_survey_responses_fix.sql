-- bal24 WorkFlow v2 — 설문 응답 제출 실패 긴급 수정
-- 박경수님 2026-06-08 — survey_responses 가 옛 만족도 스키마라 신규 설문 코드의
--   insert(form_id·respondent_role·phase=kind·question_id null)가 제약 위반으로 전부 실패.
--   필요한 컬럼 추가 + 과도한 제약 완화. Supabase SQL Editor 실행. (멱등)

-- 1) 코드가 사용하는 컬럼 보강 (없으면 추가)
alter table public.survey_responses
  add column if not exists program_id       uuid,
  add column if not exists form_id          uuid,
  add column if not exists question_id      uuid,
  add column if not exists respondent_token text,
  add column if not exists respondent_role  text,
  add column if not exists answer_text      text,
  add column if not exists answer_score     integer,
  add column if not exists phase            text,
  add column if not exists created_at       timestamptz default now();

-- 2) 과도한 제약 완화
--    question_id: 동적 설문은 문항행을 form 순서로 저장 → null 허용
alter table public.survey_responses alter column question_id drop not null;
--    phase: ('pre','post') CHECK 제거 + NOT NULL 해제 (form.kind 자유 텍스트)
alter table public.survey_responses drop constraint if exists survey_responses_phase_check;
alter table public.survey_responses alter column phase drop not null;
--    answer_score: 1~5 CHECK 제거 (숫자 응답 자유)
alter table public.survey_responses drop constraint if exists survey_responses_answer_score_check;

-- 3) RLS — anon 응답 INSERT + 인증 사용자 전체
alter table public.survey_responses enable row level security;
drop policy if exists "anon_insert_survey_responses" on public.survey_responses;
create policy "anon_insert_survey_responses" on public.survey_responses
  for insert to anon with check (true);
drop policy if exists "auth_all_survey_responses" on public.survey_responses;
create policy "auth_all_survey_responses" on public.survey_responses
  for all to authenticated using (true) with check (true);

create index if not exists idx_survey_responses_form on public.survey_responses(form_id);
