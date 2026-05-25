-- bal24 v2 — 견적서 항목 템플릿 (2026-05-25)
-- 박경수님 요청: 자주 쓰는 견적 항목 묶음을 예시로 저장 → 다른 견적에서 1-클릭 불러오기

CREATE TABLE IF NOT EXISTS estimate_templates (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name        TEXT NOT NULL,
  memo        TEXT,
  items       JSONB NOT NULL DEFAULT '[]'::jsonb,
  created_by  UUID REFERENCES profiles(id),
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  deleted_at  TIMESTAMPTZ
);

CREATE INDEX IF NOT EXISTS idx_estimate_templates_created_at
  ON estimate_templates (created_at DESC) WHERE deleted_at IS NULL;

ALTER TABLE estimate_templates ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS "estimate_templates_select" ON estimate_templates;
DROP POLICY IF EXISTS "estimate_templates_insert" ON estimate_templates;
DROP POLICY IF EXISTS "estimate_templates_update" ON estimate_templates;
DROP POLICY IF EXISTS "estimate_templates_delete" ON estimate_templates;

CREATE POLICY "estimate_templates_select"
  ON estimate_templates FOR SELECT TO authenticated USING (true);
CREATE POLICY "estimate_templates_insert"
  ON estimate_templates FOR INSERT TO authenticated WITH CHECK (true);
CREATE POLICY "estimate_templates_update"
  ON estimate_templates FOR UPDATE TO authenticated
  USING (true) WITH CHECK (true);
CREATE POLICY "estimate_templates_delete"
  ON estimate_templates FOR DELETE TO authenticated USING (true);

SELECT id, name, jsonb_array_length(items) AS item_count, created_at
FROM estimate_templates ORDER BY created_at DESC LIMIT 5;
