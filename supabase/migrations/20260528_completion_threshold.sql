-- ============================================================
-- bal24 v2 — STEP-TAB-RESTRUCTURE-B PART D
-- programs.completion_threshold (수료 기준 출석률) 동적 컬럼 추가
-- ============================================================

alter table public.programs
  add column if not exists completion_threshold integer default 80
  check (completion_threshold between 0 and 100);

-- 기존 row 안전망 — NULL이면 80으로 채움
update public.programs
  set completion_threshold = 80
  where completion_threshold is null;

-- 끝.
