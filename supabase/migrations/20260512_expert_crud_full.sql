-- ============================================================
-- bal24 v2 — STEP-EXPERT-CRUD-FULL
-- clients soft-delete + department
-- staff_pool soft-delete + 스키마 확장 (학력/경력/자격증/이력서)
-- ============================================================

-- 1. clients 테이블 확장
alter table public.clients
  add column if not exists department  text,
  add column if not exists deleted_at  timestamptz;

create index if not exists idx_clients_deleted_at
  on public.clients(deleted_at) where deleted_at is null;

-- 2. staff_pool 테이블 확장
alter table public.staff_pool
  add column if not exists staff_type        text,
  add column if not exists education_history jsonb not null default '[]',
  add column if not exists career_history    jsonb not null default '[]',
  add column if not exists certifications    jsonb not null default '[]',
  add column if not exists resume_url        text,
  add column if not exists deleted_at        timestamptz;

-- staff_type CHECK (주 역할 분류)
alter table public.staff_pool
  drop constraint if exists staff_pool_staff_type_check;
alter table public.staff_pool
  add constraint staff_pool_staff_type_check
  check (staff_type in ('강사','멘토','FT','TA','운영진','기타') or staff_type is null);

create index if not exists idx_staff_pool_deleted_at
  on public.staff_pool(deleted_at) where deleted_at is null;
create index if not exists idx_staff_pool_staff_type
  on public.staff_pool(staff_type) where deleted_at is null;

-- ============================================================
-- 3. database.ts 업데이트 (코드 측에서 처리)
--    clients: department?, deleted_at?
--    staff_pool: staff_type?, education_history, career_history,
--                certifications, resume_url?, deleted_at?
-- ============================================================

-- ============================================================
-- 4. 30일 자동 영구삭제 (pg_cron 사용 가능 시)
--    Supabase 프로 이상 플랜 또는 self-hosted 에서 사용 가능
--    미지원 환경이면 아래 블록 주석 유지하고 수동/Edge Function 으로 대체
-- ============================================================
/*
select cron.schedule(
  'purge-soft-deleted-30d',
  '0 3 * * *',   -- 매일 새벽 3시
  $$
    delete from public.clients    where deleted_at < now() - interval '30 days';
    delete from public.staff_pool where deleted_at < now() - interval '30 days';
  $$
);
*/

-- 끝.
