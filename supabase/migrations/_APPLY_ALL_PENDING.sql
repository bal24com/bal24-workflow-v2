-- ============================================================
-- bal24 v2 — 누적 미적용 마이그레이션 3개 일괄 적용 SQL
-- Supabase Studio → SQL Editor → 전체 복사 후 Run
-- ============================================================
-- 적용 후 이 파일은 삭제하셔도 됩니다 (개별 마이그레이션은 그대로 보관).
-- 모든 ALTER 문은 IF NOT EXISTS / IF EXISTS 가드 사용 — 재실행 안전.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) STEP-MENTORING-LOG-FORM (20260601)
--    mentoring_logs: 실제 멘토링 일지 양식 필드 추가
-- ─────────────────────────────────────────────
alter table public.mentoring_logs add column if not exists location   text;
alter table public.mentoring_logs add column if not exists start_time text;  -- HH:MM
alter table public.mentoring_logs add column if not exists end_time   text;  -- HH:MM


-- ─────────────────────────────────────────────
-- 2) STEP-STAFF-PORTAL-PIN (20260602)
--    staff_pool.portal_pin: 강사 포털 접속 PIN
-- ─────────────────────────────────────────────
alter table public.staff_pool
  add column if not exists portal_pin text;


-- ─────────────────────────────────────────────
-- 3) STEP-PARTICIPANTS-LIST-UPDATE (20260603)
--    program_participants: '미수료' 상태 + display_order 컬럼
-- ─────────────────────────────────────────────

-- 3-1) status check constraint 갱신
alter table public.program_participants
  drop constraint if exists program_participants_status_check;

alter table public.program_participants
  add constraint program_participants_status_check
  check (status in ('pending','active','completed','incomplete','dropped','inactive'));

-- 3-2) display_order 컬럼 (사용자 정의 ▲▼ 순서)
alter table public.program_participants
  add column if not exists display_order int default 0;

create index if not exists idx_program_participants_display_order
  on public.program_participants(program_id, display_order);


-- ============================================================
-- 검증 쿼리 (선택) — 정상 적용 확인용
-- ============================================================
-- 1) mentoring_logs 컬럼 확인
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='mentoring_logs'
--     and column_name in ('location','start_time','end_time');
--   -- 기대: 3행 반환

-- 2) staff_pool.portal_pin 확인
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='staff_pool'
--     and column_name = 'portal_pin';
--   -- 기대: 1행 반환

-- 3) program_participants.status 허용값 + display_order 확인
-- select conname, pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'program_participants_status_check';
--   -- 기대: check (status in ('pending','active','completed','incomplete','dropped','inactive'))

-- select column_name, data_type, column_default from information_schema.columns
--   where table_schema='public' and table_name='program_participants'
--     and column_name = 'display_order';
--   -- 기대: 1행 (int, default 0)

-- 끝.
