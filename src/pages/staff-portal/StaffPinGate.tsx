// bal24 v2 — STEP-STAFF-PORTAL-PIN / STEP-PIN-FIX-V2
// PIN 최초 설정 / PIN 입력 게이트 — staff_pool 강사만 사용 (4~6자리).
// 3회 실패 시 60초 lockout (sessionStorage 카운트).
// V2 수정:
//   1) UPDATE 후 read-back 으로 실제 저장 검증 (RLS silent failure 감지)
//   2) 저장된 PIN을 로컬 state(savedPin)로 유지 → onVerified 전에 모드 전환
//   3) 카드 상단에 "OOO님의 강사 포털" 표시

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  staffId: string;
  staffName: string;
  hasPinSet: boolean;
  expectedPin: string | null;
  onVerified: () => void;
}

const INPUT_CLASS =
  'w-full h-[48px] border border-gray-200 rounded-[10px] px-3 text-center text-lg font-bold tabular-nums tracking-[0.3em] ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 ' +
  'disabled:bg-slate-50';

const BTN_PRIMARY =
  'w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 ' +
  'rounded-[10px] hover:bg-violet-700 transition-all duration-200 disabled:opacity-50';

const LOCK_KEY = (staffId: string) => `staff_pin_lock_${staffId}`;
const FAIL_KEY = (staffId: string) => `staff_pin_fail_${staffId}`;
const MAX_FAIL = 3;
const LOCK_SECONDS = 60;

function isPinShape(s: string): boolean {
  return /^\d{4,6}$/.test(s);
}

function readLockUntil(staffId: string): number {
  try {
    const v = sessionStorage.getItem(LOCK_KEY(staffId));
    return v ? Number(v) : 0;
  } catch { return 0; }
}

function writeLockUntil(staffId: string, ts: number) {
  try { sessionStorage.setItem(LOCK_KEY(staffId), String(ts)); } catch { /* noop */ }
}

function readFailCount(staffId: string): number {
  try {
    const v = sessionStorage.getItem(FAIL_KEY(staffId));
    return v ? Number(v) : 0;
  } catch { return 0; }
}

function writeFailCount(staffId: string, n: number) {
  try { sessionStorage.setItem(FAIL_KEY(staffId), String(n)); } catch { /* noop */ }
}

function clearFailState(staffId: string) {
  try {
    sessionStorage.removeItem(FAIL_KEY(staffId));
    sessionStorage.removeItem(LOCK_KEY(staffId));
  } catch { /* noop */ }
}

function normalizePin(v: string | null | undefined): string {
  return (v ?? '').trim();
}

export default function StaffPinGate({ staffId, staffName, hasPinSet, expectedPin, onVerified }: Props) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [lockUntil, setLockUntil] = useState<number>(() => readLockUntil(staffId));
  const [now, setNow] = useState(Date.now());

  // STEP-PIN-FIX-V2 — 명시적 PIN 존재 체크 (undefined·null·빈 문자열 모두 false)
  const initialPin = normalizePin(expectedPin);
  const [savedPin, setSavedPin] = useState<string>(initialPin);
  const [isSettingMode, setIsSettingMode] = useState<boolean>(!hasPinSet || initialPin.length === 0);

  // 1초 단위로 lockout 카운트다운 갱신
  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  const remainingLock = Math.max(0, Math.ceil((lockUntil - now) / 1000));
  const locked = remainingLock > 0;

  const headline = useMemo(
    () => isSettingMode ? 'PIN을 처음 설정해 주세요' : 'PIN을 입력해 주세요',
    [isSettingMode],
  );

  async function handleSetupPin() {
    const trimmed = pin.trim();
    if (!isPinShape(trimmed)) { toast.error('4~6자리 숫자만 사용 가능해요.'); return; }
    if (trimmed !== pinConfirm.trim()) { toast.error('확인 PIN이 일치하지 않아요.'); return; }
    setSaving(true);
    // STEP-PIN-FIX-V2 — UPDATE + read-back 으로 RLS silent failure 감지
    const { data, error } = await supabase.from('staff_pool')
      .update({ portal_pin: trimmed }).eq('id', staffId)
      .select('id, portal_pin').maybeSingle();
    setSaving(false);
    if (error) {
      console.error('[staff-pin] 최초 설정 실패:', error.message);
      toast.error('PIN 설정에 실패했어요.');
      return;
    }
    const saved = normalizePin((data as { portal_pin?: string | null } | null)?.portal_pin);
    if (!data || saved !== trimmed) {
      // RLS 차단으로 0 rows affected
      console.error('[staff-pin] PIN 저장 미반영 (RLS 차단 의심). data=', data);
      toast.error('PIN 저장 권한이 없어요. 관리자에게 RLS 정책 적용을 요청해 주세요.');
      return;
    }
    clearFailState(staffId);
    // 저장 성공 → 로컬 state 즉시 갱신 (다음 검증에 사용)
    setSavedPin(trimmed);
    setIsSettingMode(false);
    setPin(''); setPinConfirm('');
    toast.success('PIN이 설정됐어요. 그대로 진입해요.');
    onVerified();
  }

  function handleVerifyPin() {
    if (locked) { toast.error(`잠시 후 다시 시도해 주세요. (${remainingLock}초)`); return; }
    const entered = pin.trim();
    if (!isPinShape(entered)) { toast.error('4~6자리 숫자를 입력해 주세요.'); return; }
    if (!savedPin) {
      toast.error('저장된 PIN을 확인할 수 없어요. PM에게 초기화를 요청해 주세요.');
      return;
    }
    if (entered === savedPin) {
      clearFailState(staffId);
      onVerified();
      return;
    }
    const next = readFailCount(staffId) + 1;
    writeFailCount(staffId, next);
    if (next >= MAX_FAIL) {
      const until = Date.now() + LOCK_SECONDS * 1000;
      writeLockUntil(staffId, until);
      setLockUntil(until);
      toast.error('3회 연속 실패했어요. 잠시 후 다시 시도해 주세요.');
    } else {
      toast.error(`PIN이 일치하지 않아요. (${MAX_FAIL - next}회 남음)`);
    }
    setPin('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSettingMode) void handleSetupPin();
    else handleVerifyPin();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF] px-4">
      <form onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-6">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 mb-3">
            {isSettingMode ? <ShieldCheck size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}
          </div>
          <p className="text-xs text-violet-600 font-semibold mb-1">WorkFlow · 강사 포털</p>
          {/* STEP-PIN-FIX-V2 — 누구의 포털인지 명시 */}
          <p className="text-sm text-slate-500 mb-2">
            <span className="font-bold text-[#1E1B4B]">{staffName}</span>
            <span className="ml-0.5">님의 강사 포털</span>
          </p>
          <h1 className="text-lg font-bold text-[#1E1B4B]">{headline}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {isSettingMode
              ? '다음 접속부터 사용할 4~6자리 숫자 PIN을 설정해 주세요.'
              : '본인 확인을 위해 PIN을 입력해요.'}
          </p>
        </div>

        <div className="space-y-3">
          <input type="password" inputMode="numeric" maxLength={6}
            placeholder={isSettingMode ? '4~6자리 숫자' : '●●●●'}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            disabled={saving || locked}
            autoFocus
            className={INPUT_CLASS} />
          {isSettingMode && (
            <input type="password" inputMode="numeric" maxLength={6}
              placeholder="PIN 확인"
              value={pinConfirm}
              onChange={(e) => setPinConfirm(e.target.value.replace(/\D/g, ''))}
              disabled={saving}
              className={INPUT_CLASS} />
          )}
          {locked && (
            <p className="text-xs text-rose-600 text-center font-semibold">
              잠시 후 다시 시도해 주세요. ({remainingLock}초 남음)
            </p>
          )}
          <button type="submit" disabled={saving || locked} className={BTN_PRIMARY}>
            {saving ? <Loader2 size={14} className="animate-spin" /> : null}
            {isSettingMode ? 'PIN 설정 완료' : '확인'}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          PIN을 잊으셨나요? PM에게 초기화를 요청해 주세요.
        </p>
      </form>
    </div>
  );
}
