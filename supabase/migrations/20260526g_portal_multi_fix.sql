-- ============================================================
-- bal24 v2 — STEP-PORTAL-MULTI-FIX (박경수님 2026-05-26)
-- 보안 A + PART A~G 통합 DB 변경.
-- ============================================================

-- ──────────────────────────────────────────────────────────
-- A. 보안 강화 — 평문 portal_pin → bcrypt portal_pin_hash 전환
-- ──────────────────────────────────────────────────────────
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 평문 PIN 보유 행 → 해시 백필 (20260607 이후에 등록된 신규 강사들도 안전하게 해시화)
UPDATE public.staff_pool
   SET portal_pin_hash = crypt(portal_pin, gen_salt('bf'))
 WHERE portal_pin IS NOT NULL
   AND portal_pin <> ''
   AND (portal_pin_hash IS NULL OR portal_pin_hash = '');

-- 평문 PIN 제거 (보안 — DB 노출 시에도 PIN 직접 노출 X)
UPDATE public.staff_pool
   SET portal_pin = NULL
 WHERE portal_pin IS NOT NULL;

-- anon 에게 portal_pin·portal_pin_hash 컬럼 SELECT 권한 차단 (DB 노출 방지).
--   Edge Function 은 SERVICE_ROLE 로 동작하므로 영향 없음.
REVOKE SELECT (portal_pin, portal_pin_hash, pin_fail_count, pin_locked_until)
  ON public.staff_pool FROM anon;
REVOKE SELECT (portal_pin, portal_pin_hash, pin_fail_count, pin_locked_until)
  ON public.staff_pool FROM authenticated;

-- ──────────────────────────────────────────────────────────
-- PART A — 멘토링 일지 사진 컬럼 (mentoring_logs 에 photo_urls jsonb)
-- ──────────────────────────────────────────────────────────
ALTER TABLE public.mentoring_logs
  ADD COLUMN IF NOT EXISTS photo_urls JSONB NOT NULL DEFAULT '[]'::jsonb;

-- ──────────────────────────────────────────────────────────
-- PART G — PM ↔ 강사 댓글 (portal_comments)
-- ──────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS public.portal_comments (
  id           uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  target_type  text NOT NULL
                 CHECK (target_type IN ('mentoring_log','curriculum_log','payroll_expense')),
  target_id    uuid NOT NULL,
  content      text NOT NULL,
  author_id    uuid REFERENCES public.profiles(id) ON DELETE SET NULL,
  author_name  text NOT NULL DEFAULT '',
  is_read      boolean NOT NULL DEFAULT false,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE public.portal_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_portal_comments" ON public.portal_comments;
CREATE POLICY "auth_all_portal_comments" ON public.portal_comments
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 강사 포털(anon): SELECT + UPDATE(is_read 만) 허용. INSERT/DELETE 차단.
DROP POLICY IF EXISTS "anon_select_portal_comments" ON public.portal_comments;
CREATE POLICY "anon_select_portal_comments" ON public.portal_comments
  FOR SELECT TO anon USING (true);

DROP POLICY IF EXISTS "anon_update_read_portal_comments" ON public.portal_comments;
CREATE POLICY "anon_update_read_portal_comments" ON public.portal_comments
  FOR UPDATE TO anon USING (true) WITH CHECK (true);

CREATE INDEX IF NOT EXISTS idx_portal_comments_target
  ON public.portal_comments(target_type, target_id);
CREATE INDEX IF NOT EXISTS idx_portal_comments_unread
  ON public.portal_comments(is_read) WHERE is_read = false;

-- updated_at 자동 갱신 트리거 (다른 테이블의 update_updated_at 함수 재사용)
DROP TRIGGER IF EXISTS portal_comments_updated_at ON public.portal_comments;
CREATE TRIGGER portal_comments_updated_at
  BEFORE UPDATE ON public.portal_comments
  FOR EACH ROW EXECUTE FUNCTION public.update_updated_at();

-- 검증.
-- SELECT COUNT(*) FROM staff_pool WHERE portal_pin IS NOT NULL;  -- 0 이어야 (평문 제거 완료)
-- SELECT to_regclass('public.portal_comments');  -- NULL 아니어야
-- SELECT column_name FROM information_schema.columns
--  WHERE table_name='mentoring_logs' AND column_name='photo_urls';
