// bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY (박경수님 2026-05-26)
// 강사 포털 고정 진입 URL — /portal.
// 이름 + 6자리 PIN → Edge Function verify-staff-pin → /staff-portal/{token} redirect.
// 잠금: 3회 실패 → 60초 lockout (React state, 새로고침 시 리셋).

import { useCallback, useEffect, useState } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2, Lock, LogIn, ShieldAlert } from 'lucide-react';
import PinInputBlock from '../../components/portal/PinInputBlock';

const MAX_ATTEMPTS = 3;
const LOCK_SECONDS = 60;

interface VerifyResponse {
  portal_token?: string;
  staff_name?: string;
  error?: string;
}

export default function StaffPortalLoginPage() {
  const navigate = useNavigate();
  const [name, setName] = useState('');
  const [pin, setPin] = useState('');
  const [failCount, setFailCount] = useState(0);
  const [lockedUntil, setLockedUntil] = useState<number | null>(null); // epoch ms
  const [now, setNow] = useState<number>(Date.now());
  const [isLoading, setIsLoading] = useState(false);
  const [errorMsg, setErrorMsg] = useState('');

  // 잠금 카운트다운 — 1초마다 now 갱신
  useEffect(() => {
    if (lockedUntil == null) return;
    const id = setInterval(() => setNow(Date.now()), 1000);
    return () => clearInterval(id);
  }, [lockedUntil]);

  const lockSecondsLeft = lockedUntil
    ? Math.max(0, Math.ceil((lockedUntil - now) / 1000))
    : 0;
  const isLocked = lockSecondsLeft > 0;

  // 잠금 해제 시 카운트 리셋
  useEffect(() => {
    if (lockedUntil != null && lockSecondsLeft === 0) {
      setLockedUntil(null);
      setFailCount(0);
      setErrorMsg('');
    }
  }, [lockSecondsLeft, lockedUntil]);

  const handleSubmit = useCallback(async (overridePin?: string) => {
    const pinToSend = overridePin ?? pin;
    if (isLocked || isLoading) return;
    if (!name.trim() || pinToSend.length !== 6) {
      setErrorMsg('이름과 6자리 PIN 을 모두 입력해 주세요.');
      return;
    }
    setIsLoading(true);
    setErrorMsg('');
    try {
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/verify-staff-pin`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: JSON.stringify({ name: name.trim(), pin: pinToSend }),
      });
      const data = await res.json() as VerifyResponse;
      if (!res.ok || !data.portal_token) {
        const next = failCount + 1;
        setFailCount(next);
        if (next >= MAX_ATTEMPTS) {
          setLockedUntil(Date.now() + LOCK_SECONDS * 1000);
          setErrorMsg(`PIN ${MAX_ATTEMPTS}회 오류로 ${LOCK_SECONDS}초 동안 잠겼어요.`);
          setPin('');
        } else {
          setErrorMsg(
            `${data.error ?? '이름 또는 PIN 이 올바르지 않아요.'} (${next}/${MAX_ATTEMPTS}회 — 잠금까지 ${MAX_ATTEMPTS - next}회 남음)`,
          );
          setPin('');
        }
        return;
      }
      // 성공 → 토큰 포털로 이동
      navigate(`/staff-portal/${data.portal_token}`);
    } catch (err) {
      console.error('[StaffPortalLogin] 요청 오류:', err);
      setErrorMsg('네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setIsLoading(false);
    }
  }, [name, pin, failCount, isLocked, isLoading, navigate]);

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50 via-white to-violet-50 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md">
        <header className="text-center mb-6">
          <p className="text-xs font-bold text-violet-600 mb-1">WorkFlow · 강사 포털</p>
          <h1 className="text-xl font-extrabold text-[#1E1B4B] tracking-tight">
            당신의 활동을 기록하고 확인하세요
          </h1>
          <p className="text-xs text-slate-500 mt-1">이름과 6자리 PIN 으로 입장</p>
        </header>

        <form
          onSubmit={(e) => { e.preventDefault(); void handleSubmit(); }}
          className="bg-white rounded-2xl border border-violet-100 shadow-[0_10px_40px_rgba(124,58,237,0.10)] p-6 space-y-5"
        >
          {/* 이름 입력 */}
          <div>
            <label htmlFor="staff-login-name" className="text-sm font-semibold text-slate-700 block mb-1.5">
              성 명 <span className="text-rose-500">*</span>
            </label>
            <input
              id="staff-login-name"
              type="text"
              value={name}
              onChange={(e) => setName(e.target.value)}
              placeholder="예) 홍길동"
              disabled={isLoading || isLocked}
              autoComplete="name"
              className="w-full h-11 border border-gray-200 rounded-[10px] px-3 text-sm
                focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10
                disabled:bg-slate-50"
            />
          </div>

          {/* PIN 입력 */}
          <div>
            <label className="text-sm font-semibold text-slate-700 block mb-1.5">
              PIN 번호 (6자리) <span className="text-rose-500">*</span>
            </label>
            <PinInputBlock
              value={pin}
              onChange={setPin}
              disabled={isLoading || isLocked}
              autoFocus={false}
              onComplete={(filled) => void handleSubmit(filled)}
              ariaLabel="강사 포털 PIN"
            />
            <p className="text-[11px] text-slate-400 mt-2">
              💡 초기 PIN 은 휴대폰 번호 끝 6자리예요. (변경했다면 변경한 PIN 입력)
            </p>
          </div>

          {/* 에러 / 잠금 메시지 */}
          {isLocked ? (
            <div className="rounded-xl border border-rose-200 bg-rose-50 px-4 py-3 text-sm text-rose-800">
              <p className="font-bold inline-flex items-center gap-1.5 mb-1">
                <Lock size={14} aria-hidden="true" /> PIN {MAX_ATTEMPTS}회 오류로 잠겼어요.
              </p>
              <p className="text-xs text-rose-700">
                {lockSecondsLeft}초 후 다시 시도할 수 있어요.
              </p>
              <div className="mt-2 h-1.5 rounded-full bg-rose-200 overflow-hidden">
                <div className="h-full bg-rose-500 transition-all"
                  style={{ width: `${(lockSecondsLeft / LOCK_SECONDS) * 100}%` }} />
              </div>
            </div>
          ) : errorMsg ? (
            <div className="rounded-xl border border-amber-200 bg-amber-50 px-4 py-2.5 text-xs text-amber-800 inline-flex items-start gap-1.5">
              <ShieldAlert size={13} aria-hidden="true" className="shrink-0 mt-0.5" />
              <span>{errorMsg}</span>
            </div>
          ) : null}

          {/* 입장 버튼 */}
          <button
            type="submit"
            disabled={isLoading || isLocked || pin.length !== 6 || !name.trim()}
            className="w-full h-11 inline-flex items-center justify-center gap-1.5 rounded-[10px]
              text-sm font-bold text-white bg-violet-600 hover:bg-violet-700
              transition-all duration-200 disabled:opacity-50 disabled:cursor-not-allowed"
          >
            {isLoading ? <Loader2 size={16} className="animate-spin" /> : <LogIn size={15} aria-hidden="true" />}
            {isLoading ? '확인 중…' : '포털 입장하기'}
          </button>
        </form>

        <p className="text-center text-xs text-slate-400 mt-5">
          PIN 을 잊으셨다면 담당 PM 에게 초기화를 요청해 주세요.
        </p>
      </div>
    </div>
  );
}
