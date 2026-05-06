-- bal24 WorkFlow v2 — STEP 10-A
-- clients 테이블 확장: 업태/종목, 담당자 정보, 사업자등록증 파일
-- 기존 phone/email은 일반(대표자) 연락처용으로 유지, 새로 만들어진 manager_* 컬럼이 담당자용
-- idempotent: add column if not exists

alter table public.clients
  add column if not exists business_type text,
  add column if not exists business_item text,
  add column if not exists manager_name text,
  add column if not exists manager_phone text,
  add column if not exists manager_email text,
  add column if not exists business_license_url text;

comment on column public.clients.business_type is '업태 (예: 도소매, 제조업, 서비스업)';
comment on column public.clients.business_item is '종목 (예: 교육서비스, 컨설팅)';
comment on column public.clients.manager_name is '실무 담당자명 (representative와 다를 수 있음)';
comment on column public.clients.manager_phone is '담당자 연락처';
comment on column public.clients.manager_email is '담당자 이메일';
comment on column public.clients.business_license_url is '사업자등록증 파일 URL (Storage: client-files 버킷)';

-- RLS — 인증 사용자에게 모든 권한 (clients는 RLS가 이미 켜져 있으면 idempotent)
alter table public.clients enable row level security;

drop policy if exists "clients_select_authenticated" on public.clients;
create policy "clients_select_authenticated"
  on public.clients for select to authenticated using (true);

drop policy if exists "clients_insert_authenticated" on public.clients;
create policy "clients_insert_authenticated"
  on public.clients for insert to authenticated with check (true);

drop policy if exists "clients_update_authenticated" on public.clients;
create policy "clients_update_authenticated"
  on public.clients for update to authenticated using (true) with check (true);

drop policy if exists "clients_delete_authenticated" on public.clients;
create policy "clients_delete_authenticated"
  on public.clients for delete to authenticated using (true);
