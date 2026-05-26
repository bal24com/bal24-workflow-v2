-- 박경수님 + SkyClaw STEP-PAYROLL-DETAIL-COMMENT (2026-05-28)
-- payroll_expenses 항목에 댓글/대댓글 추가 — PM ↔ 재무담당자 소통용
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS payroll_comments (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  payroll_id  uuid NOT NULL REFERENCES payroll_expenses(id) ON DELETE CASCADE,
  parent_id   uuid REFERENCES payroll_comments(id) ON DELETE CASCADE,
  author_id   uuid NOT NULL REFERENCES profiles(id),
  content     text NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  updated_at  timestamptz,
  deleted_at  timestamptz
);

CREATE INDEX IF NOT EXISTS idx_payroll_comments_payroll_id ON payroll_comments(payroll_id);
CREATE INDEX IF NOT EXISTS idx_payroll_comments_parent_id ON payroll_comments(parent_id);

ALTER TABLE payroll_comments ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "payroll_comments_select" ON payroll_comments;
CREATE POLICY "payroll_comments_select" ON payroll_comments
  FOR SELECT TO authenticated USING (deleted_at IS NULL);

DROP POLICY IF EXISTS "payroll_comments_insert" ON payroll_comments;
CREATE POLICY "payroll_comments_insert" ON payroll_comments
  FOR INSERT TO authenticated WITH CHECK (auth.uid() = author_id);

DROP POLICY IF EXISTS "payroll_comments_update" ON payroll_comments;
CREATE POLICY "payroll_comments_update" ON payroll_comments
  FOR UPDATE TO authenticated USING (auth.uid() = author_id);

DROP POLICY IF EXISTS "payroll_comments_delete" ON payroll_comments;
CREATE POLICY "payroll_comments_delete" ON payroll_comments
  FOR DELETE TO authenticated USING (auth.uid() = author_id);

-- 확인
SELECT polname, polcmd FROM pg_policy WHERE polrelid = 'payroll_comments'::regclass ORDER BY polname;
