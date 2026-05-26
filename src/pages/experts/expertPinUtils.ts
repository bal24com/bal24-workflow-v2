// bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY · 보안 강화 (박경수님 2026-05-26)
// PIN 초기화 — set_staff_pin RPC 호출 (bcrypt 해시 저장 + fail/lock reset).
// 평문 portal_pin 컬럼 직접 update 안 함 (보안).

import { supabase } from '../../lib/supabase';

export interface PinResetResult {
  ok: boolean;
  pin?: string;
  error?: string;
}

/** 전화번호 끝 6자리로 PIN 초기화. 전화번호 없으면 000000. set_staff_pin RPC 로 해시 저장. */
export async function resetStaffPinFromPhone(
  staffId: string,
  phone: string | null | undefined,
  phoneMobile: string | null | undefined,
): Promise<PinResetResult> {
  const digits = (phone ?? phoneMobile ?? '').replace(/[^0-9]/g, '');
  const newPin = digits.length >= 6 ? digits.slice(-6) : '000000';

  const { error } = await supabase.rpc('set_staff_pin', {
    p_staff_id: staffId, p_pin: newPin,
  });
  if (error) {
    console.error('[expertPin] set_staff_pin RPC 실패:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, pin: newPin };
}
