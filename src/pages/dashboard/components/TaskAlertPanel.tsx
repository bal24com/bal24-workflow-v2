// bal24 v2 — 오늘·지연 태스크 알림 패널 (V7 HomeV9 오늘·지연 할 일 차용)
// 자체 fetch (props drilling 없음) + cancelled 가드.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Activity, ArrowRight, Loader2 } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { fetchTaskBuckets, type TaskBuckets, type TaskAlertRow } from '../dashboardUtils';
import { formatDateKo } from '../../../lib/utils';

type RowTone = 'overdue' | 'today';

const TONE_STYLE: Record<RowTone, { container: string; chip: string; meta: string; chipLabel: string }> = {
  overdue: {
    container: 'bg-rose-50/60 border-rose-200 hover:bg-rose-50',
    chip: 'bg-rose-500 text-white',
    meta: 'text-rose-600',
    chipLabel: '지연',
  },
  today: {
    container: 'bg-orange-50/60 border-orange-200 hover:bg-orange-50',
    chip: 'bg-orange-500 text-white',
    meta: 'text-orange-600',
    chipLabel: '오늘',
  },
};

function TaskRow({ task, tone }: { task: TaskAlertRow; tone: RowTone }) {
  const t = TONE_STYLE[tone];
  return (
    <li>
      <Link
        to={`/projects/${task.project_id}`}
        className={`block rounded-xl border ${t.container} p-2.5 transition-colors`}
      >
        <div className="flex items-center gap-1.5">
          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded-full ${t.chip}`}>
            {t.chipLabel}
          </span>
          <span className="text-[11px] text-slate-500 truncate flex-1">
            {task.project_name ?? '프로젝트'}
          </span>
        </div>
        <p className="mt-1 text-xs font-semibold text-slate-700 truncate">{task.title}</p>
        {task.due_date && (
          <p className={`mt-0.5 text-[10px] font-bold tabular-nums ${t.meta}`}>
            {formatDateKo(task.due_date)}
          </p>
        )}
      </Link>
    </li>
  );
}

export default function TaskAlertPanel() {
  const toast = useToast();
  const [buckets, setBuckets] = useState<TaskBuckets | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const b = await fetchTaskBuckets(8);
        if (cancelled) return;
        setBuckets(b);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[dashboard] 태스크 알림 조회 실패:', raw);
        toast.error('태스크 알림을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [toast]);

  const total = (buckets?.todayDue.length ?? 0) + (buckets?.overdue.length ?? 0);
  const isEmpty = !loading && total === 0;

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h2 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Activity size={16} className="text-rose-500" aria-hidden="true" />
          오늘·지연 할 일
        </h2>
        <Link
          to="/projects"
          className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
        >
          프로젝트 열기
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </header>

      {loading ? (
        <div className="flex justify-center py-8">
          <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
        </div>
      ) : isEmpty ? (
        <p className="text-sm text-slate-400 italic text-center py-6">
          오늘 마감 · 지연 태스크가 없어요. 깨끗합니다 ✨
        </p>
      ) : (
        <ul className="space-y-1.5 max-h-72 overflow-y-auto pr-1">
          {buckets?.overdue.map((t) => <TaskRow key={t.id} task={t} tone="overdue" />)}
          {buckets?.todayDue.map((t) => <TaskRow key={t.id} task={t} tone="today" />)}
        </ul>
      )}
    </section>
  );
}
