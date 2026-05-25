-- bal24 v2 — program_staff_fees RLS 정책 (2026-05-25)
-- 박경수님 보고: "new row violates row-level security policy for table program_staff_fees"
-- 원인: RLS 가 켜져 있지만 INSERT/UPDATE/DELETE 정책이 없어서 모든 작업 차단.
-- 해결: v2 다른 테이블과 동일하게 'authenticated 전체 허용' 정책 추가.

-- 1. RLS 활성화 보장 (이미 켜져 있어도 안전)
ALTER TABLE program_staff_fees ENABLE ROW LEVEL SECURITY;

-- 2. 기존 정책 정리 (이름이 다른 정책이 있을 수 있어 안전하게 DROP)
DROP POLICY IF EXISTS "program_staff_fees_select" ON program_staff_fees;
DROP POLICY IF EXISTS "program_staff_fees_insert" ON program_staff_fees;
DROP POLICY IF EXISTS "program_staff_fees_update" ON program_staff_fees;
DROP POLICY IF EXISTS "program_staff_fees_delete" ON program_staff_fees;

-- 3. 로그인 사용자 모두에게 CRUD 허용 (v2 기본 정책 패턴)
CREATE POLICY "program_staff_fees_select"
  ON program_staff_fees FOR SELECT TO authenticated USING (true);

CREATE POLICY "program_staff_fees_insert"
  ON program_staff_fees FOR INSERT TO authenticated WITH CHECK (true);

CREATE POLICY "program_staff_fees_update"
  ON program_staff_fees FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);

CREATE POLICY "program_staff_fees_delete"
  ON program_staff_fees FOR DELETE TO authenticated USING (true);

-- 4. 확인 — 정책 4개가 보여야 함
SELECT policyname, cmd, qual, with_check
FROM pg_policies
WHERE tablename = 'program_staff_fees'
ORDER BY policyname;
