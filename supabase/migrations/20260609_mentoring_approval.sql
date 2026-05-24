-- ============================================================
-- bal24 v2 — STEP-MENTORING-P3-APPROVE
-- 멘토링 일지 승인 워크플로 + 도장/사인 컬럼 + RLS 잠금.
-- SkyClaw 지시문 보정:
--   · v2 mentoring_logs는 expert_id 없음 (assignment_id 기반) + 강사 anon 접근
--   · 따라서 auth.uid() 매칭 대신 status 조건만으로 잠금
--   · 기존 정책 실제 이름: anon_update_mentoring_logs / auth_all_mentoring_logs
--   · role 비교 소문자 (CLAUDE.md "ROLE-NORMALIZE")
-- ============================================================

-- SQL-A: 도장/사인 URL 컬럼
ALTER TABLE public.staff_pool
  ADD COLUMN IF NOT EXISTS signature_url TEXT;
ALTER TABLE public.profiles
  ADD COLUMN IF NOT EXISTS signature_url TEXT;

-- SQL-B: Storage 'signatures' 버킷 (Public)
INSERT INTO storage.buckets (id, name, public)
VALUES ('signatures', 'signatures', true)
ON CONFLICT (id) DO NOTHING;

DO $$ BEGIN
  CREATE POLICY "public_read_signatures"
    ON storage.objects FOR SELECT TO public USING (bucket_id = 'signatures');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "anon_upload_signatures"
    ON storage.objects FOR INSERT TO anon WITH CHECK (bucket_id = 'signatures');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

DO $$ BEGIN
  CREATE POLICY "auth_all_signatures"
    ON storage.objects FOR ALL TO authenticated
    USING (bucket_id = 'signatures') WITH CHECK (bucket_id = 'signatures');
EXCEPTION WHEN duplicate_object THEN NULL; END $$;

-- SQL-C: mentoring_logs RLS — 승인된 일지는 anon UPDATE 차단
-- 기존 정책 (20260531 시점에 생성된 실제 이름) 교체
DROP POLICY IF EXISTS "anon_update_mentoring_logs" ON public.mentoring_logs;

CREATE POLICY "anon_update_non_approved_mentoring_logs"
  ON public.mentoring_logs
  FOR UPDATE TO anon
  USING (status IN ('draft', 'submitted', 'rejected'))
  WITH CHECK (status IN ('draft', 'submitted', 'rejected', 'approved'));
-- WITH CHECK 에 'approved' 포함: PM이 anon으로 못 들어오지만,
-- 강사가 submitted 인 row를 자기가 'approved' 로 못 바꾸게 USING은 status IN (draft/submitted/rejected).
-- 즉 anon은 approved row를 USING에서 차단당해 update 불가.

-- authenticated (PM/ADMIN) 는 어떤 status든 update 가능. 기존 auth_all_mentoring_logs 정책 유지.
-- 추가: ADMIN/PM role 만 승인 처리 가능하도록 별도 정책 (옵션 — 일반 STAFF가 다른 강사 일지 못 만지게)
DROP POLICY IF EXISTS "pm_approve_mentoring_logs" ON public.mentoring_logs;
CREATE POLICY "pm_approve_mentoring_logs"
  ON public.mentoring_logs
  FOR UPDATE TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
      WHERE id = auth.uid()
        AND role IN ('admin', 'pm')
    )
  );

-- 끝.
