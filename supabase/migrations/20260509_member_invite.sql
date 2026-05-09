-- bal24 v2 — STEP-MEMBER-INVITE 마이그레이션 (2026-05-09)
-- ADMIN 이 이메일로 팀원 초대 → 토큰 기반 외부 수락 페이지 → Auth 가입 + role 자동 배정.

-- ============================================================
-- 1. member_invitations 테이블
-- ============================================================
CREATE TABLE IF NOT EXISTS member_invitations (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  email         TEXT NOT NULL,
  role          TEXT NOT NULL DEFAULT 'staff',
  department    TEXT,
  position      TEXT,
  token         TEXT NOT NULL UNIQUE DEFAULT encode(gen_random_bytes(32), 'hex'),
  status        TEXT NOT NULL DEFAULT 'pending'
                  CHECK (status IN ('pending', 'accepted', 'expired')),
  invited_by    UUID REFERENCES profiles(id) ON DELETE SET NULL,
  accepted_at   TIMESTAMPTZ,
  expires_at    TIMESTAMPTZ NOT NULL DEFAULT (NOW() + INTERVAL '7 days'),
  created_at    TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at    TIMESTAMPTZ
);

-- ============================================================
-- 2. 인덱스
-- ============================================================
CREATE INDEX IF NOT EXISTS idx_member_invitations_email  ON member_invitations(email);
CREATE INDEX IF NOT EXISTS idx_member_invitations_token  ON member_invitations(token);
CREATE INDEX IF NOT EXISTS idx_member_invitations_status ON member_invitations(status);

-- ============================================================
-- 3. RLS
-- ============================================================
ALTER TABLE member_invitations ENABLE ROW LEVEL SECURITY;

-- ADMIN/PM: 전체 조회
DROP POLICY IF EXISTS "admin_pm_select" ON member_invitations;
CREATE POLICY "admin_pm_select" ON member_invitations
  FOR SELECT TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role IN ('admin', 'pm')
    )
  );

-- ADMIN 만 INSERT
DROP POLICY IF EXISTS "admin_insert" ON member_invitations;
CREATE POLICY "admin_insert" ON member_invitations
  FOR INSERT TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- ADMIN 만 UPDATE (취소·재발송)
DROP POLICY IF EXISTS "admin_update" ON member_invitations;
CREATE POLICY "admin_update" ON member_invitations
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM profiles
      WHERE id = auth.uid() AND role = 'admin'
    )
  );

-- 외부(anon): 토큰으로 단건 조회 (수락 페이지) — 만료 안 된 활성 초대만
DROP POLICY IF EXISTS "anon_token_select" ON member_invitations;
CREATE POLICY "anon_token_select" ON member_invitations
  FOR SELECT TO anon
  USING (token IS NOT NULL AND deleted_at IS NULL);
