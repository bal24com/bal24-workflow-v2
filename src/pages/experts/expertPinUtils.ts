// bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY (박경수님 2026-05-26)
// 강사 PIN 초기화 헬퍼. ExpertsPage 의 [PIN 초기화] 버튼에서 호출.

import { supabase } from '../../lib/supabase';

export interface PinResetResult {
  ok: boolean;
  pin?: string;
  error?: string;
}

/** 전화번호 끝 6자리로 PIN 초기화. 전화번호 없거나 6자리 미만이면 000000. */
export async function resetStaffPinFromPhone(
  staffId: string,
  phone: string | null | undefined,
  phoneMobile: string | null | undefined,
): Promise<PinResetResult> {
  const digits = (phone ?? phoneMobile ?? '').replace(/[^0-9]/g, '');
  const newPin = digits.length >= 6 ? digits.slice(-6) : '000000';

  const { error } = await supabase
    .from('staff_pool')
    .update({ portal_pin: newPin, updated_at: new Date().toISOString() })
    .eq('id', staffId);

  if (error) {
    console.error('[expertPin] 초기화 실패:', error);
    return { ok: false, error: error.message };
  }
  return { ok: true, pin: newPin };
}
