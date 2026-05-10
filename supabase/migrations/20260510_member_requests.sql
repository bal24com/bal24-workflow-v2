-- 외부 사용자 팀 합류 신청 (Admin 검토 후 초대로 전환)

CREATE TABLE IF NOT EXISTS member_requests (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name        text NOT NULL,
  email       text NOT NULL,
  phone       text,
  department  text,
  position    text,
  message     text,
  status      text NOT NULL DEFAULT 'pending'
              CHECK (status IN ('pending', 'approved', 'rejected')),
  reviewed_by uuid REFERENCES profiles(id),
  reviewed_at timestamptz,
  reject_reason text,
  created_at  timestamptz DEFAULT now()
);

ALTER TABLE member_requests ENABLE ROW LEVEL SECURITY;

-- anon: INSERT 만 허용 (외부 신청서 제출)
DROP POLICY IF EXISTS "anon_insert_member_requests" ON member_requests;
CREATE POLICY "anon_insert_member_requests" ON member_requests
  FOR INSERT TO anon WITH CHECK (true);

-- 인증 사용자: 전체 조회/수정 허용 (Admin/PM 검토)
DROP POLICY IF EXISTS "auth_all_member_requests" ON member_requests;
CREATE POLICY "auth_all_member_requests" ON member_requests
  FOR ALL TO authenticated USING (true);
