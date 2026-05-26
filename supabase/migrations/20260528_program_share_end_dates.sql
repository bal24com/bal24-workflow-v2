-- 박경수님 + SkyClaw 2026-05-28 — program_share 4단계 종료일 컬럼 추가
-- 각 단계 (사전·준비·진행·결과) 마다 시작일·종료일 2개로 확장
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)

ALTER TABLE program_share
  ADD COLUMN IF NOT EXISTS pre_end_date      date,
  ADD COLUMN IF NOT EXISTS ready_end_date    date,
  ADD COLUMN IF NOT EXISTS progress_end_date date,
  ADD COLUMN IF NOT EXISTS result_end_date   date;

-- 검증 (수동 실행)
-- SELECT pre_date, pre_end_date, ready_date, ready_end_date,
--        progress_date, progress_end_date, result_date, result_end_date
--   FROM program_share LIMIT 5;
