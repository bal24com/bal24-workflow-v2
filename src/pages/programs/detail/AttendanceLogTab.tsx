// bal24 v2 — 프로그램 상세 · 출석·일지 탭
// attendance_sessions + activity_logs 임베드.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, ClipboardCheck, ListChecks, Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import {
  fetchProgramSessions,
  fetchProgramActivities,
  activityLogTypeLabel,
  type SessionRow,
  type ActivityRow,
} from './programDetailUtils';
import type { ActivityLogType } from '../../../types/database';

const TYPE_STYLE: Record<ActivityLogType, string> = {
  mentoring: 'bg-violet-50 text-violet-600 border-violet-200',
  lecture: 'bg-orange-50 text-orange-600 border-orange-200',
  business_trip: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  ta: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  operation: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function AttendanceLogTab({ programId }: { programId: string }) {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [s, a] = await Promise.all([
          fetchProgramSessions(programId),
          fetchProgramActivities(programId, 8),
        ]);
        if (cancelled) return;
        setSessions(s);
        setActivities(a);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[program-detail] 출석·일지 로드 실패:', raw);
        toast.error('출석·일지 정보를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 출석 세션 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <ClipboardCheck size={16} className="text-emerald-500" aria-hidden="true" />
            출석 세션 ({sessions.length})
          </h3>
          <Link
            to="/attendance"
            className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
          >
            <Plus size={12} aria-hidden="true" />새 세션
          </Link>
        </header>
        {sessions.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">등록된 출석 세션이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
            {sessions.map((s) => (
              <li key={s.id}>
                <Link
                  to={`/attendance/${s.id}`}
                  className="block rounded-xl border border-emerald-100 bg-emerald-50/30 hover:bg-emerald-50 px-3 py-2 transition-colors"
                >
                  <div className="flex items-center gap-1.5">
                    <span
                      className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                        s.check_in_open
                          ? 'bg-emerald-500 text-white'
                          : 'bg-slate-200 text-slate-500'
                      }`}
                    >
                      {s.check_in_open ? '진행중' : '마감'}
                    </span>
                    <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                      {s.title}
                    </span>
                    <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                      {s.record_count}명
                    </span>
                  </div>
                  <p className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                    {formatDateKo(s.session_date)}
                    {s.start_time && (
                      <span>
                        {' · '}
                        {s.start_time.slice(0, 5)}
                        {s.end_time && `~${s.end_time.slice(0, 5)}`}
                      </span>
                    )}
                  </p>
                </Link>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 활동 일지 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <ListChecks size={16} className="text-violet-500" aria-hidden="true" />
            활동 일지 ({activities.length})
          </h3>
          <Link
            to="/activity-logs"
            className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
          >
            <Plus size={12} aria-hidden="true" />새 일지
          </Link>
        </header>
        {activities.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">기록된 활동이 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-[420px] overflow-y-auto pr-1">
            {activities.map((a) => (
              <li
                key={a.id}
                className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <span
                    className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${TYPE_STYLE[a.log_type]} shrink-0`}
                  >
                    {activityLogTypeLabel(a.log_type)}
                  </span>
                  <span className="text-[11px] text-slate-500 ml-auto tabular-nums shrink-0">
                    {formatDateKo(a.activity_date)}
                  </span>
                </div>
                <p className="mt-1 text-xs font-semibold text-[#1E1B4B] line-clamp-2">{a.title}</p>
                <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                  {a.duration_hours != null && <span>⏱ {a.duration_hours}h</span>}
                  {a.attendee_count != null && <span>👥 {a.attendee_count}명</span>}
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
