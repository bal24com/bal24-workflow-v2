-- bal24 WorkFlow v2 — STEP 17
-- schedule_events 테이블 (수동 등록 일정 전용)
-- 프로젝트/프로그램/태스크/출석 데이터는 코드 단에서 JOIN으로 가져옴.
-- 이 테이블은 미팅·마감·외부·개인·기타 이벤트만 저장.
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.

create table if not exists public.schedule_events (
  id           uuid primary key default gen_random_uuid(),
  title        text not null,
  event_date   date not null,
  start_time   time,
  end_time     time,
  all_day      boolean not null default false,
  category     text not null default 'etc'
                 check (category in ('meeting','deadline','external','personal','etc')),
  color        text default '#7C3AED',
  project_id   uuid references public.projects(id) on delete set null,
  program_id   uuid references public.programs(id) on delete set null,
  description  text,
  created_by   uuid references public.profiles(id) on delete set null,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create index if not exists idx_schedule_events_date
  on public.schedule_events(event_date);

alter table public.schedule_events enable row level security;

drop policy if exists "authenticated_all_schedule_events" on public.schedule_events;
create policy "authenticated_all_schedule_events"
  on public.schedule_events for all
  to authenticated
  using (true) with check (true);

comment on table public.schedule_events is '일정·캘린더 — 수동 등록 이벤트 (미팅·마감·외부·개인·기타). 자동 데이터는 코드 단 JOIN.';
