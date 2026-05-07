// bal24 v2 — 프로젝트 개요 · 이벤트·행사 일정 (V7 통합 일정 차용)
// programs (project_id) + schedule_events (project_id) 묶어서 표시.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CalendarDays, Loader2, GraduationCap, ArrowRight } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { formatDateKo } from '../../../../lib/utils';
import { BADGE_BASE, PROGRAM_TYPE_STYLE } from '../../../../utils/statusStyles';
import { fetchProjectEvents, type ProjectEventsBundle } from '../projectDetailUtils';
import type { ScheduleCategory } from '../../../../types/database';

const CATEGORY_LABEL: Record<ScheduleCategory, string> = {
  meeting: '미팅',
  deadline: '마감',
  external: '외부',
  personal: '개인',
  etc: '기타',
};

const CATEGORY_STYLE: Record<ScheduleCategory, string> = {
  meeting: 'bg-violet-50 text-violet-600 border-violet-200',
  deadline: 'bg-rose-50 text-rose-600 border-rose-200',
  external: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  personal: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  etc: 'bg-slate-100 text-slate-500 border-slate-200',
};

export default function EventsTimelineCard({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [data, setData] = useState<ProjectEventsBundle | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchProjectEvents(projectId);
        if (cancelled) return;
        setData(res);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[project-detail] 이벤트 조회 실패:', raw);
        toast.error('이벤트 일정을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  const totalCount = (data?.programs.length ?? 0) + (data?.schedules.length ?? 0);

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <CalendarDays size={16} className="text-orange-500" aria-hidden="true" />
          이벤트·행사 일정
          {!loading && totalCount > 0 && (
            <span className="text-[10px] text-slate-400 font-normal">{totalCount}건</span>
          )}
        </h3>
        <Link
          to="/schedule"
          className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
        >
          캘린더
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </header>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : totalCount === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">
          연결된 프로그램·일정이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-72 overflow-y-auto pr-1">
          {data?.programs.map((p) => (
            <li key={`prog-${p.id}`}>
              <Link
                to={`/programs`}
                className="block rounded-xl border border-violet-100 bg-violet-50/40 hover:bg-violet-50 px-3 py-2 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <GraduationCap size={13} className="shrink-0 text-violet-600" aria-hidden="true" />
                  <span className={`${BADGE_BASE} ${PROGRAM_TYPE_STYLE[p.type]} shrink-0`}>{p.type}</span>
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                    {p.name}
                  </span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 truncate">
                  {formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}
                  {p.venue && <span> · {p.venue}</span>}
                </p>
              </Link>
            </li>
          ))}
          {data?.schedules.map((s) => (
            <li key={`sch-${s.id}`}>
              <Link
                to="/schedule"
                className="block rounded-xl border border-orange-100 bg-orange-50/40 hover:bg-orange-50 px-3 py-2 transition-colors"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${CATEGORY_STYLE[s.category]} shrink-0`}
                  >
                    {CATEGORY_LABEL[s.category]}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                    {s.title}
                  </span>
                </div>
                <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums">
                  {formatDateKo(s.event_date)}
                  {!s.all_day && s.start_time && <span> · {s.start_time.slice(0, 5)}</span>}
                </p>
              </Link>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
