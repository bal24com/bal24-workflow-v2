-- ============================================================
-- bal24 v2 — STEP-TAGS-2B-3B
-- 박경수님 요청: 고객사·전문가 분류 태그 동적 관리
--   · clients.tags / staff_pool.tags (text[]) — 한 row 가 여러 태그 보유
--   · tag_categories — 관리자가 태그를 추가/삭제/순서변경
-- ============================================================

-- 1. clients.tags + staff_pool.tags 컬럼 추가
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

ALTER TABLE public.staff_pool
  ADD COLUMN IF NOT EXISTS tags text[] NOT NULL DEFAULT '{}'::text[];

CREATE INDEX IF NOT EXISTS idx_clients_tags ON public.clients USING GIN (tags);
CREATE INDEX IF NOT EXISTS idx_staff_pool_tags ON public.staff_pool USING GIN (tags);

-- 2. tag_categories — 관리자 관리 (scope='client' | 'staff')
CREATE TABLE IF NOT EXISTS public.tag_categories (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  scope       text NOT NULL CHECK (scope IN ('client', 'staff')),
  name        text NOT NULL,
  order_index integer NOT NULL DEFAULT 0,
  color       text, -- 옵션: '#7C3AED' 등
  created_by  uuid REFERENCES public.profiles(id),
  created_at  timestamptz DEFAULT now(),
  UNIQUE (scope, name)
);

CREATE INDEX IF NOT EXISTS idx_tag_categories_scope ON public.tag_categories(scope, order_index);

-- 3. 기본 태그 시드 (박경수님 요청 분류)
INSERT INTO public.tag_categories (scope, name, order_index) VALUES
  ('client', '주관기관', 0),
  ('client', '거래처',   1),
  ('client', '협력사',   2),
  ('staff',  '강사',     0),
  ('staff',  '멘토',     1),
  ('staff',  'FT',       2),
  ('staff',  'TA',       3),
  ('staff',  '운영진',   4),
  ('staff',  '기타',     5)
ON CONFLICT (scope, name) DO NOTHING;

-- 4. RLS
ALTER TABLE public.tag_categories ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "tag_categories_select_auth" ON public.tag_categories;
CREATE POLICY "tag_categories_select_auth"
  ON public.tag_categories FOR SELECT TO authenticated USING (true);

DROP POLICY IF EXISTS "tag_categories_admin_all" ON public.tag_categories;
CREATE POLICY "tag_categories_admin_all"
  ON public.tag_categories FOR ALL TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM public.profiles
       WHERE id = auth.uid()
         AND role IN ('admin', 'pm')
    )
  );

-- 5. 검증
SELECT scope, count(*) FROM public.tag_categories GROUP BY scope;

-- 끝.
