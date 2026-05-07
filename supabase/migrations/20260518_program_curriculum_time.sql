-- bal24 WorkFlow v2 — 커리큘럼 차시 시작/종료 시간 컬럼 추가 (Stage 3-A)
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.
-- V7 스타일 시간 picker (시작·종료 분리) 운영을 위해 추가.
-- duration 컬럼은 그대로 유지 (자동 계산 또는 수동 입력 fallback).

alter table public.program_curriculum
  add column if not exists start_time time,
  add column if not exists end_time   time;
