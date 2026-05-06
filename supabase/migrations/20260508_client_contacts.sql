-- bal24 WorkFlow v2 — STEP 10-A 재설계
-- 단일 manager_* 컬럼 → 별도 client_contacts 테이블로 정규화 (N:1)
-- staff_pool에 휴대폰/사무실/주요업무 컬럼 추가

-- ───────────────────────────────────────────────
-- 1) clients: 직전 단일 manager_* 컬럼 정리 (있으면 드롭)
-- ───────────────────────────────────────────────
alter table public.clients
  drop column if exists manager_name,
  drop column if exists manager_phone,
  drop column if exists manager_email;

-- 2) clients: 누락 컬럼 추가 (idempotent)
--    - representative, address, bank_name, bank_account, business_number, note는 이미 존재
--    - 폼 라벨: 대표자명(representative) / 메모(note)
alter table public.clients
  add column if not exists business_type text,
  add column if not exists business_item text,
  add column if not exists business_license_url text;

comment on column public.clients.business_type is '업태 (예: 도소매, 제조업, 서비스업)';
comment on column public.clients.business_item is '종목 (예: 교육서비스, 컨설팅)';
comment on column public.clients.business_license_url is '사업자등록증 파일 URL (Storage: client-files 버킷)';

-- 3) clients RLS (idempotent)
alter table public.clients enable row level security;

drop policy if exists "clients_select_authenticated" on public.clients;
create policy "clients_select_authenticated" on public.clients for select to authenticated using (true);

drop policy if exists "clients_insert_authenticated" on public.clients;
create policy "clients_insert_authenticated" on public.clients for insert to authenticated with check (true);

drop policy if exists "clients_update_authenticated" on public.clients;
create policy "clients_update_authenticated" on public.clients for update to authenticated using (true) with check (true);

drop policy if exists "clients_delete_authenticated" on public.clients;
create policy "clients_delete_authenticated" on public.clients for delete to authenticated using (true);


-- ───────────────────────────────────────────────
-- 4) client_contacts 테이블 (N:1 — 한 고객사에 여러 담당자)
-- ───────────────────────────────────────────────
create table if not exists public.client_contacts (
  id uuid primary key default gen_random_uuid(),
  client_id uuid not null references public.clients(id) on delete cascade,
  name text not null,
  position text,
  main_duties text,
  phone_mobile text,
  phone_office text,
  email text,
  linked_profile_id uuid references public.profiles(id) on delete set null,
  created_at timestamptz default now()
);

create index if not exists idx_client_contacts_client_id on public.client_contacts(client_id);
create index if not exists idx_client_contacts_linked_profile on public.client_contacts(linked_profile_id);

comment on table public.client_contacts is '고객사 담당자. 한 고객사에 여러 명 등록 가능.';
comment on column public.client_contacts.linked_profile_id is '내부직원(profiles) 매칭 — 선택사항';

alter table public.client_contacts enable row level security;

drop policy if exists "client_contacts_select_authenticated" on public.client_contacts;
create policy "client_contacts_select_authenticated" on public.client_contacts for select to authenticated using (true);

drop policy if exists "client_contacts_insert_authenticated" on public.client_contacts;
create policy "client_contacts_insert_authenticated" on public.client_contacts for insert to authenticated with check (true);

drop policy if exists "client_contacts_update_authenticated" on public.client_contacts;
create policy "client_contacts_update_authenticated" on public.client_contacts for update to authenticated using (true) with check (true);

drop policy if exists "client_contacts_delete_authenticated" on public.client_contacts;
create policy "client_contacts_delete_authenticated" on public.client_contacts for delete to authenticated using (true);


-- ───────────────────────────────────────────────
-- 5) staff_pool 확장
-- ───────────────────────────────────────────────
alter table public.staff_pool
  add column if not exists phone_mobile text,
  add column if not exists phone_office text,
  add column if not exists main_duties text;

comment on column public.staff_pool.phone_mobile is '휴대폰. 기존 phone 컬럼은 레거시로 유지.';
comment on column public.staff_pool.phone_office is '사무실 번호';
comment on column public.staff_pool.main_duties is '주요 업무 / 전문 분야 요약';
