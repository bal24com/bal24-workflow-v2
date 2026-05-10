-- ============================================================
-- bal24 v2 — STEP-DELETE-RESUME-FULL
-- projects / consortiums soft-delete 컬럼 추가
-- ============================================================

-- 1. projects
alter table public.projects
  add column if not exists deleted_at timestamptz;

create index if not exists idx_projects_deleted_at
  on public.projects(deleted_at) where deleted_at is null;

-- 2. consortiums
alter table public.consortiums
  add column if not exists deleted_at timestamptz;

create index if not exists idx_consortiums_deleted_at
  on public.consortiums(deleted_at) where deleted_at is null;

-- ============================================================
-- 3. database.ts 업데이트 (코드 측 처리)
--    Project:     deleted_at?: string | null
--    Consortium:  deleted_at?: string | null
-- ============================================================

-- 끝.
