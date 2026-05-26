-- 박경수님 + SkyClaw STEP-PAYROLL-IMPORT (2026-05-28)
-- 급여 파일 임포트 이력 로그 — AI 추출 원본·결과 보존
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)

CREATE TABLE IF NOT EXISTS payroll_import_logs (
  id          uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  register_id uuid REFERENCES payroll_registers(id) ON DELETE CASCADE,
  file_name   text NOT NULL,
  file_type   text,
  imported_by uuid REFERENCES profiles(id),
  raw_text    text,
  ai_result   jsonb,
  status      text DEFAULT 'success' CHECK (status IN ('success','partial','failed')),
  created_at  timestamptz NOT NULL DEFAULT now()
);

ALTER TABLE payroll_import_logs ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS "payroll_import_logs_policy" ON payroll_import_logs;
CREATE POLICY "payroll_import_logs_policy" ON payroll_import_logs FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 확인
SELECT table_name FROM information_schema.tables WHERE table_name = 'payroll_import_logs';
