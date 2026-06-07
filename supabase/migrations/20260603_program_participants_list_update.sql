-- ============================================================
-- bal24 v2 — STEP-PARTICIPANTS-LIST-UPDATE
-- 1) status check constraint에 'incomplete'(미수료) 추가
-- 2) display_order 컬럼 추가 (사용자 정의 순서 ▲▼)
-- ============================================================

-- 1. 상태값 check constraint 갱신 (기존: pending/active/completed/dropped)
alter table public.program_participants
  drop constraint if exists program_participants_status_check;

alter table public.program_participants
  add constraint program_participants_status_check
  check (status in ('pending','active','completed','incomplete','dropped','inactive'));

-- 2. display_order 컬럼 (사용자 정의 순서)
alter table public.program_participants
  add column if not exists display_order int default 0;

create index if not exists idx_program_participants_display_order
  on public.program_participants(program_id, display_order);

-- 끝.
