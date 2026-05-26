-- 박경수님 + SkyClaw STEP-CONSORTIUM-UPGRADE-FULL (2026-05-28)
-- 컨소시엄 역할 3분류 + 양방향 분기 + payroll 연동
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)

-- ============================================================
-- 1) consortiums 테이블 — lead_is_self 컬럼 추가
-- ============================================================
-- true  = 밸런스닷이 주관사 (광주대 → 밸런스닷 → 참여사)
-- false = 밸런스닷이 참여사 (광주대 → P&K → 밸런스닷 분배)
ALTER TABLE consortiums
  ADD COLUMN IF NOT EXISTS lead_is_self boolean NOT NULL DEFAULT true;

-- ============================================================
-- 2) consortium_members 테이블 — 역할 컬럼 추가
-- ============================================================
ALTER TABLE consortium_members
  ADD COLUMN IF NOT EXISTS is_self boolean NOT NULL DEFAULT false,
  ADD COLUMN IF NOT EXISTS role text NOT NULL DEFAULT 'partner';

-- 기존 role CHECK 제약 갱신 (있으면 제거 후 재생성)
ALTER TABLE consortium_members DROP CONSTRAINT IF EXISTS consortium_members_role_check;
ALTER TABLE consortium_members
  ADD CONSTRAINT consortium_members_role_check
  CHECK (role IN ('lead', 'partner'));

-- is_self=true 이면 client_id NULL 허용. is_self=false 이면 client_id 필수.
-- (SQL CHECK 으로 강제하지 않고 클라이언트 검증 — 기존 데이터 호환)

-- ============================================================
-- 3) payroll_expenses 테이블 — 컨소시엄 멤버 연결
-- ============================================================
ALTER TABLE payroll_expenses
  ADD COLUMN IF NOT EXISTS consortium_member_id uuid
    REFERENCES consortium_members(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_payroll_consortium_member
  ON payroll_expenses(consortium_member_id)
  WHERE consortium_member_id IS NOT NULL;

-- ============================================================
-- 4) RLS 정책 갱신 (consortium_members) — 인증 사용자 전체 (세부 권한은 RBAC 단)
-- ============================================================
DROP POLICY IF EXISTS "consortium_members_auth" ON consortium_members;
DROP POLICY IF EXISTS "authenticated_all"      ON consortium_members;
CREATE POLICY "consortium_members_auth" ON consortium_members
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 5) 기존 데이터 보정 (수동 확인 권장)
-- ============================================================
-- 기존 consortium_members 는 모두 partner / is_self=false 로 유지 (DEFAULT 적용)
-- 밸런스닷 자사 멤버가 이미 있으면 아래 UPDATE 로 수동 표시
-- UPDATE consortium_members SET is_self = true, role = 'lead' WHERE client_id IS NULL;

-- ============================================================
-- 6) 검증 쿼리 (수동 실행)
-- ============================================================
-- SELECT id, name, lead_is_self FROM consortiums LIMIT 5;
-- SELECT id, consortium_id, client_id, is_self, role FROM consortium_members LIMIT 10;
-- SELECT COUNT(*) FROM payroll_expenses WHERE consortium_member_id IS NOT NULL;
