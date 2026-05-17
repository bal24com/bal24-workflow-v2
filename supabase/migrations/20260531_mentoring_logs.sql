-- ============================================================
-- bal24 v2 — STEP-MENTOR-PORTAL-FULL
-- mentoring_logs: 멘토 포털에서 작성하는 멘토링 일지
-- (mentoring_sessions와 별개 — sessions는 PM이 등록하는 정식 회차)
-- ============================================================

create table if not exists public.mentoring_logs (
  id            uuid primary key default gen_random_uuid(),
  assignment_id uuid references public.mentoring_assignments(id) on delete cascade,
  program_id    uuid references public.programs(id) on delete cascade,
  log_date      date not null,
  session_no    integer default 1,                  -- 회차
  mentee_ids    jsonb default '[]'::jsonb,          -- 해당 일지의 멘티 UUID 목록
  content       text not null,                      -- 주요 내용
  next_plan     text,                               -- 다음 멘토링 계획
  created_at    timestamptz default now(),
  updated_at    timestamptz default now()
);

create index if not exists idx_mentoring_logs_assignment
  on public.mentoring_logs(assignment_id);
create index if not exists idx_mentoring_logs_program
  on public.mentoring_logs(program_id);

alter table public.mentoring_logs enable row level security;

-- 외부 비로그인 접근 (멘토 포털 토큰 기반 — anon 허용)
drop policy if exists "anon_read_mentoring_logs"   on public.mentoring_logs;
drop policy if exists "anon_insert_mentoring_logs" on public.mentoring_logs;
drop policy if exists "anon_update_mentoring_logs" on public.mentoring_logs;
drop policy if exists "auth_all_mentoring_logs"    on public.mentoring_logs;

create policy "anon_read_mentoring_logs"   on public.mentoring_logs for select to anon using (true);
create policy "anon_insert_mentoring_logs" on public.mentoring_logs for insert to anon with check (true);
create policy "anon_update_mentoring_logs" on public.mentoring_logs for update to anon using (true);
create policy "auth_all_mentoring_logs"    on public.mentoring_logs for all to authenticated using (true) with check (true);

-- 끝.
