-- bal24 WorkFlow v2 — attendance_sessions.learner_token 컬럼 DROP (Stage 11-②)
-- 박경수님 결정 옵션 A: student_token으로 통일.
-- ⚠️ 박경수님이 Supabase Dashboard 에서 직접 실행하셔야 합니다.
--    이미 발급된 learner_token URL은 무효화됨.

ALTER TABLE public.attendance_sessions
  DROP COLUMN IF EXISTS learner_token;
