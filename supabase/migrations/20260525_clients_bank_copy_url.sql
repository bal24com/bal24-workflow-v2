-- bal24 v2 — clients 통장사본 URL 컬럼 (박경수님 + SkyClaw 요청)

ALTER TABLE clients
  ADD COLUMN IF NOT EXISTS bank_copy_url TEXT;

SELECT id, name, business_license_url, bank_copy_url FROM clients
ORDER BY updated_at DESC LIMIT 5;
