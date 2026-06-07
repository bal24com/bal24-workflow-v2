-- ============================================================
-- bal24 v2 — STEP-MENTORING-LOG-FORM
-- mentoring_logs: 실제 멘토링 일지 양식 필드 추가
-- (장소·시작시간·종료시간 — 진행시간은 start/end로 자동계산)
-- ============================================================

alter table public.mentoring_logs add column if not exists location   text;
alter table public.mentoring_logs add column if not exists start_time text;  -- HH:MM
alter table public.mentoring_logs add column if not exists end_time   text;  -- HH:MM

-- 끝.
