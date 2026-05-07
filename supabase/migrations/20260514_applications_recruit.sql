-- bal24 WorkFlow v2 — STEP 11 옵션 B
-- 교육생 신청 + 강사·TA 모집 시스템
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.

-- ============================================================
-- 1. participant_applications (교육생 신청)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.participant_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  name  TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  birth_year TEXT,
  id_number_masked TEXT,
  gender TEXT CHECK (gender IN ('male','female','other')),
  address TEXT,
  organization TEXT,
  motivation TEXT,
  experience TEXT,
  privacy_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_agreed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied','reviewing','accepted','rejected','withdrawn','completed')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  attendance_rate NUMERIC(5,2),
  completed_at TIMESTAMPTZ,
  deleted_at TIMESTAMPTZ,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (program_id, phone)
);

ALTER TABLE public.participant_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "applications_public_insert" ON public.participant_applications;
CREATE POLICY "applications_public_insert" ON public.participant_applications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "applications_auth_all" ON public.participant_applications;
CREATE POLICY "applications_auth_all" ON public.participant_applications
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 2. recruit_forms (강사·TA 모집 공고)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recruit_forms (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id UUID REFERENCES public.programs(id) ON DELETE CASCADE,
  recruit_type TEXT NOT NULL CHECK (recruit_type IN ('instructor','ta','expert','mentor')),
  title TEXT NOT NULL,
  description TEXT,
  requirements TEXT,
  benefits    TEXT,
  deadline    DATE,
  max_count   INTEGER,
  form_token  TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  is_active   BOOLEAN DEFAULT TRUE,
  created_by  UUID REFERENCES public.profiles(id),
  created_at  TIMESTAMPTZ DEFAULT NOW(),
  updated_at  TIMESTAMPTZ DEFAULT NOW()
);

ALTER TABLE public.recruit_forms ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recruit_forms_public_read" ON public.recruit_forms;
CREATE POLICY "recruit_forms_public_read" ON public.recruit_forms
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "recruit_forms_auth_all" ON public.recruit_forms;
CREATE POLICY "recruit_forms_auth_all" ON public.recruit_forms
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 3. recruit_applications (지원자)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.recruit_applications (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  form_id UUID REFERENCES public.recruit_forms(id) ON DELETE CASCADE,
  name  TEXT NOT NULL,
  phone TEXT NOT NULL,
  email TEXT,
  career TEXT,
  portfolio_url TEXT,
  attachment_urls TEXT[],
  specialty TEXT[],
  available_dates TEXT,
  message TEXT,
  privacy_agreed BOOLEAN NOT NULL DEFAULT FALSE,
  privacy_agreed_at TIMESTAMPTZ,
  status TEXT NOT NULL DEFAULT 'applied'
    CHECK (status IN ('applied','reviewing','accepted','rejected')),
  reviewed_by UUID REFERENCES public.profiles(id),
  reviewed_at TIMESTAMPTZ,
  review_notes TEXT,
  created_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE (form_id, phone)
);

ALTER TABLE public.recruit_applications ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "recruit_apps_public_insert" ON public.recruit_applications;
CREATE POLICY "recruit_apps_public_insert" ON public.recruit_applications
  FOR INSERT WITH CHECK (true);

DROP POLICY IF EXISTS "recruit_apps_auth_all" ON public.recruit_applications;
CREATE POLICY "recruit_apps_auth_all" ON public.recruit_applications
  FOR ALL USING (auth.role() = 'authenticated');

-- ============================================================
-- 4. Storage 버킷: recruit-files (지원 서류, Public)
-- ============================================================
INSERT INTO storage.buckets (id, name, public)
VALUES ('recruit-files', 'recruit-files', true)
ON CONFLICT (id) DO NOTHING;

DROP POLICY IF EXISTS "recruit_files_public" ON storage.objects;
CREATE POLICY "recruit_files_public" ON storage.objects
  FOR SELECT USING (bucket_id = 'recruit-files');

DROP POLICY IF EXISTS "recruit_files_insert" ON storage.objects;
CREATE POLICY "recruit_files_insert" ON storage.objects
  FOR INSERT WITH CHECK (bucket_id = 'recruit-files');

COMMENT ON TABLE public.participant_applications IS '교육생 신청 — /apply/:programId 외부 공개 폼.';
COMMENT ON TABLE public.recruit_forms IS '강사·TA·전문가·멘토 모집 공고 — form_token 으로 외부 공유.';
COMMENT ON TABLE public.recruit_applications IS '모집 지원자 — /recruit/:token 외부 공개 폼.';
