-- ============================================================
-- bal24 v2 — STEP-PROGRAM-UX-B
-- satisfaction_surveys.ai_analysis jsonb 추가 (overall/strengths/improvements/keywords/recommendation)
-- program_report_sections.sort_order는 20260512_program_enhance.sql에 이미 존재
-- ============================================================

alter table public.satisfaction_surveys
  add column if not exists ai_analysis jsonb;

-- 안전망: program_report_sections.sort_order 미존재 환경 대응 (idempotent)
alter table public.program_report_sections
  add column if not exists sort_order integer not null default 0;

-- 끝.
