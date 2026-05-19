-- bal24 WorkFlow v2 — STEP-STAFF-PORTAL-P5
-- 차시별 강의 자료 업로드 테이블
--  · curriculum_materials (강사 본인 + PM 모두 업로드 가능)
--  · RLS: anon SELECT/INSERT 허용 (토큰 기반 접근)
-- 박경수님이 Supabase SQL Editor 에서 직접 실행 후 사이트 적용.

CREATE TABLE IF NOT EXISTS public.curriculum_materials (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id   UUID NOT NULL REFERENCES public.program_curriculum(id) ON DELETE CASCADE,
  uploader_id     UUID NOT NULL,
  uploader_source TEXT NOT NULL CHECK (uploader_source IN ('staff_pool','profile','pm')),
  file_name       TEXT NOT NULL,
  file_url        TEXT NOT NULL,
  file_size       BIGINT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS idx_curriculum_materials_curriculum
  ON public.curriculum_materials (curriculum_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_materials_uploader
  ON public.curriculum_materials (uploader_id, uploader_source);

ALTER TABLE public.curriculum_materials ENABLE ROW LEVEL SECURITY;
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='curriculum_materials' AND policyname='anon_read_curriculum_materials'
  ) THEN
    CREATE POLICY "anon_read_curriculum_materials"
      ON public.curriculum_materials FOR SELECT TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='curriculum_materials' AND policyname='anon_insert_curriculum_materials'
  ) THEN
    CREATE POLICY "anon_insert_curriculum_materials"
      ON public.curriculum_materials FOR INSERT TO anon WITH CHECK (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='curriculum_materials' AND policyname='anon_delete_curriculum_materials'
  ) THEN
    -- 업로더 본인이 삭제 가능 (uploader_id 매칭은 앱 측에서 확인)
    CREATE POLICY "anon_delete_curriculum_materials"
      ON public.curriculum_materials FOR DELETE TO anon USING (true);
  END IF;
  IF NOT EXISTS (
    SELECT 1 FROM pg_policies
    WHERE schemaname='public' AND tablename='curriculum_materials' AND policyname='auth_all_curriculum_materials'
  ) THEN
    CREATE POLICY "auth_all_curriculum_materials"
      ON public.curriculum_materials FOR ALL TO authenticated
      USING (true) WITH CHECK (true);
  END IF;
END $$;
