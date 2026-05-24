// bal24 v2 — STEP-STAFF-PORTAL-PIN / STEP-PIN-SECURITY (보안 강화)
// PIN 최초 설정 / PIN 입력 게이트 — staff_pool 강사만 사용 (4~6자리).
// 보안: 평문 PIN 클라이언트 노출 차단. RPC (set_staff_pin / verify_staff_pin) 로 위임.
// 서버 측 rate limit (5회 실패 → 5분 잠금) — sessionStorage 우회 불가.

import { useMemo, useState } from 'react';
import { Loader2, Lock, ShieldCheck } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { setStaffPin, verifyStaffPin } from './staffPortalUtils';

interface Props {
  staffId: string;
  staffName: string;
  hasPinSet: boolean;
  onVerified: () => void;
}

const INPUT_CLASS =
  'w-full h-[48px] border border-gray-200 rounded-[10px] px-3 text-center text-lg font-bold tabular-nums tracking-[0.3em] ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 ' +
  'disabled:bg-slate-50';

const BTN_PRIMARY =
  'w-full inline-flex items-center justify-center gap-1.5 px-4 py-2.5 text-sm font-semibold text-white bg-violet-600 ' +
  'rounded-[10px] hover:bg-violet-700 transition-all duration-200 disabled:opacity-50';

function isPinShape(s: string): boolean {
  return /^\d{4,6}$/.test(s);
}

export default function StaffPinGate({ staffId, staffName, hasPinSet, onVerified }: Props) {
  const toast = useToast();
  const [pin, setPin] = useState('');
  const [pinConfirm, setPinConfirm] = useState('');
  const [saving, setSaving] = useState(false);
  const [isSettingMode, setIsSettingMode] = useState<boolean>(!hasPinSet);
  // 서버 측 잠금 응답 표시용 (sessionStorage 없음 — 서버 단일 소스)
  const [lockSeconds, setLockSeconds] = useState<number>(0);

  const headline = useMemo(
    () => isSettingMode ? 'PIN을 처음 설정해 주세요' : 'PIN을 입력해 주세요',
    [isSettingMode],
  );

  async function handleSetupPin() {
    const trimmed = pin.trim();
    if (!isPinShape(trimmed)) { toast.error('4~6자리 숫자만 사용 가능해요.'); return; }
    if (trimmed !== pinConfirm.trim()) { toast.error('확인 PIN이 일치하지 않아요.'); return; }
    setSaving(true);
    const ok = await setStaffPin(staffId, trimmed);
    setSaving(false);
    if (!ok) {
      toast.error('PIN 설정에 실패했어요. 관리자에게 RLS 정책 적용을 요청해 주세요.');
      return;
    }
    setIsSettingMode(false);
    setPin(''); setPinConfirm('');
    toast.success('PIN이 설정됐어요. 그대로 진입해요.');
    onVerified();
  }

  async function handleVerifyPin() {
    const entered = pin.trim();
    if (!isPinShape(entered)) { toast.error('4~6자리 숫자를 입력해 주세요.'); return; }
    setSaving(true);
    const r = await verifyStaffPin(staffId, entered);
    setSaving(false);
    if (r.ok) {
      setLockSeconds(0);
      onVerified();
      return;
    }
    if (r.reason === 'locked') {
      const left = r.secondsLeft ?? 300;
      setLockSeconds(left);
      toast.error(`5회 연속 실패로 잠겼어요. ${left}초 후 다시 시도해 주세요.`);
    } else if (r.reason === 'mismatch') {
      toast.error(`PIN이 일치하지 않아요. (${r.remaining ?? '?'}회 남음)`);
    } else {
      toast.error('PIN 검증 중 오류가 발생했어요.');
    }
    setPin('');
  }

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (isSettingMode) void handleSetupPin();
    else void handleVerifyPin();
  }

  const locked = lockSeconds > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-[#F8F7FF] px-4">
      <form onSubmit={handleSubmit}
        className="w-full max-w-sm bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-6">
        <div className="text-center mb-5">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-violet-100 text-violet-600 mb-3">
            {isSettingMode ? <ShieldCheck size={20} aria-hidden="true" /> : <Lock size={20} aria-hidden="true" />}
          </div>
          <p className="text-xs text-violet-600 font-semibold mb-1">WorkFlow · 강사 포털</p>
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
              5회 연속 실패로 잠겼어요. {lockSeconds}초 후 다시 시도해 주세요.
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
