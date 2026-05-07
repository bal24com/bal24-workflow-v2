-- bal24 WorkFlow v2 — STEP 프로그램 수정 풀 페이지 (V7 NewEducationV9 이식)
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.
-- ============================================================
-- 1. programs 테이블 — V7 ③ 공지 / ④ 성과 목표 컬럼 추가
-- ============================================================
alter table public.programs
  add column if not exists notice       text,
  add column if not exists notice_files jsonb,
  add column if not exists goal_text    text;

-- ============================================================
-- 2. program_curriculum (차시별 일정)
-- ============================================================
create table if not exists public.program_curriculum (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  session_no   integer not null,
  title        text not null,
  content      text,
  session_date date,
  duration     integer,
  venue        text,
  created_at   timestamptz not null default now(),
  unique (program_id, session_no)
);
create index if not exists idx_program_curriculum_program_id
  on public.program_curriculum(program_id);

alter table public.program_curriculum enable row level security;
drop policy if exists "auth_all" on public.program_curriculum;
create policy "auth_all" on public.program_curriculum
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 3. curriculum_staff (차시당 인력 매칭)
-- ============================================================
create table if not exists public.curriculum_staff (
  id            uuid primary key default gen_random_uuid(),
  curriculum_id uuid not null references public.program_curriculum(id) on delete cascade,
  staff_pool_id uuid references public.staff_pool(id),
  profile_id    uuid references public.profiles(id),
  role          text not null check (role in ('강사','FT','멘토','TA','운영진')),
  fee           numeric(15,2),
  note          text,
  token         text unique not null default encode(gen_random_bytes(16),'hex'),
  status        text not null default 'pending'
                  check (status in ('pending','accepted','rejected')),
  responded_at  timestamptz,
  created_at    timestamptz not null default now(),
  -- staff_pool_id 와 profile_id 중 정확히 하나만 값 존재
  constraint curriculum_staff_one_source check (
    (staff_pool_id is not null) <> (profile_id is not null)
  )
);
create index if not exists idx_curriculum_staff_curriculum_id
  on public.curriculum_staff(curriculum_id);
create index if not exists idx_curriculum_staff_token
  on public.curriculum_staff(token);

alter table public.curriculum_staff enable row level security;

-- 외부 참여의사 페이지 (/curriculum-invite/:token) 접근용
drop policy if exists "public_read_by_token" on public.curriculum_staff;
create policy "public_read_by_token" on public.curriculum_staff
  for select using (true);

drop policy if exists "public_update_by_token" on public.curriculum_staff;
create policy "public_update_by_token" on public.curriculum_staff
  for update using (true) with check (true);

drop policy if exists "auth_all" on public.curriculum_staff;
create policy "auth_all" on public.curriculum_staff
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 4. report_sections (결과보고서 빌더 — Stage 2에서 사용)
-- ============================================================
create table if not exists public.report_sections (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  section_key  text not null,
  title        text not null,
  content      text,
  is_visible   boolean not null default true,
  sort_order   integer not null default 0,
  section_type text not null check (section_type in ('auto','custom')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);
create index if not exists idx_report_sections_program_id
  on public.report_sections(program_id);

alter table public.report_sections enable row level security;
drop policy if exists "auth_all" on public.report_sections;
create policy "auth_all" on public.report_sections
  for all to authenticated using (true) with check (true);
