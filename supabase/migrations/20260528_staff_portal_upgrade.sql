-- 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN Phase1 (2026-05-28)
-- 강사 포털 4종 테이블 + Storage 안내 (박경수님 직접 실행)

-- ============================================================
-- 0) 공용 updated_at 트리거 함수 (이미 있으면 건너뜀)
-- ============================================================
CREATE OR REPLACE FUNCTION update_updated_at()
RETURNS TRIGGER LANGUAGE plpgsql AS $$
BEGIN NEW.updated_at = now(); RETURN NEW; END;
$$;

-- ============================================================
-- 1) curriculum_logs — 차시별 강의 일지 (강사 작성)
-- ============================================================
CREATE TABLE IF NOT EXISTS curriculum_logs (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL REFERENCES program_curriculum(id) ON DELETE CASCADE,
  program_id    uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES staff_pool(id) ON DELETE CASCADE,
  content       text,
  note          text,
  photos        jsonb NOT NULL DEFAULT '[]'::jsonb,
  -- photos 원소: {url, filename, size, caption, path, uploaded_at}
  status        text NOT NULL DEFAULT 'draft' CHECK (status IN ('draft','submitted')),
  submitted_at  timestamptz,
  created_at    timestamptz NOT NULL DEFAULT now(),
  updated_at    timestamptz NOT NULL DEFAULT now(),
  UNIQUE (curriculum_id, staff_id)
);

DROP TRIGGER IF EXISTS curriculum_logs_updated_at ON curriculum_logs;
CREATE TRIGGER curriculum_logs_updated_at
  BEFORE UPDATE ON curriculum_logs
  FOR EACH ROW EXECUTE FUNCTION update_updated_at();

ALTER TABLE curriculum_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "curriculum_logs_auth" ON curriculum_logs;
CREATE POLICY "curriculum_logs_auth" ON curriculum_logs
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_curriculum_logs_program ON curriculum_logs(program_id);
CREATE INDEX IF NOT EXISTS idx_curriculum_logs_staff   ON curriculum_logs(staff_id);

-- ============================================================
-- 2) program_schedule_items — 일정 단계별 항목
-- ============================================================
CREATE TABLE IF NOT EXISTS program_schedule_items (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  stage         text NOT NULL CHECK (stage IN ('pre_recruit','pre_prepare','running','post')),
  item_date     date NOT NULL,
  title         text NOT NULL,
  description   text,
  display_order int  NOT NULL DEFAULT 0,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_schedule_items_program ON program_schedule_items(program_id, stage, item_date);

ALTER TABLE program_schedule_items ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "program_schedule_items_auth" ON program_schedule_items;
CREATE POLICY "program_schedule_items_auth" ON program_schedule_items
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 3) staff_profile_files — 강사 프로필 파일 (PM 업로드)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_profile_files (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  staff_id     uuid NOT NULL REFERENCES staff_pool(id) ON DELETE CASCADE,
  program_id   uuid REFERENCES programs(id) ON DELETE SET NULL,
  file_url     text NOT NULL,
  file_name    text NOT NULL,
  file_size    int,
  storage_path text,
  uploaded_by  uuid REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_profile_files_staff   ON staff_profile_files(staff_id);
CREATE INDEX IF NOT EXISTS idx_staff_profile_files_program ON staff_profile_files(program_id);

ALTER TABLE staff_profile_files ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_profile_files_auth" ON staff_profile_files;
CREATE POLICY "staff_profile_files_auth" ON staff_profile_files
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 4) staff_materials — 강사 교안 파일 (강사 업로드)
-- ============================================================
CREATE TABLE IF NOT EXISTS staff_materials (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  curriculum_id uuid NOT NULL REFERENCES program_curriculum(id) ON DELETE CASCADE,
  program_id    uuid NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  staff_id      uuid NOT NULL REFERENCES staff_pool(id) ON DELETE CASCADE,
  file_url      text NOT NULL,
  file_name     text NOT NULL,
  file_size     int,
  storage_path  text,
  created_at    timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_staff_materials_curriculum ON staff_materials(curriculum_id);

ALTER TABLE staff_materials ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "staff_materials_auth" ON staff_materials;
CREATE POLICY "staff_materials_auth" ON staff_materials
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 5) Storage 버킷 (Dashboard → Storage 에서 직접 생성 필요)
-- ============================================================
-- ▸ curriculum-photos  : public, 10MB limit  (강의 일지 사진)
-- ▸ staff-profiles     : public, 50MB limit  (PM 업로드 강사 프로필)
-- ▸ staff-materials    : public, 50MB limit  (강사 교안 파일)

-- ============================================================
-- 6) 검증 (수동 실행)
-- ============================================================
-- SELECT to_regclass('public.curriculum_logs'), to_regclass('public.program_schedule_items'),
--        to_regclass('public.staff_profile_files'), to_regclass('public.staff_materials');
-- → 4개 모두 NULL 아닌 OID 출력되어야 정상
