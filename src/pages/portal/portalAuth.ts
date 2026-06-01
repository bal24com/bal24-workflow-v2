// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE — 수혜기관 PIN + 수혜자 팀코드 인증.
// sessionStorage 예외 사용 허용 — 탭 단위 임시 인증 상태 (CLAUDE.md 룰 예외).

import { supabase } from '../../lib/supabase';

const LOCKOUT_MS = 60_000;
const MAX_FAIL   = 3;

/** 수혜기관 PIN 검증 (3회 실패 시 60초 잠금). */
export function verifyBeneficiaryPin(
  portalId: string, storedPin: string | null, inputPin: string,
): void {
  const failKey = `portal_pin_fail_${portalId}`;
  const lockKey = `portal_pin_lock_${portalId}`;
  const lockUntil = Number(sessionStorage.getItem(lockKey) ?? 0);
  if (Date.now() < lockUntil) {
    const sec = Math.ceil((lockUntil - Date.now()) / 1000);
    throw new Error(`${sec}초 후 다시 시도해 주세요.`);
  }
  if (!storedPin || storedPin !== inputPin) {
    const fails = Number(sessionStorage.getItem(failKey) ?? 0) + 1;
    sessionStorage.setItem(failKey, String(fails));
    if (fails >= MAX_FAIL) {
      sessionStorage.setItem(lockKey, String(Date.now() + LOCKOUT_MS));
      sessionStorage.removeItem(failKey);
      throw new Error('3회 실패. 60초 후 다시 시도해 주세요.');
    }
    throw new Error(`PIN 이 올바르지 않아요. (${fails}/${MAX_FAIL}회)`);
  }
  sessionStorage.removeItem(failKey);
  sessionStorage.setItem(`portal_auth_${portalId}`, 'beneficiary_org');
}

export function isPinAuthed(portalId: string): boolean {
  return sessionStorage.getItem(`portal_auth_${portalId}`) === 'beneficiary_org';
}

export function getLockoutRemainMs(portalId: string): number {
  const lockUntil = Number(sessionStorage.getItem(`portal_pin_lock_${portalId}`) ?? 0);
  return Math.max(0, lockUntil - Date.now());
}

export interface TeamInfo { id: string; team_code: string; team_name: string }

/** 수혜자 팀코드 검증 — DB 조회. */
export async function verifyTeamCode(
  portalId: string, inputCode: string,
): Promise<TeamInfo | null> {
  const code = inputCode.trim().toUpperCase();
  const { data, error } = await supabase
    .from('portal_teams')
    .select('id, team_code, team_name')
    .eq('portal_id', portalId)
    .eq('team_code', code)
    .maybeSingle();
  if (error) {
    console.warn('[portalAuth] verifyTeamCode 실패:', error.message);
    return null;
  }
  if (data) {
    sessionStorage.setItem(`portal_team_${portalId}`, JSON.stringify(data));
  }
  return data as TeamInfo | null;
}

export function getAuthedTeam(portalId: string): TeamInfo | null {
  const raw = sessionStorage.getItem(`portal_team_${portalId}`);
  if (!raw) return null;
  try { return JSON.parse(raw) as TeamInfo; }
  catch (err) {
    console.warn('[portalAuth] team 파싱 실패:', err);
    return null;
  }
}
