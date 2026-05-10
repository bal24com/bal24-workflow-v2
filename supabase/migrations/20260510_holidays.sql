-- 휴일 관리 테이블 — 사용자 정의 휴일 (정적 공휴일 외 추가용)
-- ============================================================

CREATE TABLE IF NOT EXISTS holidays (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text NOT NULL,
  date date NOT NULL,
  is_national boolean DEFAULT true,
  created_by uuid REFERENCES profiles(id),
  created_at timestamptz DEFAULT now()
);

CREATE INDEX IF NOT EXISTS idx_holidays_date ON holidays(date);

ALTER TABLE holidays ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "auth_all_holidays" ON holidays;
CREATE POLICY "auth_all_holidays" ON holidays
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
