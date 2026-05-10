// bal24 v2 — 주간 캘린더 타임라인 (STEP 17)
// 7일 헤더 + allDay 이벤트 행 + 시간축(0~23h) + 시간 이벤트 블록

import { useMemo } from 'react';
import { Pin } from 'lucide-react';
import { weekRange, type UnifiedEvent } from './scheduleUtils';

interface Props {
  /** 주의 기준 일자 */
  baseDate: Date;
  events: UnifiedEvent[];
  /** 정적 + DB 휴일 통합 Map (date → name) */
  holidayMap: Map<string, string>;
  onEventClick?: (event: UnifiedEvent) => void;
  onCellClick?: (date: string, hour: number) => void;
}

const WEEKDAYS = ['일', '월', '화', '수', '목', '금', '토'];
const HOURS = Array.from({ length: 24 }, (_, i) => i); // 0~23
const HOUR_HEIGHT = 48; // px

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function isoDate(d: Date): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
}

function timeToMinutes(hhmm?: string): number {
  if (!hhmm) return 0;
  const [h, m] = hhmm.split(':').map(Number);
  return (h || 0) * 60 + (m || 0);
}

interface PositionedEvent extends UnifiedEvent {
  topPx: number;
  heightPx: number;
}

function positionEvent(event: UnifiedEvent): PositionedEvent {
  const startMin = timeToMinutes(event.startTime);
  const endMin = event.endTime ? timeToMinutes(event.endTime) : startMin + 60;
  const topPx = (startMin / 60) * HOUR_HEIGHT;
  const heightPx = Math.max(20, ((endMin - startMin) / 60) * HOUR_HEIGHT);
  return { ...event, topPx, heightPx };
}

export default function WeekCalendar({ baseDate, events, holidayMap, onEventClick, onCellClick }: Props) {
  const { days } = useMemo(() => weekRange(baseDate), [baseDate]);
  const todayIso = useMemo(() => isoDate(new Date()), []);

  const eventsByDay = useMemo(() => {
    const allDay = new Map<string, UnifiedEvent[]>();
    const timed = new Map<string, PositionedEvent[]>();

    for (const day of days) {
      const dayIso = isoDate(day);
      allDay.set(dayIso, []);
      timed.set(dayIso, []);
    }

    for (const event of events) {
      // 기간 이벤트 (endDate 있음) → 각 날짜에 allDay
      if (event.endDate) {
        for (const day of days) {
          const dayIso = isoDate(day);
          if (event.date <= dayIso && dayIso <= event.endDate) {
            allDay.get(dayIso)?.push(event);
          }
        }
        continue;
      }

      // 단일 일자
      const list = event.allDay || !event.startTime
        ? allDay.get(event.date)
        : timed.get(event.date);
      if (!list) continue;

      if (event.allDay || !event.startTime) {
        list.push(event);
      } else {
        (list as PositionedEvent[]).push(positionEvent(event));
      }
    }

    return { allDay, timed };
  }, [days, events]);

  return (
    <div className="rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)] overflow-hidden">
      {/* 헤더 — 요일 + 날짜 */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100 bg-[#FFEDD8]">
        <div />
        {days.map((day, idx) => {
          const dayIso = isoDate(day);
          const isTodayCol = dayIso === todayIso;
          const holidayName = holidayMap.get(dayIso) ?? null;
          const isHoliday = Boolean(holidayName);
          const weekdayColor = idx === 0 || isHoliday ? '#F43F5E' : idx === 6 ? '#3B82F6' : '#374151';
          return (
            <div
              key={dayIso}
              className={`px-2 py-2 text-center ${
                isTodayCol ? 'bg-violet-50' : isHoliday ? 'bg-[#FEE2E2]' : ''
              }`}
            >
              <div
                className="text-[10px] font-semibold"
                style={{ color: weekdayColor }}
              >
                {WEEKDAYS[idx]}
              </div>
              <div
                className="mt-0.5 text-sm font-bold"
                style={{ color: isTodayCol ? '#6D28D9' : isHoliday ? '#F43F5E' : '#1E1B4B' }}
              >
                {day.getDate()}
              </div>
              {holidayName && (
                <div className="text-[9px] font-medium text-rose-600 truncate">{holidayName}</div>
              )}
            </div>
          );
        })}
      </div>

      {/* allDay 행 */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] border-b border-slate-100 min-h-[44px]">
        <div className="px-2 py-1.5 text-[10px] font-semibold text-slate-400 self-center text-right">
          종일
        </div>
        {days.map((day) => {
          const dayIso = isoDate(day);
          const list = eventsByDay.allDay.get(dayIso) ?? [];
          return (
            <div key={dayIso} className="px-1 py-1 space-y-0.5 border-l border-slate-100">
              {list.map((event) => (
                <button
                  key={`${event.id}-${dayIso}`}
                  type="button"
                  onClick={() => onEventClick?.(event)}
                  className="flex w-full items-center gap-1 truncate rounded px-1.5 py-0.5 text-left text-[11px] font-medium text-white hover:opacity-90 transition-opacity bg-gradient-to-r from-emerald-400 to-blue-400"
                  title={event.title}
                >
                  <Pin size={10} className="shrink-0" aria-hidden="true" />
                  <span className="truncate">{event.title}</span>
                </button>
              ))}
            </div>
          );
        })}
      </div>

      {/* 시간축 + 이벤트 블록 */}
      <div className="grid grid-cols-[60px_repeat(7,1fr)] overflow-y-auto" style={{ maxHeight: '60vh' }}>
        <div className="border-r border-slate-100">
          {HOURS.map((h) => (
            <div
              key={h}
              className="text-[10px] text-slate-400 text-right pr-2"
              style={{ height: `${HOUR_HEIGHT}px`, lineHeight: '1' }}
            >
              {h === 0 ? '' : `${pad(h)}:00`}
            </div>
          ))}
        </div>

        {days.map((day) => {
          const dayIso = isoDate(day);
          const list = eventsByDay.timed.get(dayIso) ?? [];
          const isTodayCol = dayIso === todayIso;
          return (
            <div
              key={dayIso}
              className={`relative border-l border-slate-100 ${isTodayCol ? 'bg-violet-50/30' : ''}`}
              style={{ height: `${HOUR_HEIGHT * 24}px` }}
            >
              {/* 시간 격자 */}
              {HOURS.map((h) => (
                <div
                  key={h}
                  className="border-b border-slate-50 cursor-pointer hover:bg-violet-50/40"
                  style={{ height: `${HOUR_HEIGHT}px` }}
                  onClick={() => onCellClick?.(dayIso, h)}
                />
              ))}

              {/* 이벤트 블록 */}
              {list.map((event) => (
                <button
                  key={`${event.id}-${dayIso}`}
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onEventClick?.(event);
                  }}
                  className="absolute left-0.5 right-0.5 rounded px-1.5 py-1 text-left text-[11px] font-medium text-white shadow-sm hover:opacity-90 transition-opacity overflow-hidden bg-gradient-to-r from-emerald-400 to-blue-400"
                  style={{
                    top: `${event.topPx}px`,
                    height: `${event.heightPx}px`,
                  }}
                  title={event.title}
                >
                  <div className="flex items-center gap-1 truncate font-semibold">
                    <Pin size={10} className="shrink-0" aria-hidden="true" />
                    <span className="truncate">{event.title}</span>
                  </div>
                  {event.startTime && (
                    <div className="truncate text-[10px] opacity-90">
                      {event.startTime}
                      {event.endTime ? `~${event.endTime}` : ''}
                    </div>
                  )}
                </button>
              ))}
            </div>
          );
        })}
      </div>
    </div>
  );
}
