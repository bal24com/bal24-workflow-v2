-- ============================================================
-- bal24 v2 — STEP-PROGRAM-ENHANCE-FULL
-- 1) program_curriculum RLS INSERT/UPDATE/DELETE 정책
-- 2) program_participants 컬럼 확장 (organization, phone, id_number, status)
-- 3) attendance_records 테이블 (차시별 출석)
-- 4) satisfaction_surveys.ai_report + chart_config
-- 5) program 단위 final_report_sections
-- ============================================================

-- 1. program_curriculum RLS 정책 — 403 Forbidden 수정
do $$
begin
  -- 기존 정책 삭제 후 재생성 (멱등)
  execute 'alter table public.program_curriculum enable row level security';
  execute 'drop policy if exists "program_curriculum_authenticated_all" on public.program_curriculum';
  execute 'create policy "program_curriculum_authenticated_all" on public.program_curriculum for all to authenticated using (true) with check (true)';
end $$;

-- 2. program_participants 컬럼 확장
alter table public.program_participants
  add column if not exists organization  text,
  add column if not exists phone         text,
  add column if not exists id_number     text;

-- 기존 status가 있을 수 있으므로 add column 후 check만 별도
alter table public.program_participants
  add column if not exists status text not null default 'active';
alter table public.program_participants
  drop constraint if exists program_participants_status_check;
alter table public.program_participants
  add constraint program_participants_status_check
  check (status in ('active','completed','dropped','pending'));

-- 3. 차시별 출석 기록 테이블 (STEP 11-B의 attendance_records와 별도 — 컬럼 충돌 회피)
--    기존 attendance_records: session_id 기반 (출석 체크인 토큰)
--    program_attendance_records: program_id + participant_id + day_label 기반 (AI 자동 처리)
create table if not exists public.program_attendance_records (
  id             uuid primary key default gen_random_uuid(),
  program_id     uuid not null references public.programs(id) on delete cascade,
  curriculum_id  uuid references public.program_curriculum(id) on delete set null,
  participant_id uuid references public.program_participants(id) on delete cascade,
  day_label      text,
  is_present     boolean not null default false,
  note           text,
  created_at     timestamptz not null default now()
);

create index if not exists idx_prog_attend_program     on public.program_attendance_records(program_id);
create index if not exists idx_prog_attend_participant on public.program_attendance_records(participant_id);
create index if not exists idx_prog_attend_day         on public.program_attendance_records(program_id, day_label);

alter table public.program_attendance_records enable row level security;
drop policy if exists "program_attendance_records_authenticated_all" on public.program_attendance_records;
create policy "program_attendance_records_authenticated_all" on public.program_attendance_records
  for all to authenticated using (true) with check (true);

-- 4. 만족도 — AI 리포트 + 차트 설정
alter table public.satisfaction_surveys
  add column if not exists ai_report    text,
  add column if not exists chart_config jsonb not null default '{}';

-- 5. program 단위 결과보고서 섹션 (project용 final_report_sections와 별도)
create table if not exists public.program_report_sections (
  id          uuid primary key default gen_random_uuid(),
  program_id  uuid not null references public.programs(id) on delete cascade,
  section_key text not null,                 -- 'overview' | 'outcomes' | 'curriculum' | 'attendance' | 'satisfaction' | 'extra'
  content     text,
  sort_order  int  not null default 0,
  updated_at  timestamptz not null default now(),
  unique (program_id, section_key)
);

create index if not exists idx_program_report_sections_program
  on public.program_report_sections(program_id);

alter table public.program_report_sections enable row level security;
drop policy if exists "program_report_sections_authenticated_all" on public.program_report_sections;
create policy "program_report_sections_authenticated_all" on public.program_report_sections
  for all to authenticated using (true) with check (true);

-- 끝.
