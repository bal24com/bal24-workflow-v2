-- ============================================================
-- bal24 v2 — STEP-STAFF-PIN-RESET
-- 강사 PIN 분실 시 PM 이 초기화하는 RPC 추가.
-- 박경수님 2026-05-26 — 강사 목록에서 [PIN 초기화] 버튼으로 호출.
--
-- 동작:
--   1) portal_pin_hash → NULL
--   2) pin_fail_count → 0
--   3) pin_locked_until → NULL
--   → 강사가 다음 접속 시 "PIN 처음 설정" 모드로 새 PIN 등록.
--
-- 보안:
--   - SECURITY DEFINER 로 staff_pool 보호 트리거 (anon 차단) 우회.
--   - authenticated 만 호출 가능 (PM 로그인 필수, anon 차단).
-- 박경수님이 Supabase SQL Editor 에서 실행 후 사이트 적용.
-- ============================================================

CREATE OR REPLACE FUNCTION public.reset_staff_pin(p_staff_id UUID)
RETURNS BOOLEAN
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  UPDATE public.staff_pool
     SET portal_pin_hash  = NULL,
         portal_pin       = NULL,
         pin_fail_count   = 0,
         pin_locked_until = NULL,
         updated_at       = NOW()
   WHERE id = p_staff_id;
  RETURN FOUND;
END $$;

REVOKE ALL ON FUNCTION public.reset_staff_pin(UUID) FROM PUBLIC;
GRANT EXECUTE ON FUNCTION public.reset_staff_pin(UUID) TO authenticated;
-- anon 에는 부여하지 않음 (PM 로그인 필수)

-- 끝. 이후 클라이언트는 reset_staff_pin RPC 로 PIN 분실 강사를 초기화.
