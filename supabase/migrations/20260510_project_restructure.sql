-- STEP-PROJECT-RESTRUCTURE — projects 컬럼 + project_documents + final_report_*
-- ============================================================
-- 사용. Supabase SQL Editor 에서 직접 실행. 멱등 가능.
-- ============================================================

-- 1. projects 신규 컬럼
ALTER TABLE projects
  ADD COLUMN IF NOT EXISTS contract_amount  numeric(15,2),
  ADD COLUMN IF NOT EXISTS contract_type    text,
  ADD COLUMN IF NOT EXISTS duration_months  integer,
  ADD COLUMN IF NOT EXISTS source_doc_url   text,
  ADD COLUMN IF NOT EXISTS source_doc_type  text;

-- 2. 프로젝트 문서
CREATE TABLE IF NOT EXISTS project_documents (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id  uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  doc_type    text NOT NULL CHECK (doc_type IN ('estimate','operation_plan','deliverable','photo','other')),
  doc_stage   text NOT NULL DEFAULT 'active' CHECK (doc_stage IN ('sales','active','wrap')),
  file_name   text NOT NULL,
  file_url    text NOT NULL,
  file_size   integer,
  description text,
  category    text,
  created_by  uuid REFERENCES profiles(id),
  created_at  timestamptz DEFAULT now(),
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_project_documents_project ON project_documents(project_id);
CREATE INDEX IF NOT EXISTS idx_project_documents_type    ON project_documents(doc_type);

-- 3. 결과보고서 섹션
CREATE TABLE IF NOT EXISTS final_report_sections (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  project_id    uuid NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
  title         text NOT NULL,
  content       text,
  section_type  text NOT NULL CHECK (section_type IN (
    'text','auto_participants','auto_attendance','auto_expenses','photo_gallery'
  )),
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now(),
  updated_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_final_report_sections_project ON final_report_sections(project_id, display_order);

-- 4. 결과보고서 사진
CREATE TABLE IF NOT EXISTS final_report_photos (
  id            uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  section_id    uuid NOT NULL REFERENCES final_report_sections(id) ON DELETE CASCADE,
  file_url      text NOT NULL,
  caption       text,
  display_order integer NOT NULL DEFAULT 0,
  created_at    timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_final_report_photos_section ON final_report_photos(section_id, display_order);

-- 5. RLS
ALTER TABLE project_documents      ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_report_sections  ENABLE ROW LEVEL SECURITY;
ALTER TABLE final_report_photos    ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "project_documents_auth"      ON project_documents;
DROP POLICY IF EXISTS "final_report_sections_auth"  ON final_report_sections;
DROP POLICY IF EXISTS "final_report_photos_auth"    ON final_report_photos;

CREATE POLICY "project_documents_auth"     ON project_documents     FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "final_report_sections_auth" ON final_report_sections FOR ALL TO authenticated USING (true) WITH CHECK (true);
CREATE POLICY "final_report_photos_auth"   ON final_report_photos   FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. Storage 버킷
INSERT INTO storage.buckets (id, name, public)
VALUES ('project-docs', 'project-docs', false)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "project_docs_insert" ON storage.objects;
DROP POLICY IF EXISTS "project_docs_select" ON storage.objects;
DROP POLICY IF EXISTS "project_docs_update" ON storage.objects;
DROP POLICY IF EXISTS "project_docs_delete" ON storage.objects;

CREATE POLICY "project_docs_insert" ON storage.objects FOR INSERT TO authenticated WITH CHECK (bucket_id = 'project-docs');
CREATE POLICY "project_docs_select" ON storage.objects FOR SELECT TO authenticated USING      (bucket_id = 'project-docs');
CREATE POLICY "project_docs_update" ON storage.objects FOR UPDATE TO authenticated USING      (bucket_id = 'project-docs' AND auth.uid() = owner);
CREATE POLICY "project_docs_delete" ON storage.objects FOR DELETE TO authenticated USING      (bucket_id = 'project-docs' AND auth.uid() = owner);
