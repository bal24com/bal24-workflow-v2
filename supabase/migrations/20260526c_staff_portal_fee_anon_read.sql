-- ============================================================
-- bal24 v2 — STEP-STAFF-PORTAL-FEE-TAB · 강사료 탭 anon SELECT 보강
-- 박경수님 2026-05-26 — 강사 포털 자료 → [강사료] 서브탭에서 payroll_expenses 조회.
--
-- 강사 포털은 비로그인 anon 접속이므로 payroll_expenses 에 anon SELECT 허용 필요.
-- staff_pool_id 컬럼으로 본인 행만 식별 (토큰을 알아야 자기 ID 알 수 있음).
-- ============================================================

ALTER TABLE public.payroll_expenses ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_expenses_anon_read" ON public.payroll_expenses;
CREATE POLICY "payroll_expenses_anon_read"
  ON public.payroll_expenses FOR SELECT TO anon USING (true);

-- 검증.
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.payroll_expenses'::regclass;
