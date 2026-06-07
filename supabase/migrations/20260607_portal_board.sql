-- 박경수님 2026-06-07 STEP-PORTAL-BOARD
-- 각 포털(수혜기관, 전문가 등)에서 자유롭게 글을 쓰고 파일을 업로드하는 게시판 테이블.

CREATE TABLE IF NOT EXISTS public.portal_posts (
  id                 UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  portal_id          UUID NOT NULL REFERENCES public.project_portals(id) ON DELETE CASCADE,
  beneficiary_org_id UUID REFERENCES public.portal_beneficiary_orgs(id) ON DELETE CASCADE,
  staff_id           UUID REFERENCES public.staff_pool(id) ON DELETE CASCADE,
  author_name        TEXT NOT NULL,
  author_role        TEXT NOT NULL, -- 'operator', 'beneficiary_org', 'staff'
  title              TEXT NOT NULL,
  content            TEXT NOT NULL,
  file_urls          JSONB NOT NULL DEFAULT '[]'::jsonb, -- Array of { url, name, size }
  is_notice          BOOLEAN NOT NULL DEFAULT false,
  created_at         TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_pp_portal ON public.portal_posts(portal_id);
CREATE INDEX IF NOT EXISTS idx_pp_org    ON public.portal_posts(beneficiary_org_id);
CREATE INDEX IF NOT EXISTS idx_pp_staff  ON public.portal_posts(staff_id);

ALTER TABLE public.portal_posts ENABLE ROW LEVEL SECURITY;

-- 1) 익명(외부 포털 사용자) 접근 허용
DROP POLICY IF EXISTS "anon_all_pp" ON public.portal_posts;
CREATE POLICY "anon_all_pp" ON public.portal_posts
  FOR ALL TO anon USING (true) WITH CHECK (true);

-- 2) 인증된 사용자(PM 등) 전체 접근 허용
DROP POLICY IF EXISTS "auth_all_pp" ON public.portal_posts;
CREATE POLICY "auth_all_pp" ON public.portal_posts
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
