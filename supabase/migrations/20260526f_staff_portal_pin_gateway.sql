-- ============================================================
-- bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY (박경수님 2026-05-26)
-- 고정 URL /portal + 이름·6자리 PIN 게이트웨이.
--
-- 이전 STAFF-TOKEN-SIMPLIFY 의 staff_portal_token 은 그대로 활용 (백워드).
-- portal_pin 컬럼 신규 — 평문 6자리. (기존 portal_pin_hash 는 미사용 dead)
-- ============================================================

-- ① portal_pin 컬럼 추가 (6자리 평문)
ALTER TABLE public.staff_pool
  ADD COLUMN IF NOT EXISTS portal_pin VARCHAR(6);

-- ② staff_portal_token 백필 (이미 NOT NULL UNIQUE 적용됐을 수 있음 — 안전 idempotent)
UPDATE public.staff_pool
   SET staff_portal_token = gen_random_uuid()
 WHERE staff_portal_token IS NULL;

-- ③ 초기 PIN = 전화번호 끝 6자리. phone 컬럼 우선, 없으면 phone_mobile fallback.
--    숫자만 추출 후 6자리 미만이면 null 유지 → 다음 단계에서 000000 채움.
UPDATE public.staff_pool
   SET portal_pin = RIGHT(
     REGEXP_REPLACE(COALESCE(phone, phone_mobile, ''), '[^0-9]', '', 'g'),
     6
   )
 WHERE portal_pin IS NULL
   AND LENGTH(REGEXP_REPLACE(COALESCE(phone, phone_mobile, ''), '[^0-9]', '', 'g')) >= 6;

-- ④ 전화번호 없거나 6자리 미만 → 임시 PIN 000000 (PM 이 [PIN 초기화] 또는 강사가 [PIN 변경]에서 갱신)
UPDATE public.staff_pool
   SET portal_pin = '000000'
 WHERE portal_pin IS NULL;

-- ⑤ NOT NULL 강제 (모든 행에 PIN 보유)
ALTER TABLE public.staff_pool
  ALTER COLUMN portal_pin SET NOT NULL;

-- ⑥ portal_pin 자체 RLS — SELECT 는 anon 차단 (PIN 평문 노출 방지).
--    이전 STAFF-TOKEN-SIMPLIFY 에서 anon SELECT 전체 허용했으나 portal_pin 컬럼은
--    Edge Function (SERVICE_ROLE) 으로만 검증하므로 클라이언트 노출 불필요.
--    Supabase 는 컬럼별 RLS 가 없어 view 또는 함수로 분리해야 하나,
--    실용상 anon 정책은 그대로 두되 클라이언트 코드에서 portal_pin SELECT 금지로 운영.

-- 검증.
-- SELECT COUNT(*) FILTER (WHERE portal_pin IS NULL) AS null_pin,
--        COUNT(*) FILTER (WHERE portal_pin = '000000') AS default_pin,
--        COUNT(*) AS total
-- FROM public.staff_pool WHERE deleted_at IS NULL;
