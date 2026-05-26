-- ============================================================
-- bal24 v2 — STEP-STAFF-TOKEN-SIMPLIFY · 강사 포털 anon SELECT 보강
-- 박경수님 2026-05-26 — 박종재 강사 포털 진입 시 "담당 프로그램 0건" 증상.
--
-- 원인.
--   · staff_pool 만 anon SELECT 정책 있음.
--   · programs / program_curriculum / curriculum_staff / instructor_invitations /
--     mentoring_assignments 는 authenticated 만 허용 → 비로그인 강사 포털에선 빈 결과.
--
-- 처방.
--   · 강사 포털 (/staff-portal/:token) 이 읽는 모든 테이블에 anon SELECT 허용.
--   · 토큰을 알아야 자기 행을 식별할 수 있으므로 토큰 = 비밀번호 역할 (staff_pool 패턴과 동일).
--   · INSERT/UPDATE 는 이번 STEP 에서 풀지 않음 (필요 시 별도 STEP).
-- ============================================================

-- 1) programs — 강사 본인이 배정된 프로그램 메타.
ALTER TABLE public.programs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "programs_anon_read" ON public.programs;
CREATE POLICY "programs_anon_read"
  ON public.programs FOR SELECT TO anon USING (true);

-- 2) program_curriculum — 차시 (강사 배정·완료 여부 등).
ALTER TABLE public.program_curriculum ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "program_curriculum_anon_read" ON public.program_curriculum;
CREATE POLICY "program_curriculum_anon_read"
  ON public.program_curriculum FOR SELECT TO anon USING (true);

-- 3) curriculum_staff — 차시 ↔ 강사 매핑.
ALTER TABLE public.curriculum_staff ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "curriculum_staff_anon_read" ON public.curriculum_staff;
CREATE POLICY "curriculum_staff_anon_read"
  ON public.curriculum_staff FOR SELECT TO anon USING (true);

-- 4) instructor_invitations — 초빙 상태·프로그램 매핑.
ALTER TABLE public.instructor_invitations ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "instructor_invitations_anon_read" ON public.instructor_invitations;
CREATE POLICY "instructor_invitations_anon_read"
  ON public.instructor_invitations FOR SELECT TO anon USING (true);

-- 5) mentoring_assignments — 멘토링 배정.
ALTER TABLE public.mentoring_assignments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "mentoring_assignments_anon_read" ON public.mentoring_assignments;
CREATE POLICY "mentoring_assignments_anon_read"
  ON public.mentoring_assignments FOR SELECT TO anon USING (true);

-- 6) curriculum_materials — 강사 교안 자료 (자료 탭).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='curriculum_materials') THEN
    ALTER TABLE public.curriculum_materials ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "curriculum_materials_anon_read" ON public.curriculum_materials;
    CREATE POLICY "curriculum_materials_anon_read"
      ON public.curriculum_materials FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 7) curriculum_logs — 강의 일지 (일지 탭).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='curriculum_logs') THEN
    ALTER TABLE public.curriculum_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "curriculum_logs_anon_read" ON public.curriculum_logs;
    CREATE POLICY "curriculum_logs_anon_read"
      ON public.curriculum_logs FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 8) program_schedule_items — 일정 (일정 탭).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='program_schedule_items') THEN
    ALTER TABLE public.program_schedule_items ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "program_schedule_items_anon_read" ON public.program_schedule_items;
    CREATE POLICY "program_schedule_items_anon_read"
      ON public.program_schedule_items FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 9) staff_profile_files — PM 업로드 강사 프로필 파일 (자료→프로필 서브탭).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='staff_profile_files') THEN
    ALTER TABLE public.staff_profile_files ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "staff_profile_files_anon_read" ON public.staff_profile_files;
    CREATE POLICY "staff_profile_files_anon_read"
      ON public.staff_profile_files FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 10) mentoring_logs — 멘토링 일지 (멘토링 탭).
DO $$ BEGIN
  IF EXISTS (SELECT 1 FROM pg_tables WHERE schemaname='public' AND tablename='mentoring_logs') THEN
    ALTER TABLE public.mentoring_logs ENABLE ROW LEVEL SECURITY;
    DROP POLICY IF EXISTS "mentoring_logs_anon_read" ON public.mentoring_logs;
    CREATE POLICY "mentoring_logs_anon_read"
      ON public.mentoring_logs FOR SELECT TO anon USING (true);
  END IF;
END $$;

-- 11) profiles — 다른 강사·PM 이름 조회 (필요 시).
ALTER TABLE public.profiles ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "profiles_anon_read" ON public.profiles;
CREATE POLICY "profiles_anon_read"
  ON public.profiles FOR SELECT TO anon USING (true);

-- ============================================================
-- 검증 (수동 실행).
-- ============================================================
-- SELECT tablename, policyname FROM pg_policies
--  WHERE schemaname='public'
--    AND policyname LIKE '%anon_read%'
--  ORDER BY tablename;
-- → 11 개 정책 (또는 환경에 따라 일부 누락) 출력되어야 정상.
