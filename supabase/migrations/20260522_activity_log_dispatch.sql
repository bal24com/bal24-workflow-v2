-- bal24 WorkFlow v2 — activity_logs.log_type 'dispatch' 추가 (Stage 3-B-2-②)
-- 박경수님 추가 명세 #3: 전문가 활동일지 log_type='dispatch' 기본값.
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.

ALTER TABLE public.activity_logs
  DROP CONSTRAINT IF EXISTS activity_logs_log_type_check;

ALTER TABLE public.activity_logs
  ADD CONSTRAINT activity_logs_log_type_check
  CHECK (log_type IN ('mentoring', 'lecture', 'business_trip', 'ta', 'operation', 'dispatch'));
