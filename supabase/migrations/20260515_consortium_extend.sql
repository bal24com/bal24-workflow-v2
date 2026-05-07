-- bal24 WorkFlow v2 — STEP-CON
-- 컨소시엄 독립 홈 7탭 구조 — DB 확장
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.

-- ============================================================
-- 1. consortiums 테이블 컬럼 추가
-- ============================================================
alter table public.consortiums
  add column if not exists project_id          uuid references public.projects(id) on delete set null,
  add column if not exists lead_client_id      uuid references public.clients(id),
  add column if not exists internal_manager_id uuid references public.profiles(id),
  add column if not exists total_budget        numeric(15,2) default 0,
  add column if not exists currency            text not null default 'KRW';

-- ============================================================
-- 2. consortium_members 테이블 (이미 존재 시 ALTER로 보강)
-- ============================================================
create table if not exists public.consortium_members (
  id              uuid primary key default gen_random_uuid(),
  consortium_id   uuid not null references public.consortiums(id) on delete cascade,
  client_id       uuid not null references public.clients(id),
  member_type     text not null default 'co'
                    check (member_type in ('lead','co','sub','observer')),
  task_share_pct  numeric(5,2) default 0
                    check (task_share_pct >= 0 and task_share_pct <= 100),
  allocated_budget numeric(15,2) default 0,
  spent_amount    numeric(15,2) default 0,
  contact_name    text,
  contact_email   text,
  contact_phone   text,
  portal_enabled  boolean not null default false,
  responsibilities text,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (consortium_id, client_id)
);

create index if not exists idx_consortium_members_consortium_id
  on public.consortium_members(consortium_id);

alter table public.consortium_members enable row level security;
drop policy if exists "authenticated_all" on public.consortium_members;
create policy "authenticated_all" on public.consortium_members
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 3. consortium_staff 테이블 (신규)
-- ============================================================
create table if not exists public.consortium_staff (
  id            uuid primary key default gen_random_uuid(),
  consortium_id uuid not null references public.consortiums(id) on delete cascade,
  expert_id     uuid not null references public.staff_pool(id),
  program_id    uuid references public.programs(id) on delete set null,
  role          text not null check (role in ('instructor','ta','facilitator','mentor','coordinator')),
  fee_type      text check (fee_type in ('education','mentoring','consulting','etc')),
  confirmed     boolean not null default false,
  notes         text,
  created_at    timestamptz not null default now(),
  unique (consortium_id, expert_id, role)
);

create index if not exists idx_consortium_staff_consortium_id
  on public.consortium_staff(consortium_id);

alter table public.consortium_staff enable row level security;
drop policy if exists "authenticated_all" on public.consortium_staff;
create policy "authenticated_all" on public.consortium_staff
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 4. tasks 테이블 — 컨소시엄 연결 컬럼 추가
-- ============================================================
alter table public.tasks
  add column if not exists consortium_id      uuid references public.consortiums(id) on delete cascade,
  add column if not exists assigned_client_id uuid references public.clients(id),
  add column if not exists share_pct          numeric(5,2) default 0;

create index if not exists idx_tasks_consortium_id on public.tasks(consortium_id);

-- ============================================================
-- 5. programs 테이블 — 컨소시엄 연결 컬럼 추가
-- ============================================================
alter table public.programs
  add column if not exists consortium_id uuid references public.consortiums(id) on delete set null;

create index if not exists idx_programs_consortium_id on public.programs(consortium_id);

-- ============================================================
-- 6. consortium_links 테이블 (외부 링크 허브)
-- ============================================================
create table if not exists public.consortium_links (
  id              uuid primary key default gen_random_uuid(),
  consortium_id   uuid not null references public.consortiums(id) on delete cascade,
  program_id      uuid references public.programs(id) on delete set null,
  link_type       text not null check (link_type in (
                    'apply','invite','attend','certificate',
                    'portal','report','settlement'
                  )),
  token           text not null unique default encode(gen_random_bytes(16),'hex'),
  url_path        text not null,
  label           text,
  is_active       boolean not null default true,
  expires_at      timestamptz,
  click_count     integer not null default 0,
  response_count  integer not null default 0,
  created_by      uuid references public.profiles(id),
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now()
);

create index if not exists idx_consortium_links_consortium_id
  on public.consortium_links(consortium_id);
create index if not exists idx_consortium_links_token
  on public.consortium_links(token);

alter table public.consortium_links enable row level security;
drop policy if exists "authenticated_manage" on public.consortium_links;
create policy "authenticated_manage" on public.consortium_links
  for all to authenticated using (true) with check (true);

drop policy if exists "anon_read_by_token" on public.consortium_links;
create policy "anon_read_by_token" on public.consortium_links
  for select to anon
  using (is_active = true and (expires_at is null or expires_at > now()));

-- ============================================================
-- 7. consortium_portal_permissions 테이블 (참여사 포털 권한)
-- ============================================================
create table if not exists public.consortium_portal_permissions (
  id              uuid primary key default gen_random_uuid(),
  consortium_id   uuid not null references public.consortiums(id) on delete cascade,
  member_id       uuid not null references public.consortium_members(id) on delete cascade,
  perm_overview   text not null default 'read'  check (perm_overview   in ('none','read','write','manage')),
  perm_programs   text not null default 'read'  check (perm_programs   in ('none','read','write','manage')),
  perm_tasks      text not null default 'read'  check (perm_tasks      in ('none','read','write','manage')),
  perm_finance    text not null default 'none'  check (perm_finance    in ('none','read','write','manage')),
  perm_staff      text not null default 'none'  check (perm_staff      in ('none','read','write','manage')),
  perm_links      text not null default 'none'  check (perm_links      in ('none','read','write','manage')),
  is_active       boolean not null default true,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (consortium_id, member_id)
);

alter table public.consortium_portal_permissions enable row level security;
drop policy if exists "authenticated_all" on public.consortium_portal_permissions;
create policy "authenticated_all" on public.consortium_portal_permissions
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 8. income/expenses 테이블 — consortium_id FK (박경수님 추가 SQL)
-- ============================================================
alter table public.income
  add column if not exists consortium_id uuid references public.consortiums(id) on delete set null;

alter table public.expenses
  add column if not exists consortium_id uuid references public.consortiums(id) on delete set null;

create index if not exists idx_income_consortium_id   on public.income(consortium_id);
create index if not exists idx_expenses_consortium_id on public.expenses(consortium_id);

-- ============================================================
-- 9. 해산 시 참여사 포털 권한 자동 해제 트리거
-- ============================================================
create or replace function revoke_portal_on_dissolve()
returns trigger language plpgsql as $$
begin
  if new.status = '해산' and old.status != '해산' then
    update public.consortium_portal_permissions
      set is_active = false, updated_at = now()
    where consortium_id = new.id;

    update public.consortium_members
      set portal_enabled = false, updated_at = now()
    where consortium_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_revoke_portal_on_dissolve on public.consortiums;
create trigger trg_revoke_portal_on_dissolve
  after update of status on public.consortiums
  for each row execute function revoke_portal_on_dissolve();

comment on table public.consortium_links is '컨소시엄 외부 공유 링크 허브 (apply·invite·attend·certificate·portal·report·settlement).';
comment on table public.consortium_portal_permissions is '참여사 포털 섹션별 권한 (perm_overview/programs/tasks/finance/staff/links).';
comment on table public.consortium_staff is '컨소시엄 배정 전문가 — staff_pool 원본 무변경.';
