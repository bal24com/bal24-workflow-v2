-- ============================================================
-- bal24 v2 — STEP-PORTAL-LECTURE-LOG-REDESIGN (박경수님 2026-05-26)
-- 강의일지(curriculum_logs) anon RLS 보강 + curriculum-photos 버킷 anon Storage 정책.
--
-- 강사 포털은 비로그인 anon 접근이므로 anon SELECT/INSERT/UPDATE 필요.
-- 기존 정책 (authenticated 전용) 은 유지하고 anon 정책만 추가.
-- ============================================================

-- 1) curriculum_logs anon RLS
ALTER TABLE public.curriculum_logs ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "curriculum_logs_anon_select" ON public.curriculum_logs;
CREATE POLICY "curriculum_logs_anon_select"
  ON public.curriculum_logs FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "curriculum_logs_anon_insert" ON public.curriculum_logs;
CREATE POLICY "curriculum_logs_anon_insert"
  ON public.curriculum_logs FOR INSERT TO anon WITH CHECK (true);

DROP POLICY IF EXISTS "curriculum_logs_anon_update" ON public.curriculum_logs;
CREATE POLICY "curriculum_logs_anon_update"
  ON public.curriculum_logs FOR UPDATE TO anon USING (true) WITH CHECK (true);

DROP POLICY IF EXISTS "curriculum_logs_anon_delete" ON public.curriculum_logs;
CREATE POLICY "curriculum_logs_anon_delete"
  ON public.curriculum_logs FOR DELETE TO anon USING (true);

-- 2) Storage 정책 — curriculum-photos 버킷 anon 업로드·삭제 허용
--    (멘토링 일지 mentoring-files 패턴과 동일)
DROP POLICY IF EXISTS "anon_upload_curriculum_photos" ON storage.objects;
CREATE POLICY "anon_upload_curriculum_photos"
  ON storage.objects FOR INSERT TO anon
  WITH CHECK (bucket_id = 'curriculum-photos');

DROP POLICY IF EXISTS "anon_delete_curriculum_photos" ON storage.objects;
CREATE POLICY "anon_delete_curriculum_photos"
  ON storage.objects FOR DELETE TO anon
  USING (bucket_id = 'curriculum-photos');

-- public read 는 버킷 자체 public 설정 또는 이미 존재하는 SELECT 정책으로 충당.
-- 필요 시 아래 추가.
DROP POLICY IF EXISTS "public_read_curriculum_photos" ON storage.objects;
CREATE POLICY "public_read_curriculum_photos"
  ON storage.objects FOR SELECT TO anon, authenticated
  USING (bucket_id = 'curriculum-photos');

-- 검증.
-- SELECT polname FROM pg_policy WHERE polrelid = 'public.curriculum_logs'::regclass;
-- SELECT polname FROM pg_policy WHERE polrelid = 'storage.objects'::regclass AND polname LIKE '%curriculum_photos%';
