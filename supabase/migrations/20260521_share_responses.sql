-- bal24 WorkFlow v2 — 외부공유 응답 시스템 (Stage 3-B-2-①)
-- 박경수님 Q1 결정대로 분리 2 테이블 + 추가 명세 #1 program_share.survey_open_at 컬럼.
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.

-- ============================================================
-- 0. program_share — survey_open_at 컬럼 추가 (추가 명세 #1)
--    학생 만족도 노출 시점 PM이 직접 설정
-- ============================================================
ALTER TABLE public.program_share
  ADD COLUMN IF NOT EXISTS survey_open_at TIMESTAMPTZ;

-- ============================================================
-- 1. program_edit_requests — 고객 수정요청
-- ============================================================
CREATE TABLE IF NOT EXISTS public.program_edit_requests (
  id              UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id      UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  requester_name  TEXT NOT NULL,
  requester_phone TEXT,
  content         TEXT NOT NULL,
  status          TEXT NOT NULL DEFAULT 'pending'
                    CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  reviewed_by     UUID REFERENCES public.profiles(id),
  reviewed_at     TIMESTAMPTZ,
  review_note     TEXT,
  created_at      TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_edit_requests_program_id
  ON public.program_edit_requests(program_id);
CREATE INDEX IF NOT EXISTS idx_program_edit_requests_status
  ON public.program_edit_requests(status);

ALTER TABLE public.program_edit_requests ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_insert" ON public.program_edit_requests;
CREATE POLICY "public_insert" ON public.program_edit_requests
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all" ON public.program_edit_requests;
CREATE POLICY "auth_all" ON public.program_edit_requests
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. program_share_comments — 의견회신 댓글 (답글 1단계)
-- ============================================================
CREATE TABLE IF NOT EXISTS public.program_share_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.program_share_comments(id) ON DELETE CASCADE,
  author_role   TEXT NOT NULL CHECK (author_role IN ('client', 'staff')),
  author_name   TEXT NOT NULL,
  content       TEXT NOT NULL,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX IF NOT EXISTS idx_program_share_comments_program_id
  ON public.program_share_comments(program_id);
CREATE INDEX IF NOT EXISTS idx_program_share_comments_parent_id
  ON public.program_share_comments(parent_id);

ALTER TABLE public.program_share_comments ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "public_select" ON public.program_share_comments;
CREATE POLICY "public_select" ON public.program_share_comments
  FOR SELECT USING (true);
DROP POLICY IF EXISTS "public_insert" ON public.program_share_comments;
CREATE POLICY "public_insert" ON public.program_share_comments
  FOR INSERT WITH CHECK (true);
DROP POLICY IF EXISTS "auth_all" ON public.program_share_comments;
CREATE POLICY "auth_all" ON public.program_share_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
