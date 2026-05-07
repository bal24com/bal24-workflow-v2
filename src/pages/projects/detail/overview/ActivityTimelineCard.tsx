// bal24 v2 — 프로젝트 개요 · 활동 타임라인 (V7 차용)
// activity_logs.project_id 최근 8건 표시. 등록은 /activity-logs 메뉴.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, Loader2, Plus } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { formatDateKo } from '../../../../lib/utils';
import {
  fetchProjectActivities,
  activityLogTypeLabel,
  type ActivityRow,
} from '../projectDetailUtils';
import type { ActivityLogType } from '../../../../types/database';

const TYPE_STYLE: Record<ActivityLogType, string> = {
  mentoring: 'bg-violet-50 text-violet-600 border-violet-200',
  lecture: 'bg-orange-50 text-orange-600 border-orange-200',
  business_trip: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  ta: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  operation: 'bg-slate-100 text-slate-600 border-slate-200',
};

export default function ActivityTimelineCard({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchProjectActivities(projectId, 8);
        if (cancelled) return;
        setRows(res);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[project-detail] 활동 타임라인 실패:', raw);
        toast.error('활동 기록을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Activity size={16} className="text-violet-500" aria-hidden="true" />
          활동 타임라인
          {!loading && rows.length > 0 && (
            <span className="text-[10px] text-slate-400 font-normal">최근 {rows.length}건</span>
          )}
        </h3>
        <Link
          to="/activity-logs"
          className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
        >
          <Plus size={12} aria-hidden="true" />
          새 일지
        </Link>
      </header>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">
          기록된 활동이 없어요. 일지 메뉴에서 등록해 보세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
          {rows.map((r) => (
            <li
              key={r.id}
              className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2"
            >
              <div className="flex items-center gap-1.5">
                <span
                  className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${TYPE_STYLE[r.log_type]} shrink-0`}
                >
                  {activityLogTypeLabel(r.log_type)}
                </span>
                <span className="text-[11px] text-slate-500 ml-auto tabular-nums shrink-0">
                  {formatDateKo(r.activity_date)}
                </span>
              </div>
              <p className="mt-1 text-xs font-semibold text-[#1E1B4B] line-clamp-2">{r.title}</p>
              <div className="mt-0.5 flex items-center gap-2 text-[10px] text-slate-400">
                {r.duration_hours != null && <span>⏱ {r.duration_hours}h</span>}
                {r.attendee_count != null && <span>👥 {r.attendee_count}명</span>}
              </div>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
