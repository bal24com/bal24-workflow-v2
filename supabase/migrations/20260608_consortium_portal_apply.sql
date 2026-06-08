-- bal24 WorkFlow v2 — 컨소시엄 역할별 외부 포털 적용
-- 박경수님 2026-06-08 — 포털 권한 테이블 생성 + 역할 링크 타입(supporter·beneficiary·team·staff) 허용
-- Supabase Dashboard SQL Editor 에서 그대로 실행하세요. (여러 번 실행해도 안전 — 멱등)

-- ============================================================
-- 1. consortium_links 테이블 (없으면 생성)
-- ============================================================
create table if not exists public.consortium_links (
  id              uuid primary key default gen_random_uuid(),
  consortium_id   uuid not null references public.consortiums(id) on delete cascade,
  program_id      uuid references public.programs(id) on delete set null,
  link_type       text not null,
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

-- link_type 체크 제약을 역할 포털 4종 포함으로 갱신 (기존 제약 있으면 교체)
alter table public.consortium_links
  drop constraint if exists consortium_links_link_type_check;
alter table public.consortium_links
  add constraint consortium_links_link_type_check
  check (link_type in (
    'apply','invite','attend','certificate','portal','report','settlement',
    'supporter','beneficiary','team','staff'
  ));

alter table public.consortium_links enable row level security;
drop policy if exists "authenticated_manage" on public.consortium_links;
create policy "authenticated_manage" on public.consortium_links
  for all to authenticated using (true) with check (true);

drop policy if exists "anon_read_by_token" on public.consortium_links;
create policy "anon_read_by_token" on public.consortium_links
  for select to anon
  using (is_active = true and (expires_at is null or expires_at > now()));

-- ============================================================
-- 2. consortium_portal_permissions 테이블 (없으면 생성)
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

-- 외부 포털 페이지(/share/{role}/:token)가 비로그인(anon)으로 읽을 수 있도록 허용
-- 컨소시엄·참여사·프로그램·태스크 조회를 위한 anon SELECT 정책
drop policy if exists "anon_read_consortiums" on public.consortiums;
create policy "anon_read_consortiums" on public.consortiums
  for select to anon using (true);

drop policy if exists "anon_read_consortium_members" on public.consortium_members;
create policy "anon_read_consortium_members" on public.consortium_members
  for select to anon using (true);

-- tasks 는 anon 읽기 정책이 없어 컨소시엄 포털 과업 현황이 비어 보이므로 추가
-- (programs 는 programs_anon_read 정책이 이미 존재)
drop policy if exists "anon_read_tasks" on public.tasks;
create policy "anon_read_tasks" on public.tasks
  for select to anon using (true);

-- ============================================================
-- 3. 해산 시 참여사 포털 권한 자동 해제 트리거
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
