-- ============================================================
-- bal24 v2 — 멘토링 일지 양식 보강 (박경수님 2026-05-26)
-- 박경수님 PDF 양식 (멘토링 상담일지) 에 "참여팀명" 항목 신규.
-- ============================================================

ALTER TABLE public.mentoring_logs
  ADD COLUMN IF NOT EXISTS team_name TEXT;

COMMENT ON COLUMN public.mentoring_logs.team_name IS '참여팀명 — 예) 1조 / 우리둥네수호대 (양식 [멘티] 행)';

-- 검증.
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='mentoring_logs' AND column_name='team_name';
