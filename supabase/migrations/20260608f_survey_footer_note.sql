-- bal24 WorkFlow v2 — 설문 하단 안내문
-- 박경수님 2026-06-08 — program_survey_forms 에 하단 안내문 컬럼 추가. Supabase SQL Editor 실행. (멱등)

alter table public.program_survey_forms
  add column if not exists footer_note text;

comment on column public.program_survey_forms.footer_note is '설문 하단 안내문 (문항 아래·제출 버튼 위 표시)';
