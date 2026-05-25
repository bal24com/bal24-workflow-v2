-- bal24 v2 — 프로그램 기관/단체 FK 화 (clients 테이블 연동)

ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS host_client_id UUID REFERENCES clients(id) ON DELETE SET NULL;

CREATE INDEX IF NOT EXISTS idx_programs_host_client ON programs(host_client_id)
  WHERE host_client_id IS NOT NULL;

-- 기존 client_org(텍스트) 값으로 자동 매핑 (정확히 일치하는 clients.name 만)
UPDATE programs p SET host_client_id = c.id
FROM clients c
WHERE p.host_client_id IS NULL AND p.client_org IS NOT NULL
  AND TRIM(p.client_org) = TRIM(c.name) AND c.deleted_at IS NULL;

SELECT id, name, client_org, host_client_id FROM programs
WHERE host_client_id IS NOT NULL ORDER BY updated_at DESC LIMIT 5;
