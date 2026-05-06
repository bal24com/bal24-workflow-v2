-- bal24 WorkFlow v2 — STEP 9-prep
-- tasks 테이블에 시작일(start_date) 컬럼 추가
-- idempotent: 이미 컬럼이 있으면 무시

alter table public.tasks
  add column if not exists start_date date;

comment on column public.tasks.start_date is '태스크 시작일 (선택). due_date 이전이어야 함 (앱 단 검증).';
