-- STEP-CURRICULUM-INSTRUCTOR-MATCH — 미매칭 강사명 원본 보존 컬럼
-- ============================================================
-- AI 추출된 강사명을 인력풀(staff_pool·profiles)에 매칭 실패한 경우
-- 원본 텍스트를 보존하여 사용자가 후속 [강사 요청]에 활용.
-- ============================================================

ALTER TABLE program_curriculum
  ADD COLUMN IF NOT EXISTS instructor_name_raw text;
