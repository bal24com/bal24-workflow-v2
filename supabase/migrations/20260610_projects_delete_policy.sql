-- ============================================================
-- bal24 v2 — STEP-TRASH-DELETE-FIX
-- projects 테이블 DELETE RLS 정책 누락 수정.
--
-- 박경수님 보고: 휴지통 → 프로젝트 영구삭제 시 "삭제됨" 메시지 나오지만
-- 실제로는 row 가 그대로 남아 있음 (silent fail).
--
-- 원인: 초기 스키마(20260506_step2_initial_schema.sql) 에서
--   projects_select / projects_insert / projects_update 정책만 만들고
--   projects_delete 가 누락됨. RLS enable 상태에서 정책 없으면
--   DELETE 가 0 rows affected 로 통과하지만 row 는 실제 안 지워짐.
--
-- 다른 테이블(clients/staff_pool/consortiums/programs)은 이미 DELETE 정책 보유.
-- ============================================================

DROP POLICY IF EXISTS "projects_delete" ON public.projects;
CREATE POLICY "projects_delete"
  ON public.projects FOR DELETE TO authenticated
  USING (auth.uid() IS NOT NULL);

-- 끝.
