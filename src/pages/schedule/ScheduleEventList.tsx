// bal24 v2 — 캘린더 하단 텍스트 일정 리스트 (STEP-UX-FIXES)
// 현재 월의 모든 일정을 날짜순으로 묶어서 텍스트 리스트로 표시

import { useMemo } from 'react';
import { CalendarDays } from 'lucide-react';
import { eventCoversDate, SOURCE_LABEL, type EventSource, type UnifiedEvent } from './scheduleUtils';

interface Props {
  /** 1-12 */
  year: number;
  month: number;
  events: UnifiedEvent[];
  onEventClick?: (event: UnifiedEvent) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

const SOURCE_PILL: Record<EventSource, string> = {
  project:    'bg-indigo-100 text-indigo-700 border-indigo-200',
  program:    'bg-emerald-100 text-emerald-700 border-emerald-200',
  task:       'bg-orange-100 text-orange-700 border-orange-200',
  attendance: 'bg-amber-100 text-amber-700 border-amber-200',
  custom:     'bg-slate-100 text-slate-700 border-slate-200',
};

function pad(n: number): string { return String(n).padStart(2, '0'); }

function buildMonthDays(year: number, month: number): string[] {
  const days: string[] = [];
  const last = new Date(year, month, 0).getDate();
  for (let d = 1; d <= last; d += 1) days.push(`${year}-${pad(month)}-${pad(d)}`);
  return days;
}

function formatHeader(date: string): string {
  const d = new Date(`${date}T00:00:00`);
  const m = d.getMonth() + 1;
  const day = d.getDate();
  return `${m}월 ${day}일 (${WEEKDAYS[d.getDay()]})`;
}

export default function ScheduleEventList({ year, month, events, onEventClick }: Props) {
  const todayIso = useMemo(() => {
    const d = new Date();
    return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
  }, []);

  // 날짜별 그룹핑 (현재 월의 일자만, 이벤트가 있는 날만)
  const grouped = useMemo(() => {
    const map = new Map<string, UnifiedEvent[]>();
    for (const date of buildMonthDays(year, month)) {
      const onDate = events.filter((e) => eventCoversDate(e, date));
      // 다일 이벤트는 시작일에만 표시 (중복 노출 방지)
      const filtered = onDate.filter((e) => !e.endDate || e.date === date);
      if (filtered.length === 0) continue;
      map.set(date, filtered.sort((a, b) => (a.startTime ?? '00:00').localeCompare(b.startTime ?? '00:00')));
    }
    return [...map.entries()];
  }, [events, year, month]);

  if (grouped.length === 0) {
    return (
      <section className="rounded-2xl border border-violet-100 bg-white p-8 text-center text-sm text-slate-500">
        <CalendarDays size={20} className="mx-auto text-violet-300 mb-1.5" aria-hidden="true" />
        이 달의 일정이 없어요.
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)] p-4 space-y-2">
      <header className="flex items-center gap-1.5 mb-2">
        <CalendarDays size={14} className="text-violet-500" aria-hidden="true" />
        <h2 className="text-sm font-bold text-[#1E1B4B]">{year}년 {month}월 일정 목록</h2>
        <span className="text-[11px] text-slate-400">{grouped.length}일 · 일정 {grouped.reduce((n, [, list]) => n + list.length, 0)}건</span>
      </header>
      <ul className="space-y-2.5">
        {grouped.map(([date, list]) => {
          const isPast = date < todayIso;
          const isToday = date === todayIso;
          return (
            <li key={date} className={isPast ? 'opacity-50' : ''}>
              <p className={`text-xs font-bold mb-1 ${isToday ? 'text-violet-700' : 'text-slate-700'}`}>
                {formatHeader(date)}
                {isToday && <span className="ml-1.5 text-[10px] font-semibold text-violet-600">오늘</span>}
              </p>
              <ul className="pl-2 space-y-0.5">
                {list.map((e) => (
                  <li key={e.id}>
                    <button type="button" onClick={() => onEventClick?.(e)}
                      className="w-full text-left flex items-center gap-1.5 text-xs hover:bg-violet-50 px-1.5 py-1 rounded transition-colors">
                      <span aria-hidden="true" className="text-slate-300">•</span>
                      <span className={`inline-block px-1.5 py-0.5 rounded border text-[10px] font-bold ${SOURCE_PILL[e.source]}`}>
                        {SOURCE_LABEL[e.source]}
                      </span>
                      {e.startTime && <span className="text-slate-500 tabular-nums shrink-0">{e.startTime}</span>}
                      <span className="text-slate-700 truncate">{e.title}</span>
                    </button>
                  </li>
                ))}
              </ul>
            </li>
          );
        })}
      </ul>
    </section>
  );
}
