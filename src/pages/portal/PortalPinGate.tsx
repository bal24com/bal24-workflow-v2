// 박경수님 2026-05-29 STEP-PORTAL-MULTI-ROLE — 수혜기관 PIN 입력 게이트.

import { useEffect, useState } from 'react';
import { Loader2, ShieldCheck } from 'lucide-react';
import { verifyBeneficiaryPin, getLockoutRemainMs } from './portalAuth';

interface Props {
  portalId: string;
  portalTitle: string;
  storedPin: string | null;
  onSuccess: () => void;
}

export default function PortalPinGate({ portalId, portalTitle, storedPin, onSuccess }: Props) {
  const [pin, setPin] = useState('');
  const [error, setError] = useState<string | null>(null);
  const [submitting, setSubmitting] = useState(false);
  const [remainSec, setRemainSec] = useState(Math.ceil(getLockoutRemainMs(portalId) / 1000));

  useEffect(() => {
    if (remainSec <= 0) return;
    const timer = setInterval(() => {
      setRemainSec(Math.ceil(getLockoutRemainMs(portalId) / 1000));
    }, 1000);
    return () => clearInterval(timer);
  }, [portalId, remainSec]);

  function handleSubmit() {
    if (submitting) return;
    setError(null);
    setSubmitting(true);
    try {
      verifyBeneficiaryPin(portalId, storedPin, pin);
      onSuccess();
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'PIN 확인 중 오류가 발생했어요.';
      setError(msg);
      setRemainSec(Math.ceil(getLockoutRemainMs(portalId) / 1000));
    } finally {
      setSubmitting(false);
    }
  }

  const locked = remainSec > 0;

  return (
    <div className="min-h-screen flex items-center justify-center bg-bg p-4">
      <div className="w-full max-w-md bg-white rounded-2xl border border-violet-100 shadow-card p-8 space-y-5">
        <div className="text-center space-y-2">
          <div className="inline-flex h-12 w-12 items-center justify-center rounded-full bg-violet-100 text-violet-600">
            <ShieldCheck size={22} aria-hidden="true" />
          </div>
          <h1 className="text-lg font-bold text-[#1E1B4B]">수혜기관 인증</h1>
          <p className="text-sm text-slate-500">{portalTitle}</p>
          <p className="text-xs text-slate-400">관리자로부터 받은 PIN 을 입력해 주세요.</p>
        </div>

        <input
          type="password"
          inputMode="numeric"
          maxLength={6}
          value={pin}
          onChange={(e) => setPin(e.target.value.replace(/[^0-9]/g, ''))}
          onKeyDown={(e) => { if (e.key === 'Enter') handleSubmit(); }}
          disabled={locked || submitting}
          placeholder="4~6자리 숫자"
          className="w-full h-12 rounded-xl border border-slate-200 px-4 text-center text-xl tracking-widest tabular-nums outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-200 disabled:bg-slate-50"
          aria-label="PIN 입력"
        />

        {error && !locked && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">
            {error}
          </p>
        )}
        {locked && (
          <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2 text-center font-semibold">
            🔒 {remainSec}초 후 다시 시도해 주세요.
          </p>
        )}

        <button type="button"
          onClick={handleSubmit}
          disabled={locked || submitting || pin.length < 4}
          className="w-full h-11 rounded-xl bg-violet-600 text-white font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors inline-flex items-center justify-center gap-2">
          {submitting && <Loader2 size={16} className="animate-spin" aria-hidden="true" />}
          확인
        </button>

        <p className="text-[10px] text-slate-400 text-center">
          3회 실패 시 60초 잠금이에요. PIN 이 기억나지 않으시면 관리자에게 문의해 주세요.
        </p>
      </div>
    </div>
  );
}
