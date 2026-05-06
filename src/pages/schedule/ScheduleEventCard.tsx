// bal24 v2 — 일정 목록 뷰 아이템 카드 (STEP 17)
// 좌측 컬러 바 + 이모지 + 제목 + 날짜·시간 + D-day 배지

import { Pencil, ExternalLink } from 'lucide-react';
import { formatDateKo } from '../../lib/utils';
import {
  SOURCE_EMOJI,
  SOURCE_LABEL,
  type UnifiedEvent,
} from './scheduleUtils';

interface Props {
  event: UnifiedEvent;
  onClick?: (event: UnifiedEvent) => void;
}

function badgeTone(badge?: string): string {
  if (!badge) return '';
  if (badge === '초과') return 'bg-rose-100 text-rose-700';
  if (badge === 'D-day') return 'bg-amber-100 text-amber-700';
  return 'bg-orange-100 text-orange-700';
}

export default function ScheduleEventCard({ event, onClick }: Props) {
  const isCustom = event.source === 'custom';
  const timeText =
    !event.allDay && event.startTime
      ? `${event.startTime}${event.endTime ? `~${event.endTime}` : ''}`
      : '';

  const dateText =
    event.endDate && event.endDate !== event.date
      ? `${formatDateKo(event.date)} ~ ${formatDateKo(event.endDate)}`
      : formatDateKo(event.date);

  return (
    <button
      type="button"
      onClick={() => onClick?.(event)}
      className="group relative w-full flex items-center gap-3 rounded-2xl border border-violet-100 bg-white px-4 py-3 text-left shadow-[0_4px_16px_rgba(124,58,237,0.06)] transition hover:border-violet-200 hover:shadow-[0_6px_20px_rgba(124,58,237,0.12)]"
    >
      <span
        aria-hidden="true"
        className="absolute left-0 top-3 bottom-3 w-1 rounded-r"
        style={{ backgroundColor: event.color }}
      />

      <div className="flex-1 min-w-0 pl-2">
        <div className="flex items-center gap-2 text-sm font-semibold text-[#1E1B4B]">
          <span aria-hidden="true">{SOURCE_EMOJI[event.source]}</span>
          <span className="truncate">{event.title}</span>
        </div>
        <div className="mt-1 flex items-center gap-2 text-xs text-slate-500">
          <span>{dateText}</span>
          {timeText && <span>· {timeText}</span>}
          <span className="rounded-full bg-slate-100 px-2 py-0.5 text-[11px] text-slate-600">
            {SOURCE_LABEL[event.source]}
          </span>
        </div>
      </div>

      {event.badge && (
        <span className={`shrink-0 rounded-full px-2 py-0.5 text-xs font-semibold ${badgeTone(event.badge)}`}>
          {event.badge}
        </span>
      )}

      {isCustom ? (
        <Pencil size={16} className="shrink-0 text-slate-400 group-hover:text-violet-600 transition-colors" aria-hidden="true" />
      ) : (
        <ExternalLink size={16} className="shrink-0 text-slate-300 group-hover:text-slate-500 transition-colors" aria-hidden="true" />
      )}
    </button>
  );
}
