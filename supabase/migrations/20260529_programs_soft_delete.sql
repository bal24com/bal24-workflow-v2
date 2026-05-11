-- ============================================================
-- bal24 v2 — STEP-DASHBOARD-FIX
-- programs 테이블 soft-delete 지원 (deleted_at 컬럼)
-- ConsortiumDetailPage / DashboardKpis 등에서 이미 .is('deleted_at', null) 사용 중
-- 안전망: 컬럼이 없으면 add, 있으면 skip
-- ============================================================

alter table public.programs
  add column if not exists deleted_at timestamptz;

-- 휴지통 조회용 인덱스 (NULL 제외만)
create index if not exists idx_programs_deleted_at
  on public.programs(deleted_at)
  where deleted_at is not null;

-- 끝.
