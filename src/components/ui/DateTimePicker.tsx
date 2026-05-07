// bal24 v2 — DateTimePicker 공용 컴포넌트
// 모드: 'time' (시·분 그리드만) / 'datetime' (캘린더 + 시·분 그리드)
// V7 스크린샷 참고: 캘린더 + 시(06~23) + 분(00, 30) + [지금] [완료]

import { useEffect, useMemo, useRef, useState } from 'react';
import { Calendar, Clock, X, ChevronLeft, ChevronRight } from 'lucide-react';

type Mode = 'time' | 'datetime';

interface Props {
  mode: Mode;
  /** 'time' 모드: 'HH:MM' / 'datetime' 모드: 'YYYY-MM-DDTHH:MM' */
  value: string | null;
  onChange: (next: string | null) => void;
  placeholder?: string;
  hours?: number[];
  minutes?: number[];
  className?: string;
  disabled?: boolean;
}

const DEFAULT_HOURS = Array.from({ length: 18 }, (_, i) => i + 6);
const DEFAULT_MINUTES = [0, 30];

function pad2(n: number): string {
  return String(n).padStart(2, '0');
}

function parseValue(value: string | null, mode: Mode): {
  date: Date | null;
  hh: number | null;
  mm: number | null;
} {
  if (!value) return { date: null, hh: null, mm: null };
  if (mode === 'time') {
    const [hStr, mStr] = value.split(':');
    const hh = Number(hStr);
    const mm = Number(mStr);
    return {
      date: null,
      hh: Number.isFinite(hh) ? hh : null,
      mm: Number.isFinite(mm) ? mm : null,
    };
  }
  const [dPart, tPart] = value.split('T');
  const d = dPart ? new Date(`${dPart}T00:00`) : null;
  const [hStr, mStr] = (tPart ?? '').split(':');
  return {
    date: d && !Number.isNaN(d.getTime()) ? d : null,
    hh: Number.isFinite(Number(hStr)) ? Number(hStr) : null,
    mm: Number.isFinite(Number(mStr)) ? Number(mStr) : null,
  };
}

function formatDisplay(value: string | null, mode: Mode): string {
  if (!value) return '';
  if (mode === 'time') return value.slice(0, 5);
  const [d, t] = value.split('T');
  return `${d ?? ''} ${(t ?? '').slice(0, 5)}`.trim();
}

function buildMonthGrid(view: Date): Array<Date | null> {
  const first = new Date(view.getFullYear(), view.getMonth(), 1);
  const startDay = first.getDay();
  const daysInMonth = new Date(view.getFullYear(), view.getMonth() + 1, 0).getDate();
  const cells: Array<Date | null> = [];
  for (let i = 0; i < startDay; i += 1) cells.push(null);
  for (let d = 1; d <= daysInMonth; d += 1) {
    cells.push(new Date(view.getFullYear(), view.getMonth(), d));
  }
  while (cells.length % 7 !== 0) cells.push(null);
  return cells;
}

export default function DateTimePicker({
  mode, value, onChange, placeholder, hours, minutes, className, disabled,
}: Props) {
  const [open, setOpen] = useState(false);
  const wrapRef = useRef<HTMLDivElement | null>(null);
  const parsed = useMemo(() => parseValue(value, mode), [value, mode]);

  const [viewDate, setViewDate] = useState<Date>(() => parsed.date ?? new Date());
  const [draftHH, setDraftHH] = useState<number | null>(parsed.hh);
  const [draftMM, setDraftMM] = useState<number | null>(parsed.mm);
  const [draftDate, setDraftDate] = useState<Date | null>(parsed.date);

  const hourList = hours ?? DEFAULT_HOURS;
  const minuteList = minutes ?? DEFAULT_MINUTES;

  useEffect(() => {
    if (!open) return;
    const onClick = (e: MouseEvent) => {
      if (wrapRef.current && !wrapRef.current.contains(e.target as Node)) setOpen(false);
    };
    const onKey = (e: KeyboardEvent) => {
      if (e.key === 'Escape') setOpen(false);
    };
    document.addEventListener('mousedown', onClick);
    document.addEventListener('keydown', onKey);
    return () => {
      document.removeEventListener('mousedown', onClick);
      document.removeEventListener('keydown', onKey);
    };
  }, [open]);

  useEffect(() => {
    if (open) {
      setDraftHH(parsed.hh);
      setDraftMM(parsed.mm);
      setDraftDate(parsed.date);
      if (parsed.date) setViewDate(parsed.date);
    }
  }, [open, parsed.hh, parsed.mm, parsed.date]);

  function commit(next: { date: Date | null; hh: number | null; mm: number | null }) {
    if (mode === 'time') {
      if (next.hh == null || next.mm == null) {
        onChange(null);
        return;
      }
      onChange(`${pad2(next.hh)}:${pad2(next.mm)}`);
      return;
    }
    if (!next.date || next.hh == null || next.mm == null) {
      onChange(null);
      return;
    }
    const y = next.date.getFullYear();
    const m = pad2(next.date.getMonth() + 1);
    const d = pad2(next.date.getDate());
    onChange(`${y}-${m}-${d}T${pad2(next.hh)}:${pad2(next.mm)}`);
  }

  function handleDone() {
    commit({ date: draftDate, hh: draftHH, mm: draftMM });
    setOpen(false);
  }

  function handleNow() {
    const now = new Date();
    const hh = now.getHours();
    const mmCandidates = minuteList;
    const closest = mmCandidates.reduce(
      (best, m) => (Math.abs(m - now.getMinutes()) < Math.abs(best - now.getMinutes()) ? m : best),
      mmCandidates[0],
    );
    setDraftHH(hh);
    setDraftMM(closest);
    setDraftDate(now);
    setViewDate(now);
  }

  function handleClear() {
    onChange(null);
    setOpen(false);
  }

  const display = formatDisplay(value, mode);
  const Icon = mode === 'time' ? Clock : Calendar;

  return (
    <div ref={wrapRef} className={`relative inline-block w-full ${className ?? ''}`}>
      <button
        type="button"
        disabled={disabled}
        onClick={() => setOpen((v) => !v)}
        className="w-full inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-100 bg-white text-sm text-[#1E1B4B] hover:border-violet-300 focus:outline-none focus:ring-2 focus:ring-violet-100 transition-colors disabled:opacity-50"
      >
        <Icon size={14} className="shrink-0 text-violet-500" aria-hidden="true" />
        <span className={`flex-1 min-w-0 truncate text-left tabular-nums ${display ? '' : 'text-slate-400'}`}>
          {display || placeholder || (mode === 'time' ? '시간 선택' : '일시 선택')}
        </span>
        {value && (
          <span
            role="button"
            aria-label="값 비우기"
            onClick={(e) => { e.stopPropagation(); handleClear(); }}
            className="shrink-0 inline-flex items-center justify-center w-5 h-5 rounded-md text-slate-300 hover:text-rose-500 hover:bg-rose-50 transition-colors"
          >
            <X size={12} aria-hidden="true" />
          </span>
        )}
      </button>

      {open && (
        <div className="absolute z-50 mt-1 left-0 min-w-[280px] rounded-2xl border border-violet-100 bg-white shadow-[0_12px_40px_rgba(30,27,75,0.18)] p-3 flex flex-col gap-3">
          {mode === 'datetime' && (
            <div className="flex flex-col gap-2">
              <header className="flex items-center justify-between">
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() - 1, 1))}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-violet-50 text-slate-500"
                >
                  <ChevronLeft size={14} aria-hidden="true" />
                </button>
                <span className="text-xs font-bold text-[#1E1B4B] tabular-nums">
                  {viewDate.getFullYear()}년 {viewDate.getMonth() + 1}월
                </span>
                <button
                  type="button"
                  onClick={() => setViewDate(new Date(viewDate.getFullYear(), viewDate.getMonth() + 1, 1))}
                  className="inline-flex items-center justify-center w-7 h-7 rounded-md hover:bg-violet-50 text-slate-500"
                >
                  <ChevronRight size={14} aria-hidden="true" />
                </button>
              </header>
              <div className="grid grid-cols-7 gap-0.5">
                {['일', '월', '화', '수', '목', '금', '토'].map((w) => (
                  <span key={w} className="text-center text-[10px] font-bold text-slate-400 py-1">{w}</span>
                ))}
                {buildMonthGrid(viewDate).map((d, i) => {
                  if (!d) return <span key={`b-${i}`} className="h-8" />;
                  const isSelected = draftDate &&
                    d.getFullYear() === draftDate.getFullYear() &&
                    d.getMonth() === draftDate.getMonth() &&
                    d.getDate() === draftDate.getDate();
                  return (
                    <button
                      key={`d-${d.getTime()}`}
                      type="button"
                      onClick={() => setDraftDate(d)}
                      className={`h-8 text-xs rounded-md tabular-nums transition-colors ${
                        isSelected
                          ? 'bg-violet-600 text-white font-bold'
                          : 'text-[#1E1B4B] hover:bg-violet-50'
                      }`}
                    >
                      {d.getDate()}
                    </button>
                  );
                })}
              </div>
            </div>
          )}

          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">시</div>
            <div className="grid grid-cols-6 gap-1">
              {hourList.map((h) => (
                <button
                  key={`h-${h}`}
                  type="button"
                  onClick={() => setDraftHH(h)}
                  className={`h-7 text-xs rounded-md tabular-nums transition-colors ${
                    draftHH === h ? 'bg-violet-600 text-white font-bold' : 'text-[#1E1B4B] hover:bg-violet-50'
                  }`}
                >
                  {pad2(h)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex flex-col gap-1.5">
            <div className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">분</div>
            <div className="grid grid-cols-4 gap-1">
              {minuteList.map((m) => (
                <button
                  key={`m-${m}`}
                  type="button"
                  onClick={() => setDraftMM(m)}
                  className={`h-7 text-xs rounded-md tabular-nums transition-colors ${
                    draftMM === m ? 'bg-orange-500 text-white font-bold' : 'text-[#1E1B4B] hover:bg-orange-50'
                  }`}
                >
                  {pad2(m)}
                </button>
              ))}
            </div>
          </div>

          <div className="flex items-center justify-between gap-2 pt-2 border-t border-violet-100">
            <button
              type="button"
              onClick={handleNow}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
            >
              지금
            </button>
            <button
              type="button"
              onClick={handleDone}
              className="inline-flex items-center px-3 py-1.5 rounded-md text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
            >
              완료
            </button>
          </div>
        </div>
      )}
    </div>
  );
}
