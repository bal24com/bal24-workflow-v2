-- 박경수님 + SkyClaw STEP-RBAC-RLS-PHASE1 (2026-05-28)
-- 주민번호 pgcrypto 양방향 암호화 + 안전한 복호화 RPC
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)
-- ⚠️ 실행 전 필수: Supabase Dashboard → Settings → Edge Functions → Secrets 에 ENCRYPT_KEY 등록
--    예) ENCRYPT_KEY = "최소 32자 랜덤 비밀번호 (영문+숫자+특수)"
--    이 키를 분실하면 기존 암호화 데이터 복호화 불가 — 안전한 곳에 보관.

-- ============================================================
-- 0) pgcrypto 확장 활성화
-- ============================================================
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- ============================================================
-- 1) 암호키 조회 헬퍼 — vault.decrypted_secrets 에서 ENCRYPT_KEY 읽기
-- ============================================================
-- Supabase Vault 에 등록한 ENCRYPT_KEY 를 SECURITY DEFINER 함수로 안전하게 조회.
-- ⚠️ 박경수님 Vault 사용 안 한다면 아래 함수는 환경변수 fallback 사용.
CREATE OR REPLACE FUNCTION public.pii_encrypt_key()
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public, vault
AS $$
DECLARE
  k text;
BEGIN
  -- 우선 Vault 에서 시도
  BEGIN
    SELECT decrypted_secret INTO k FROM vault.decrypted_secrets WHERE name = 'ENCRYPT_KEY' LIMIT 1;
  EXCEPTION WHEN OTHERS THEN
    k := NULL;
  END;
  -- Vault 가 없거나 키 미등록이면 GUC fallback (Dashboard 환경변수 또는 SQL SET)
  IF k IS NULL OR length(k) < 16 THEN
    BEGIN
      k := current_setting('app.encrypt_key', true);
    EXCEPTION WHEN OTHERS THEN
      k := NULL;
    END;
  END IF;
  IF k IS NULL OR length(k) < 16 THEN
    RAISE EXCEPTION 'ENCRYPT_KEY 미등록 또는 16자 미만 — Vault 또는 app.encrypt_key 설정 필요';
  END IF;
  RETURN k;
END;
$$;
REVOKE EXECUTE ON FUNCTION public.pii_encrypt_key() FROM public, anon, authenticated;

-- ============================================================
-- 2) 암호화·복호화 함수 (AES-256, PGP 호환)
-- ============================================================
CREATE OR REPLACE FUNCTION public.encrypt_pii(plain text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
BEGIN
  IF plain IS NULL OR length(plain) = 0 THEN
    RETURN NULL;
  END IF;
  k := pii_encrypt_key();
  -- pgp_sym_encrypt 결과는 bytea → base64 인코딩하여 text 컬럼 저장
  RETURN encode(pgp_sym_encrypt(plain, k), 'base64');
END;
$$;

CREATE OR REPLACE FUNCTION public.decrypt_pii(cipher text)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  k text;
BEGIN
  IF cipher IS NULL OR length(cipher) = 0 THEN
    RETURN NULL;
  END IF;
  k := pii_encrypt_key();
  RETURN pgp_sym_decrypt(decode(cipher, 'base64'), k);
EXCEPTION WHEN OTHERS THEN
  -- 복호화 실패 (잘못된 키 또는 평문 저장된 기존 데이터) → NULL 대신 cipher 반환
  -- 마이그레이션 도중 평문/암호문 혼재 가능성 고려
  RETURN cipher;
END;
$$;

REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM public, anon;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(text) FROM public, anon;
-- authenticated 도 직접 호출 금지 — 아래 RPC 만 노출
REVOKE EXECUTE ON FUNCTION public.encrypt_pii(text) FROM authenticated;
REVOKE EXECUTE ON FUNCTION public.decrypt_pii(text) FROM authenticated;

-- ============================================================
-- 3) 클라이언트용 RPC — admin/finance 만 호출 가능
-- ============================================================
-- supabase.rpc('rpc_decrypt_resident', { p_employee_id: uuid }) 형태로 호출.
-- 본인의 employee_details 도 본인이 볼 수 있도록 허용.
CREATE OR REPLACE FUNCTION public.rpc_decrypt_resident(p_employee_id uuid)
RETURNS text
LANGUAGE plpgsql
STABLE
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_cipher  text;
  v_profile uuid;
BEGIN
  SELECT resident_number, profile_id INTO v_cipher, v_profile
    FROM employee_details WHERE id = p_employee_id;
  IF v_cipher IS NULL THEN
    RETURN NULL;
  END IF;
  -- 권한 체크: admin/finance 또는 본인
  IF NOT (is_finance_or_admin() OR v_profile = auth.uid()) THEN
    RAISE EXCEPTION '주민번호 조회 권한이 없습니다.' USING ERRCODE = '42501';
  END IF;
  RETURN decrypt_pii(v_cipher);
END;
$$;
REVOKE EXECUTE ON FUNCTION public.rpc_decrypt_resident(uuid) FROM public, anon;
GRANT  EXECUTE ON FUNCTION public.rpc_decrypt_resident(uuid) TO authenticated;

-- ============================================================
-- 3.5) employee_details.resident_number 자동 암호화 트리거
-- ============================================================
-- 클라이언트가 평문을 INSERT/UPDATE 해도 DB에서 자동 암호화.
-- 이미 암호문(긴 base64)이면 건너뜀 — 이중 암호화 방지.
CREATE OR REPLACE FUNCTION public.tg_encrypt_resident_number()
RETURNS trigger
LANGUAGE plpgsql
AS $$
BEGIN
  IF NEW.resident_number IS NOT NULL
     AND length(NEW.resident_number) <= 14
     AND NEW.resident_number ~ '^[0-9-]+$'
  THEN
    NEW.resident_number := encrypt_pii(NEW.resident_number);
  END IF;
  RETURN NEW;
END;
$$;

DROP TRIGGER IF EXISTS trg_employee_resident_encrypt ON employee_details;
CREATE TRIGGER trg_employee_resident_encrypt
BEFORE INSERT OR UPDATE OF resident_number ON employee_details
FOR EACH ROW
EXECUTE FUNCTION tg_encrypt_resident_number();

-- ============================================================
-- 4) 기존 평문 주민번호 일괄 암호화 (마이그레이션)
-- ============================================================
-- ⚠️ 안전망: 이미 base64 형태 (- 없고 = padding) 이면 건너뜀.
-- 한국 주민번호 패턴: 13자리 숫자 또는 6자리-7자리.
DO $migrate$
DECLARE
  r RECORD;
  cnt int := 0;
BEGIN
  FOR r IN
    SELECT id, resident_number FROM employee_details
     WHERE resident_number IS NOT NULL
       AND length(resident_number) <= 14   -- 평문(13~14자) 만, base64 암호문은 그보다 김
       AND resident_number ~ '^[0-9-]+$'   -- 숫자/하이픈만
  LOOP
    UPDATE employee_details
       SET resident_number = encrypt_pii(r.resident_number)
     WHERE id = r.id;
    cnt := cnt + 1;
  END LOOP;
  RAISE NOTICE '주민번호 % 건 암호화 완료', cnt;
END
$migrate$;

-- ============================================================
-- 5) 검증 쿼리 (수동 실행)
-- ============================================================
-- SELECT id, profile_id, length(resident_number) AS cipher_len FROM employee_details LIMIT 5;
-- → cipher_len 이 70 이상이면 암호문, 13~14면 평문 (남아 있으면 패턴 안 맞아서 미변환).
-- SELECT rpc_decrypt_resident('대상-employee-id');  -- 본인 또는 admin/finance 만 성공
