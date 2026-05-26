// bal24 v2 — STEP-STAFF-PORTAL-PIN-GATEWAY (박경수님 2026-05-26)
// 6자리 PIN 입력 블록 — 6개 단일 input 셀.
// 숫자 1자 입력 → 다음 셀 자동 포커스. Backspace → 이전 셀. 6자리 붙여넣기 분배.

import { useEffect, useRef, type ChangeEvent, type ClipboardEvent, type KeyboardEvent } from 'react';

interface Props {
  value: string;
  onChange: (next: string) => void;
  disabled?: boolean;
  mask?: boolean;                       // 비밀번호 마스킹 (●). 기본 false (입력 보임)
  autoFocus?: boolean;
  /** 6자리 다 입력했을 때 호출 (Enter 또는 마지막 셀 채움 직후) */
  onComplete?: (pin: string) => void;
  ariaLabel?: string;
}

const CELL_BASE =
  'w-10 h-12 sm:w-12 sm:h-14 text-center text-xl sm:text-2xl font-bold tabular-nums ' +
  'border-2 rounded-lg outline-none transition-colors ' +
  'focus:border-violet-500 focus:ring-2 focus:ring-violet-500/20 disabled:bg-slate-50';

export default function PinInputBlock({
  value, onChange, disabled, mask, autoFocus, onComplete, ariaLabel,
}: Props) {
  const refs = useRef<Array<HTMLInputElement | null>>([null, null, null, null, null, null]);

  useEffect(() => {
    if (autoFocus && !disabled) refs.current[0]?.focus();
  }, [autoFocus, disabled]);

  function setCharAt(idx: number, ch: string) {
    const next = (value + '      ').slice(0, 6).split('');
    next[idx] = ch;
    const joined = next.join('').replace(/\s/g, '').slice(0, 6);
    onChange(joined);
    if (joined.length === 6 && onComplete) onComplete(joined);
  }

  function handleChange(e: ChangeEvent<HTMLInputElement>, idx: number) {
    const raw = e.target.value.replace(/\D/g, '');
    if (raw.length === 0) {
      setCharAt(idx, '');
      return;
    }
    // 한 번에 6자리 붙여넣기 케이스
    if (raw.length >= 6) {
      const pin = raw.slice(0, 6);
      onChange(pin);
      if (onComplete) onComplete(pin);
      refs.current[5]?.focus();
      return;
    }
    // 일반 1자 입력
    const ch = raw.slice(-1);
    setCharAt(idx, ch);
    if (idx < 5) refs.current[idx + 1]?.focus();
  }

  function handleKeyDown(e: KeyboardEvent<HTMLInputElement>, idx: number) {
    if (e.key === 'Backspace' && !value[idx] && idx > 0) {
      e.preventDefault();
      const next = value.slice(0, idx - 1);
      onChange(next);
      refs.current[idx - 1]?.focus();
      return;
    }
    if (e.key === 'ArrowLeft' && idx > 0) {
      e.preventDefault();
      refs.current[idx - 1]?.focus();
      return;
    }
    if (e.key === 'ArrowRight' && idx < 5) {
      e.preventDefault();
      refs.current[idx + 1]?.focus();
      return;
    }
    if (e.key === 'Enter' && value.length === 6 && onComplete) {
      onComplete(value);
    }
  }

  function handlePaste(e: ClipboardEvent<HTMLInputElement>) {
    const raw = e.clipboardData.getData('text').replace(/\D/g, '').slice(0, 6);
    if (raw.length === 0) return;
    e.preventDefault();
    onChange(raw);
    if (raw.length === 6 && onComplete) onComplete(raw);
    refs.current[Math.min(raw.length, 5)]?.focus();
  }

  return (
    <div className="flex items-center gap-1.5 sm:gap-2" role="group" aria-label={ariaLabel ?? 'PIN 6자리 입력'}>
      {Array.from({ length: 6 }).map((_, idx) => {
        const ch = value[idx] ?? '';
        const display = mask && ch ? '●' : ch;
        const filled = !!ch;
        return (
          <input
            key={idx}
            ref={(el) => { refs.current[idx] = el; }}
            type="text"
            inputMode="numeric"
            pattern="[0-9]*"
            autoComplete="one-time-code"
            maxLength={1}
            disabled={disabled}
            value={display}
            onChange={(e) => handleChange(e, idx)}
            onKeyDown={(e) => handleKeyDown(e, idx)}
            onPaste={handlePaste}
            aria-label={`PIN ${idx + 1}번째 자리`}
            className={`${CELL_BASE} ${filled ? 'border-violet-300 bg-violet-50/40' : 'border-gray-300 bg-white'}`}
          />
        );
      })}
    </div>
  );
}
