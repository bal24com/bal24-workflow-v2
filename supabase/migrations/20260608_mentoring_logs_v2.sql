-- bal24 v2 — STEP-MENTORING-P1 (DB 개편)
-- 멘토링 일지를 PDF 양식 구조에 맞게 확장 + 승인 워크플로 컬럼 추가.
-- 기존 컬럼 (assignment_id, log_date, session_no, content, next_plan, location, start_time, end_time, mentee_ids) 보존.

ALTER TABLE public.mentoring_logs
  ADD COLUMN IF NOT EXISTS subject              TEXT,
  ADD COLUMN IF NOT EXISTS duration_min         INTEGER,
  ADD COLUMN IF NOT EXISTS recipient            TEXT,
  ADD COLUMN IF NOT EXISTS status               TEXT NOT NULL DEFAULT 'draft'
    CHECK (status IN ('draft','submitted','approved','rejected')),
  ADD COLUMN IF NOT EXISTS submitted_at         TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_at          TIMESTAMPTZ,
  ADD COLUMN IF NOT EXISTS approved_by          UUID REFERENCES auth.users(id),
  ADD COLUMN IF NOT EXISTS approval_note        TEXT,
  ADD COLUMN IF NOT EXISTS mentor_signature_url TEXT;

-- 인덱스 (status·날짜 조회 최적화)
CREATE INDEX IF NOT EXISTS idx_mentoring_logs_status
  ON public.mentoring_logs(program_id, status);
CREATE INDEX IF NOT EXISTS idx_mentoring_logs_date
  ON public.mentoring_logs(log_date DESC);

-- 끝. expert_id 컬럼은 v2 구조상 불필요 (assignment_id 기반 → mentoring_assignments 의 mentor 정보 참조).
