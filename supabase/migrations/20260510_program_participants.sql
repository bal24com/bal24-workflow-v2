-- STEP-PARTICIPANT-PORTAL — 참여자 통합 토큰 시스템
-- ============================================================
-- 교육생·멘토·고객사·TA·참관 단일 테이블. V2 기존 students /
-- form_applications / instructor_invitations 와 별개로 운영.
-- ============================================================

CREATE TABLE IF NOT EXISTS program_participants (
  id               uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id       uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  profile_id       uuid REFERENCES profiles(id) ON DELETE SET NULL,
  name             text NOT NULL,
  email            text,
  phone            text,
  role             text NOT NULL DEFAULT 'participant'
    CHECK (role IN ('participant','mentor','client','ta','observer')),
  access_token     text UNIQUE NOT NULL DEFAULT gen_random_uuid()::text,
  token_expires_at timestamptz,
  status           text NOT NULL DEFAULT 'active'
    CHECK (status IN ('active','inactive','completed')),
  completed_at     timestamptz,
  memo             text,
  created_by       uuid REFERENCES profiles(id),
  created_at       timestamptz NOT NULL DEFAULT now(),
  updated_at       timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_participants_program ON program_participants(program_id);
CREATE INDEX IF NOT EXISTS idx_program_participants_token   ON program_participants(access_token);
CREATE INDEX IF NOT EXISTS idx_program_participants_status  ON program_participants(status);

ALTER TABLE program_participants ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_program_participants"    ON program_participants;
DROP POLICY IF EXISTS "anon_select_program_participants" ON program_participants;

CREATE POLICY "auth_all_program_participants"
  ON program_participants FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 외부 참여자가 토큰으로 본인 정보 조회 (token 검증은 앱 단)
CREATE POLICY "anon_select_program_participants"
  ON program_participants FOR SELECT TO anon
  USING (true);
