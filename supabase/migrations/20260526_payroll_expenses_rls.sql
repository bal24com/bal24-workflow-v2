-- 박경수님 + SkyClaw — payroll_expenses RLS 정책 정비
-- 증상: "new row violates row-level security policy for table payroll_expenses"
-- 원인: UPDATE 정책 누락 → soft-delete (deleted_at 업데이트) 차단
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)

-- SELECT: 인증된 사용자 전체 조회 (휴지통 제외)
DROP POLICY IF EXISTS "payroll_expenses_select" ON payroll_expenses;
CREATE POLICY "payroll_expenses_select" ON payroll_expenses
  FOR SELECT TO authenticated
  USING (deleted_at IS NULL);

-- INSERT: 인증된 사용자 등록 허용
DROP POLICY IF EXISTS "payroll_expenses_insert" ON payroll_expenses;
CREATE POLICY "payroll_expenses_insert" ON payroll_expenses
  FOR INSERT TO authenticated
  WITH CHECK (auth.uid() IS NOT NULL);

-- UPDATE: 인증된 사용자 수정 + soft-delete 허용 (← 이게 없어서 오류)
DROP POLICY IF EXISTS "payroll_expenses_update" ON payroll_expenses;
CREATE POLICY "payroll_expenses_update" ON payroll_expenses
  FOR UPDATE TO authenticated
  USING (auth.uid() IS NOT NULL)
  WITH CHECK (auth.uid() IS NOT NULL);

-- DELETE: 하드 삭제는 사용 안 함 (soft-delete 사용). 필요 시 주석 해제.
-- DROP POLICY IF EXISTS "payroll_expenses_delete" ON payroll_expenses;
-- CREATE POLICY "payroll_expenses_delete" ON payroll_expenses
--   FOR DELETE TO authenticated
--   USING (auth.uid() IS NOT NULL);

-- 확인 — 정책 목록
SELECT polname, polcmd, polpermissive
FROM pg_policy
WHERE polrelid = 'payroll_expenses'::regclass
ORDER BY polname;
