-- bal24 WorkFlow v2 — 프로그램 상세 이식 (Q1 ②안)
-- Curriculum / Surveys 에 program_id 컬럼 추가.
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.
-- 이유: V2엔 /educations 메뉴가 없고 /programs 단일 운영. 기존 education_id 그대로 두고
--      program_id 를 추가해서 V2 ProgramDetailPage 에서 직접 join 가능하게 함.

alter table public.curriculum
  add column if not exists program_id uuid references public.programs(id) on delete cascade;

alter table public.surveys
  add column if not exists program_id uuid references public.programs(id) on delete cascade;

create index if not exists idx_curriculum_program_id on public.curriculum(program_id);
create index if not exists idx_surveys_program_id    on public.surveys(program_id);
