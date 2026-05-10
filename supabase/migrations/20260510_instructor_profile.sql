-- STEP-INSTRUCTOR-INVITE-A — 강사 초대 시스템 확장
-- ============================================================
-- 1) instructor_invitations 컬럼 추가 (invite_message·session_info)
-- 2) instructor_profiles 신규 (외부 강사 자기 입력 정보 + 동의)
-- ============================================================

ALTER TABLE instructor_invitations
  ADD COLUMN IF NOT EXISTS invite_message text,
  ADD COLUMN IF NOT EXISTS session_info   text;

CREATE TABLE IF NOT EXISTS instructor_profiles (
  id                uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  invitation_id     uuid NOT NULL REFERENCES instructor_invitations(id) ON DELETE CASCADE,
  profile_id        uuid REFERENCES profiles(id) ON DELETE SET NULL,
  real_name         text NOT NULL,
  phone             text,
  email             text,
  id_number         text,
  bio               text,
  bank_name         text,
  bank_account      text,
  bank_holder       text,
  career_json       jsonb DEFAULT '[]',
  awards_json       jsonb DEFAULT '[]',
  photo_url         text,
  bankbook_url      text,
  id_card_url       text,
  lecture_file_url  text,
  privacy_agreed    boolean NOT NULL DEFAULT false,
  privacy_agreed_at timestamptz,
  submitted         boolean NOT NULL DEFAULT false,
  submitted_at      timestamptz,
  created_at        timestamptz NOT NULL DEFAULT now(),
  updated_at        timestamptz NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_instructor_profiles_invitation
  ON instructor_profiles(invitation_id);

ALTER TABLE instructor_profiles ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_instructor_profiles" ON instructor_profiles;
DROP POLICY IF EXISTS "anon_all_instructor_profiles" ON instructor_profiles;

CREATE POLICY "auth_all_instructor_profiles"
  ON instructor_profiles FOR ALL TO authenticated
  USING (true) WITH CHECK (true);

-- 외부 강사는 토큰으로 본인 프로필 작성 (token 검증은 앱 단)
CREATE POLICY "anon_all_instructor_profiles"
  ON instructor_profiles FOR ALL TO anon
  USING (true) WITH CHECK (true);
