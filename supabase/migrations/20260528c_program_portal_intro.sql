-- ════════════════════════════════════════════════
-- STEP-PM-PORTAL-ADMIN · PART A (박경수님 2026-05-28)
-- programs.portal_intro JSONB — 포털 개요 정보 (운영주관·목적·일정·연락처).
-- ════════════════════════════════════════════════

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS portal_intro JSONB DEFAULT '{}'::jsonb;

-- portal_intro 구조 예시.
-- {
--   "operator":   "밸런스닷",
--   "purpose":    "청소년 창업 역량 강화",
--   "schedule":   "1차 5/13 · 2차 6월 · 3차 9월 · 4차 10월 · 성과공유회 11/9",
--   "pm_contact": "010-4433-2341 (박경수)",
--   "inquiry":    "전남교육청 창의융합교육과 061-XXX-XXXX"
-- }
