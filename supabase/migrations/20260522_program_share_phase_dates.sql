-- bal24 WorkFlow v2 — program_share 4단계 시작일 컬럼 보강
-- 박경수님이 Supabase Dashboard에서 이미 실행한 SQL의 사후 보존본.
-- 20260520_program_share.sql 의 CREATE TABLE 이 IF NOT EXISTS 라서,
-- 박경수님이 이전에 실행한 버전에 pre_date 등 4개 날짜 컬럼이 누락된 경우 보강.

ALTER TABLE public.program_share
  ADD COLUMN IF NOT EXISTS pre_date      DATE,
  ADD COLUMN IF NOT EXISTS ready_date    DATE,
  ADD COLUMN IF NOT EXISTS progress_date DATE,
  ADD COLUMN IF NOT EXISTS result_date   DATE;
