-- ============================================================
-- bal24 v2 — STEP-STAFF-PORTAL-PIN
-- staff_pool.portal_pin: 강사 포털 접속 PIN (최초 진입 시 설정, plaintext)
-- 내부 업무용 SaaS 수준 보안. 향후 bcrypt 해싱 업그레이드 가능.
-- ============================================================

alter table public.staff_pool
  add column if not exists portal_pin text;

-- 끝.
