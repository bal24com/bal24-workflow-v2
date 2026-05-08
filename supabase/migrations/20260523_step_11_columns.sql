-- bal24 WorkFlow v2 — STEP 11 외부 폼 시스템 컬럼 보강 (Stage 11-①)
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.
-- 박경수님 명세: 3 토큰(student/instructor/ta) + status(O/△/X) + cert token + session_no.

-- ============================================================
-- 1. attendance_sessions — 학생 토큰을 learner_token → student_token 으로 통일
--    (V2 기존 learner_token 컬럼은 DROP 안 함, 점진 폐기)
--    instructor_token / ta_token 은 이미 V2 schema에 존재
-- ============================================================
ALTER TABLE public.attendance_sessions
  ADD COLUMN IF NOT EXISTS student_token   TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  ADD COLUMN IF NOT EXISTS instructor_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  ADD COLUMN IF NOT EXISTS ta_token         TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  ADD COLUMN IF NOT EXISTS session_no       INTEGER;

CREATE INDEX IF NOT EXISTS idx_attendance_sessions_student_token
  ON public.attendance_sessions(student_token);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_instructor_token
  ON public.attendance_sessions(instructor_token);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_ta_token
  ON public.attendance_sessions(ta_token);

-- ============================================================
-- 2. attendance_records — status (O/△/X) + 중복 방지 UNIQUE
-- ============================================================
ALTER TABLE public.attendance_records
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'O'
    CHECK (status IN ('O', '△', 'X'));

CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_records_session_phone
  ON public.attendance_records(session_id, attendee_phone);

-- ============================================================
-- 3. issued_certificates — 외부 /cert/:token 접근용 토큰
-- ============================================================
ALTER TABLE public.issued_certificates
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex');

CREATE INDEX IF NOT EXISTS idx_issued_certificates_token
  ON public.issued_certificates(token);

-- 외부 페이지 (인증 X, 토큰 SELECT 허용)
DROP POLICY IF EXISTS "public_read_by_token" ON public.issued_certificates;
CREATE POLICY "public_read_by_token" ON public.issued_certificates
  FOR SELECT USING (true);
