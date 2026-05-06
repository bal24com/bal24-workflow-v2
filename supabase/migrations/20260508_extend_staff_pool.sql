-- bal24 WorkFlow v2 — STEP 10-B
-- staff_pool에 소속/직책/프로필 사진 컬럼 추가
-- 기존 컬럼 재사용: bank_holder(예금주), id_number(주민등록번호)
-- 직전 20260508_client_contacts.sql에서 phone_mobile/phone_office/main_duties 추가됨

alter table public.staff_pool
  add column if not exists organization text,
  add column if not exists position text,
  add column if not exists profile_image_url text;

comment on column public.staff_pool.organization is '소속 (회사·기관)';
comment on column public.staff_pool.position is '직책';
comment on column public.staff_pool.profile_image_url is '프로필 사진 URL (Storage: expert-files 버킷)';

-- RLS — 인증 사용자에게 모든 권한 (idempotent)
alter table public.staff_pool enable row level security;

drop policy if exists "staff_pool_select_authenticated" on public.staff_pool;
create policy "staff_pool_select_authenticated" on public.staff_pool for select to authenticated using (true);

drop policy if exists "staff_pool_insert_authenticated" on public.staff_pool;
create policy "staff_pool_insert_authenticated" on public.staff_pool for insert to authenticated with check (true);

drop policy if exists "staff_pool_update_authenticated" on public.staff_pool;
create policy "staff_pool_update_authenticated" on public.staff_pool for update to authenticated using (true) with check (true);

drop policy if exists "staff_pool_delete_authenticated" on public.staff_pool;
create policy "staff_pool_delete_authenticated" on public.staff_pool for delete to authenticated using (true);
