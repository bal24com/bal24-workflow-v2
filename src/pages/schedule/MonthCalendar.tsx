// bal24 v2 — 월간 캘린더 그리드 (STEP 17)
// 6주 × 7일 grid, 오늘 강조, 기간 이벤트 바, 단일 이벤트 점 + 제목

import { useMemo } from 'react';
import { eventsOnDate, type UnifiedEvent } from './scheduleUtils';

interface Props {
  year: number;
  month: number; // 1-12
  events: UnifiedEvent[];
  /** 빈 셀 클릭 — 신규 등록 (date pre-fill) */
  onCellClick?: (date: string) => void;
  /** 이벤트 클릭 — 분기 처리 (custom 수정 / 그 외 원본 페이지) */
  onEventClick?: (event: UnifiedEvent) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(year: number, month: number, day: number): string {
  return `${year}-${pad(month)}-${pad(day)}`;
}

function buildGrid(year: number, month: number): Array<{ date: string; inMonth: boolean }> {
  const firstDay = new Date(year, month - 1, 1);
  const lastDate = new Date(year, month, 0).getDate();
  const startWeekday = firstDay.getDay(); // 0=일

  const cells: Array<{ date: string; inMonth: boolean }> = [];

  // 이전 달 채우기
  if (startWeekday > 0) {
    const prevMonthLast = new Date(year, month - 1, 0).getDate();
    for (let i = startWeekday - 1; i >= 0; i -= 1) {
      const d = prevMonthLast - i;
      const prevMonth = month === 1 ? 12 : month - 1;
      const prevYear = month === 1 ? year - 1 : year;
      cells.push({ date: isoDate(prevYear, prevMonth, d), inMonth: false });
    }
  }

  // 이번 달
  for (let d = 1; d <= lastDate; d += 1) {
    cells.push({ date: isoDate(year, month, d), inMonth: true });
  }

  // 다음 달 채우기 — 항상 6주(42칸) 유지
  while (cells.length < 42) {
    const remain = cells.length - startWeekday - lastDate + 1;
    const nextMonth = month === 12 ? 1 : month + 1;
    const nextYear = month === 12 ? year + 1 : year;
    cells.push({ date: isoDate(nextYear, nextMonth, remain), inMonth: false });
  }

  return cells;
}

export default function MonthCalendar({ year, month, events, onCellClick, onEventClick }: Props) {
  const cells = useMemo(() => buildGrid(year, month), [year, month]);
  const todayIso = useMemo(() => {
    const d = new Date();
    return isoDate(d.getFullYear(), d.getMonth() + 1, d.getDate());
  }, []);

  return (
    <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)] overflow-hidden">
      {/* 요일 헤더 */}
      <div className="grid grid-cols-7 border-b border-slate-100">
        {WEEKDAYS.map((w, idx) => (
          <div
            key={w}
            className={`px-3 py-2 text-center text-xs font-semibold ${
              idx === 0 ? 'text-rose-500' : idx === 6 ? 'text-sky-600' : 'text-slate-600'
            }`}
          >
            {w}
          </div>
        ))}
      </div>

      {/* 6주 그리드 */}
      <div className="grid grid-cols-7 grid-rows-6 divide-x divide-y divide-slate-100 min-h-[600px]">
        {cells.map((cell) => {
          const dayNum = Number(cell.date.slice(8, 10));
          const dayOfWeek = new Date(`${cell.date}T00:00:00`).getDay();
          const isToday = cell.date === todayIso;
          const cellEvents = eventsOnDate(events, cell.date);

          return (
            <div
              key={cell.date}
              className={`relative flex flex-col gap-1 px-1.5 py-1.5 cursor-pointer transition-colors ${
                cell.inMonth ? 'bg-white hover:bg-violet-50/40' : 'bg-slate-50/50 hover:bg-slate-100'
              }`}
              onClick={(e) => {
                if ((e.target as HTMLElement).closest('[data-event-chip]')) return;
                onCellClick?.(cell.date);
              }}
              role="gridcell"
              aria-label={`${cell.date} 날짜 칸`}
            >
              <div className="flex items-center justify-between">
                <span
                  className={
                    isToday
                      ? 'inline-flex h-6 w-6 items-center justify-center rounded-full bg-violet-600 text-[11px] font-bold text-white'
                      : `text-xs font-semibold ${
                          !cell.inMonth
                            ? 'text-slate-300'
                            : dayOfWeek === 0
                              ? 'text-rose-500'
                              : dayOfWeek === 6
                                ? 'text-sky-600'
                                : 'text-slate-700'
                        }`
                  }
                >
                  {dayNum}
                </span>
              </div>

              <div className="flex flex-col gap-0.5 overflow-hidden">
                {cellEvents.slice(0, 3).map((event) => (
                  <button
                    key={event.id}
                    type="button"
                    data-event-chip="true"
                    onClick={(e) => {
                      e.stopPropagation();
                      onEventClick?.(event);
                    }}
                    className="truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white hover:opacity-90 transition-opacity"
                    style={{ backgroundColor: event.color }}
                    title={event.title}
                  >
                    {event.allDay ? event.title : `${event.startTime ?? ''} ${event.title}`}
                  </button>
                ))}
                {cellEvents.length > 3 && (
                  <span className="px-1.5 text-[10px] text-slate-500">+{cellEvents.length - 3}개 더</span>
                )}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
