-- ============================================================
-- bal24 v2 — STEP-STAFF-ASSIGNMENT-FEE
-- program_curriculum: 차시별 실제 강의 완료 체크 + 실제 강의자
-- ============================================================
-- expenses 컬럼(gross_amount, withholding_type, staff_fee_id 등)은 이미 존재.
-- 본 마이그레이션은 program_curriculum에 2개 컬럼만 추가.
-- ============================================================

alter table public.program_curriculum
  add column if not exists is_completed boolean default false;

alter table public.program_curriculum
  add column if not exists actual_instructor_id uuid;

-- 인덱스: 완료된 차시 조회 최적화
create index if not exists idx_program_curriculum_is_completed
  on public.program_curriculum(program_id, is_completed);

-- 끝.
