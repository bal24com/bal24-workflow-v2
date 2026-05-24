-- ============================================================
-- bal24 v2 — STEP-STAFF-PORTAL-PIN-SECURITY (보안 강화 일괄)
-- 박경수님 카드 도용 사고 재발 방지 — PIN/토큰/RLS 강화.
--
-- 핵심 변경:
--   1) portal_pin 평문 → portal_pin_hash (bcrypt, pgcrypto)
--   2) 서버 측 시도횟수 + 잠금 (pin_fail_count / pin_locked_until)
--   3) verify_staff_pin / set_staff_pin RPC (SECURITY DEFINER)
--   4) regenerate_staff_portal_token RPC (PM 전용, authenticated만)
--   5) 트리거로 anon이 PIN/토큰 컬럼 변경 차단 (내 정보 수정은 그대로 동작)
-- 박경수님이 Supabase SQL Editor 에서 실행 후 사이트 적용.
-- ============================================================

-- 1) pgcrypto 확장 (Supabase 기본 활성, 명시 확인)
CREATE EXTENSION IF NOT EXISTS pgcrypto;

-- 2) 컬럼 추가
ALTER TABLE public.staff_pool
  ADD COLUMN IF NOT EXISTS portal_pin_hash  TEXT,
  ADD COLUMN IF NOT EXISTS pin_fail_count   INT NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS pin_locked_until TIMESTAMPTZ;

-- 3) 기존 평문 PIN을 bcrypt 해시로 일괄 이전 후 평문 삭제
UPDATE public.staff_pool
   SET portal_pin_hash = crypt(portal_pin, gen_salt('bf')),
       portal_pin      = NULL
 WHERE portal_pin IS NOT NULL
   AND portal_pin <> ''
   AND portal_pin_hash IS NULL;

-- 4) PIN 설정·변경 RPC (anon·auth 모두 호출 가능, 본인 토큰으로 식별 가정)
CREATE OR REPLACE FUNCTION public.set_staff_pin(p_staff_id UUID, p_pin TEXT)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  IF p_pin IS NULL OR NOT (p_pin ~ '^\d{4,6}$') THEN
    RAISE EXCEPTION 'PIN은 4~6자리 숫자만 사용할 수 있어요.';
  END IF;
  UPDATE public.staff_pool
     SET portal_pin_hash  = crypt(p_pin, gen_salt('bf')),
         portal_pin       = NULL,
         pin_fail_count   = 0,
         pin_locked_until = NULL,
         updated_at       = NOW()
   WHERE id = p_staff_id;
  RETURN FOUND;
END $$;
REVOKE ALL ON FUNCTION public.set_staff_pin(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.set_staff_pin(UUID, TEXT) TO anon, authenticated;

-- 5) PIN 검증 RPC (서버 측 rate limit: 5회 실패 시 5분 잠금)
CREATE OR REPLACE FUNCTION public.verify_staff_pin(p_staff_id UUID, p_pin TEXT)
RETURNS JSONB
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_hash    TEXT;
  v_locked  TIMESTAMPTZ;
  v_fails   INT;
  v_match   BOOLEAN;
BEGIN
  SELECT portal_pin_hash, pin_locked_until, pin_fail_count
    INTO v_hash, v_locked, v_fails
    FROM public.staff_pool WHERE id = p_staff_id;

  IF v_hash IS NULL OR v_hash = '' THEN
    RETURN jsonb_build_object('ok', true, 'reason', 'no_pin');
  END IF;

  IF v_locked IS NOT NULL AND v_locked > NOW() THEN
    RETURN jsonb_build_object(
      'ok', false, 'reason', 'locked',
      'seconds_left', GREATEST(0, EXTRACT(EPOCH FROM (v_locked - NOW()))::INT)
    );
  END IF;

  v_match := (v_hash = crypt(p_pin, v_hash));

  IF v_match THEN
    UPDATE public.staff_pool
       SET pin_fail_count = 0, pin_locked_until = NULL
     WHERE id = p_staff_id;
    RETURN jsonb_build_object('ok', true);
  END IF;

  v_fails := COALESCE(v_fails, 0) + 1;
  IF v_fails >= 5 THEN
    UPDATE public.staff_pool
       SET pin_fail_count = v_fails,
           pin_locked_until = NOW() + INTERVAL '5 minutes'
     WHERE id = p_staff_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'locked', 'seconds_left', 300);
  ELSE
    UPDATE public.staff_pool
       SET pin_fail_count = v_fails
     WHERE id = p_staff_id;
    RETURN jsonb_build_object('ok', false, 'reason', 'mismatch', 'remaining', 5 - v_fails);
  END IF;
END $$;
REVOKE ALL ON FUNCTION public.verify_staff_pin(UUID, TEXT) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.verify_staff_pin(UUID, TEXT) TO anon, authenticated;

-- 6) 강사 포털 토큰 회전 RPC (PM 전용 — authenticated만)
CREATE OR REPLACE FUNCTION public.regenerate_staff_portal_token(p_staff_id UUID)
RETURNS TEXT
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE v_token TEXT;
BEGIN
  v_token := encode(gen_random_bytes(24), 'hex');
  UPDATE public.staff_pool
     SET staff_portal_token = v_token,
         updated_at = NOW()
   WHERE id = p_staff_id;
  RETURN v_token;
END $$;
REVOKE ALL ON FUNCTION public.regenerate_staff_portal_token(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.regenerate_staff_portal_token(UUID) TO authenticated;
-- anon에는 부여하지 않음 (PM 로그인 필수)

-- 7) 트리거 — anon이 staff_pool UPDATE 할 때 PIN/토큰 컬럼 변경 차단
--    내 정보 수정 모달의 일반 컬럼(name/organization/phone/email/specialty/career_summary) 은 그대로 동작
CREATE OR REPLACE FUNCTION public.protect_staff_pool_sensitive_cols()
RETURNS TRIGGER
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- anon role 의 직접 UPDATE 만 차단. SECURITY DEFINER RPC 안에서는 이 트리거가 동일 row를 update하지만
  -- RPC 내부 UPDATE 도 트리거를 거치므로, RPC가 정상 동작하려면 PG_TRIGGER_DEPTH 또는 별도 우회 필요.
  -- 안전한 우회: 호출 컨텍스트가 SECURITY DEFINER 라면 current_role 이 owner(postgres) 가 되어 anon 체크에 안 걸림.
  IF (SELECT current_setting('role', true)) = 'anon' THEN
    NEW.portal_pin       := OLD.portal_pin;
    NEW.portal_pin_hash  := OLD.portal_pin_hash;
    NEW.pin_fail_count   := OLD.pin_fail_count;
    NEW.pin_locked_until := OLD.pin_locked_until;
    NEW.staff_portal_token := OLD.staff_portal_token;
  END IF;
  RETURN NEW;
END $$;

DROP TRIGGER IF EXISTS staff_pool_protect_sensitive ON public.staff_pool;
CREATE TRIGGER staff_pool_protect_sensitive
  BEFORE UPDATE ON public.staff_pool
  FOR EACH ROW EXECUTE FUNCTION public.protect_staff_pool_sensitive_cols();

-- 끝. 이후 클라이언트는 set_staff_pin / verify_staff_pin RPC 로만 PIN 작업.
