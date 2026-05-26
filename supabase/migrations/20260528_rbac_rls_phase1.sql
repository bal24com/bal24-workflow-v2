-- 박경수님 + SkyClaw STEP-RBAC-RLS-PHASE1 (2026-05-28)
-- 급여·직원 테이블 RLS 강화 (admin/finance 만 전체, 본인만 자기 데이터)
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)
-- ⚠️ 실행 전 백업: pg_dump 또는 Dashboard → Database → Backups

-- ============================================================
-- 0) 권한 헬퍼 함수 — RLS 정책 안에서 재사용
-- ============================================================
-- SECURITY DEFINER 로 profiles RLS 우회. 단순 role 조회만 수행.
CREATE OR REPLACE FUNCTION public.current_user_role()
RETURNS text
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT role FROM profiles WHERE id = auth.uid()
$$;

CREATE OR REPLACE FUNCTION public.is_finance_or_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_user_role() IN ('admin', 'finance')
$$;

CREATE OR REPLACE FUNCTION public.is_admin()
RETURNS boolean
LANGUAGE sql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
  SELECT current_user_role() = 'admin'
$$;

-- ============================================================
-- 1) employee_details — 직원 상세 (주민번호·계좌 포함)
-- ============================================================
-- 정책: SELECT 본인 + admin/finance, 변경은 admin/finance 만
DROP POLICY IF EXISTS "employee_details_policy"         ON employee_details;
DROP POLICY IF EXISTS "employee_details_select"         ON employee_details;
DROP POLICY IF EXISTS "employee_details_modify"         ON employee_details;

CREATE POLICY "employee_details_select" ON employee_details
  FOR SELECT TO authenticated
  USING ( profile_id = auth.uid() OR is_finance_or_admin() );

CREATE POLICY "employee_details_modify" ON employee_details
  FOR ALL TO authenticated
  USING      ( is_finance_or_admin() )
  WITH CHECK ( is_finance_or_admin() );

-- ============================================================
-- 2) payroll_registers — 월별 급여대장 (조직 단위)
-- ============================================================
-- 정책: admin/finance 만 전체 권한
DROP POLICY IF EXISTS "payroll_registers_policy" ON payroll_registers;
DROP POLICY IF EXISTS "payroll_registers_all"    ON payroll_registers;

CREATE POLICY "payroll_registers_all" ON payroll_registers
  FOR ALL TO authenticated
  USING      ( is_finance_or_admin() )
  WITH CHECK ( is_finance_or_admin() );

-- ============================================================
-- 3) payroll_slips — 개인별 급여명세서
-- ============================================================
-- 정책: SELECT 본인 + admin/finance, 변경은 admin/finance 만
DROP POLICY IF EXISTS "payroll_slips_policy" ON payroll_slips;
DROP POLICY IF EXISTS "payroll_slips_select" ON payroll_slips;
DROP POLICY IF EXISTS "payroll_slips_modify" ON payroll_slips;

CREATE POLICY "payroll_slips_select" ON payroll_slips
  FOR SELECT TO authenticated
  USING (
    is_finance_or_admin()
    OR EXISTS (
      SELECT 1 FROM employee_details ed
       WHERE ed.id = payroll_slips.employee_id
         AND ed.profile_id = auth.uid()
    )
  );

CREATE POLICY "payroll_slips_modify" ON payroll_slips
  FOR ALL TO authenticated
  USING      ( is_finance_or_admin() )
  WITH CHECK ( is_finance_or_admin() );

-- ============================================================
-- 4) expense_claims — 지출결의서 (작성자/승인자/재무)
-- ============================================================
-- 정책: 본인 작성·승인 건은 본인 SELECT, 그 외는 admin/finance
DROP POLICY IF EXISTS "expense_claims_policy"  ON expense_claims;
DROP POLICY IF EXISTS "expense_claims_select"  ON expense_claims;
DROP POLICY IF EXISTS "expense_claims_insert"  ON expense_claims;
DROP POLICY IF EXISTS "expense_claims_update"  ON expense_claims;
DROP POLICY IF EXISTS "expense_claims_delete"  ON expense_claims;

CREATE POLICY "expense_claims_select" ON expense_claims
  FOR SELECT TO authenticated
  USING (
    is_finance_or_admin()
    OR requester_id = auth.uid()
    OR approver_id  = auth.uid()
  );

-- 작성: 본인 명의로만 (requester_id = auth.uid())
CREATE POLICY "expense_claims_insert" ON expense_claims
  FOR INSERT TO authenticated
  WITH CHECK ( requester_id = auth.uid() OR is_finance_or_admin() );

-- 수정: draft 상태인 본인 작성 건 또는 admin/finance
CREATE POLICY "expense_claims_update" ON expense_claims
  FOR UPDATE TO authenticated
  USING      ( is_finance_or_admin() OR (requester_id = auth.uid() AND status = 'draft') )
  WITH CHECK ( is_finance_or_admin() OR (requester_id = auth.uid() AND status = 'draft') );

-- 삭제: admin/finance 만
CREATE POLICY "expense_claims_delete" ON expense_claims
  FOR DELETE TO authenticated
  USING ( is_finance_or_admin() );

-- ============================================================
-- 5) expense_claim_items — 지출결의서 항목 (claim 권한 상속)
-- ============================================================
DROP POLICY IF EXISTS "expense_claim_items_policy" ON expense_claim_items;
DROP POLICY IF EXISTS "expense_claim_items_all"    ON expense_claim_items;

CREATE POLICY "expense_claim_items_all" ON expense_claim_items
  FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM expense_claims ec
       WHERE ec.id = expense_claim_items.claim_id
         AND (
           is_finance_or_admin()
           OR ec.requester_id = auth.uid()
           OR ec.approver_id  = auth.uid()
         )
    )
  )
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM expense_claims ec
       WHERE ec.id = expense_claim_items.claim_id
         AND (
           is_finance_or_admin()
           OR (ec.requester_id = auth.uid() AND ec.status = 'draft')
         )
    )
  );

-- ============================================================
-- 6) 검증 쿼리 (수동 실행)
-- ============================================================
-- 박경수님 본인 계정에서 SELECT 가능한지 / member 계정에서 차단되는지 확인.
-- SELECT current_user_role();
-- SELECT is_finance_or_admin();
-- SELECT count(*) FROM payroll_registers;     -- admin/finance: 전체, 그 외: 0
-- SELECT count(*) FROM employee_details;      -- admin/finance: 전체, 본인: 1, 그 외: 0
