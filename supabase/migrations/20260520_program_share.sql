-- bal24 WorkFlow v2 — 프로그램 외부공유 4단계×3대상 (Stage 3-B-1)
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.
-- programs 1:1 program_share + 4 날짜 + 3 토큰 + visibility jsonb.

CREATE TABLE IF NOT EXISTS public.program_share (
  program_id     UUID PRIMARY KEY REFERENCES public.programs(id) ON DELETE CASCADE,
  pre_date       DATE,
  ready_date     DATE,
  progress_date  DATE,
  result_date    DATE,
  client_token   TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  student_token  TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  expert_token   TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16), 'hex'),
  visibility     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_program_share_client_token  ON public.program_share(client_token);
CREATE INDEX IF NOT EXISTS idx_program_share_student_token ON public.program_share(student_token);
CREATE INDEX IF NOT EXISTS idx_program_share_expert_token  ON public.program_share(expert_token);

ALTER TABLE public.program_share ENABLE ROW LEVEL SECURITY;

-- 외부 페이지 (Stage 3-B-2) — 인증 X, 토큰 SELECT 허용
DROP POLICY IF EXISTS "public_read_by_token" ON public.program_share;
CREATE POLICY "public_read_by_token" ON public.program_share
  FOR SELECT USING (true);

-- 관리자 (인증) 전체 권한
DROP POLICY IF EXISTS "auth_all" ON public.program_share;
CREATE POLICY "auth_all" ON public.program_share
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
