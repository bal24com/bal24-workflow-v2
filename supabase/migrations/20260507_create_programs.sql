-- bal24 WorkFlow v2 — STEP 9
-- programs 테이블 생성 (educations보다 상위의 우산 엔티티)
-- 유형: 교육 / 캠프 / 행사 / 기타
-- 상태: 준비 / 진행 / 완료 / 취소

create table if not exists public.programs (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete set null,
  name text not null,
  type text not null default '교육' check (type in ('교육','캠프','행사','기타')),
  status text not null default '준비' check (status in ('준비','진행','완료','취소')),
  start_date date,
  end_date date,
  venue text,
  capacity int,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create index if not exists idx_programs_project_id on public.programs(project_id);
create index if not exists idx_programs_status on public.programs(status);
create index if not exists idx_programs_type on public.programs(type);

-- RLS — 인증된 사용자에게 모든 권한
alter table public.programs enable row level security;

drop policy if exists "programs_select_authenticated" on public.programs;
create policy "programs_select_authenticated"
  on public.programs for select
  to authenticated
  using (true);

drop policy if exists "programs_insert_authenticated" on public.programs;
create policy "programs_insert_authenticated"
  on public.programs for insert
  to authenticated
  with check (true);

drop policy if exists "programs_update_authenticated" on public.programs;
create policy "programs_update_authenticated"
  on public.programs for update
  to authenticated
  using (true) with check (true);

drop policy if exists "programs_delete_authenticated" on public.programs;
create policy "programs_delete_authenticated"
  on public.programs for delete
  to authenticated
  using (true);

comment on table public.programs is '프로그램 (교육·캠프·행사·기타). project와 N:1 관계로 선택 연결.';
