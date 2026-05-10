-- STEP-PROGRAM-BUNDLE — 프로그램 메뉴 복원에 따른 컬럼 보강
-- ============================================================
-- 1) programs 기관·부서·교육대상·정원 4 컬럼 추가
-- 2) program_curriculum 일자(day_label)·시작·종료 컬럼 추가 (start/end_time은 IF NOT EXISTS 안전)
-- ============================================================

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS client_org       text,   -- 기관/단체명
  ADD COLUMN IF NOT EXISTS department       text,   -- 부서
  ADD COLUMN IF NOT EXISTS target_audience  text,   -- 교육 대상
  ADD COLUMN IF NOT EXISTS max_participants integer; -- 정원

ALTER TABLE program_curriculum
  ADD COLUMN IF NOT EXISTS day_label  text,
  ADD COLUMN IF NOT EXISTS start_time text,
  ADD COLUMN IF NOT EXISTS end_time   text;
