-- STEP-CURRICULUM-INSTRUCTOR-FIX — programs 삭제 시 하위 테이블 CASCADE 보장
-- ============================================================
-- 이미 CASCADE 설정된 경우 NO-OP. DROP CONSTRAINT IF EXISTS 로 안전 실행.
-- ============================================================

-- program_curriculum
ALTER TABLE program_curriculum
  DROP CONSTRAINT IF EXISTS program_curriculum_program_id_fkey;
ALTER TABLE program_curriculum
  ADD CONSTRAINT program_curriculum_program_id_fkey
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;

-- program_participants (STEP-PARTICIPANT-PORTAL)
ALTER TABLE program_participants
  DROP CONSTRAINT IF EXISTS program_participants_program_id_fkey;
ALTER TABLE program_participants
  ADD CONSTRAINT program_participants_program_id_fkey
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;

-- instructor_invitations
ALTER TABLE instructor_invitations
  DROP CONSTRAINT IF EXISTS instructor_invitations_program_id_fkey;
ALTER TABLE instructor_invitations
  ADD CONSTRAINT instructor_invitations_program_id_fkey
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;

-- survey_questions / survey_responses
ALTER TABLE survey_questions
  DROP CONSTRAINT IF EXISTS survey_questions_program_id_fkey;
ALTER TABLE survey_questions
  ADD CONSTRAINT survey_questions_program_id_fkey
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;

ALTER TABLE survey_responses
  DROP CONSTRAINT IF EXISTS survey_responses_program_id_fkey;
ALTER TABLE survey_responses
  ADD CONSTRAINT survey_responses_program_id_fkey
    FOREIGN KEY (program_id) REFERENCES programs(id) ON DELETE CASCADE;
