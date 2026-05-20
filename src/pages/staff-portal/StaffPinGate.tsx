// bal24 v2 — STEP-STAFF-PORTAL-PIN
// PIN 최초 설정 / PIN 입력 게이트 — staff_pool 강사만 사용 (4~6자리).
// 3회 실패 시 60초 lockout (sessionStorage 카운트).

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  staffId: string;
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

export default function StaffPinGate({ staffId, hasPinSet, expectedPin, onVerified }: Props) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [lockUntil, setLockUntil] = useState<number>(() => readLockUntil(staffId));
  const [now, setNow] = useState(Date.now());

  // 1초 단위로 lockout 카운트다운 갱신
  useEffect(() => {
    if (lockUntil <= Date.now()) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockUntil]);

  const remainingLock = Math.max(0, Math.ceil((lockUntil - now) / 1000));
  const locked = remainingLock > 0;

  const headline = useMemo(
    () => hasPinSet ? 'PIN을 입력해 주세요' : 'PIN을 처음 설정해 주세요',
    [hasPinSet],
  );

  async function handleSetupPin() {
    if (!isPinShape(pin)) { toast.error('4~6자리 숫자만 사용 가능해요.'); return; }
    if (pin !== pinConfirm) { toast.error('확인 PIN이 일치하지 않아요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('staff_pool')
      .update({ portal_pin: pin }).eq('id', staffId);
    setSaving(false);
    if (error) {
      console.error('[staff-pin] 최초 설정 실패:', error.message);
      toast.error('PIN 설정에 실패했어요.');
      return;
    }
    clearFailState(staffId);
    toast.success('PIN이 설정됐어요.');
    onVerified();
  }

  function handleVerifyPin() {
    if (locked) { toast.error(`잠시 후 다시 시도해 주세요. (${remainingLock}초)`); return; }
    if (!isPinShape(pin)) { toast.error('4~6자리 숫자를 입력해 주세요.'); return; }
    if (expectedPin && pin === expectedPin) {
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
    if (hasPinSet) handleVerifyPin();
    else void handleSetupPin();
  }

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF] px-4">
      <form onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-6">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 mb-3">
            {hasPinSet ? <Lock size={20} aria-hidden="true" /> : <ShieldCheck size={20} aria-hidden="true" />}
          </div>
          <p className="text-xs text-violet-600 font-semibold mb-1">WorkFlow · 강사 포털</p>
          <h1 className="text-lg font-bold text-[#1E1B4B]">{headline}</h1>
          <p className="text-xs text-slate-500 mt-1">
            {hasPinSet ? '본인 확인을 위해 PIN을 입력해요.' : '다음 접속부터 사용할 4~6자리 숫자 PIN을 설정해 주세요.'}
          </p>
        </div>

        <div className="space-y-3">
          <input type="password" inputMode="numeric" maxLength={6}
            placeholder={hasPinSet ? '●●●●' : '4~6자리 숫자'}
            value={pin}
            onChange={(e) => setPin(e.target.value.replace(/\D/g, ''))}
            disabled={saving || locked}
            autoFocus
            className={INPUT_CLASS} />
          {!hasPinSet && (
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
            {hasPinSet ? '확인' : 'PIN 설정 완료'}
          </button>
        </div>

        <p className="text-[11px] text-slate-400 text-center mt-4">
          PIN을 잊으셨나요? PM에게 초기화를 요청해 주세요.
        </p>
      </form>
    </div>
  );
}
