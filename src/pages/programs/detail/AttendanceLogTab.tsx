// bal24 v2 — 프로그램 상세 · 출석·일지 탭 (Stage 11-② 강화)
// 3 sub 섹션: 출석 / 일지 / 수료증 (sub 탭 전환).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, ClipboardCheck, ListChecks, Plus, Award,
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import {
  fetchProgramActivities, activityLogTypeLabel, type ActivityRow,
} from './programDetailUtils';
import SessionManagePanel from './attendance/SessionManagePanel';
import CertificateIssuePanel from './attendance/CertificateIssuePanel';
import AttendanceLinkSection from './attendance/AttendanceLinkSection';
import AttendanceAISection from './attendance/AttendanceAISection';
import AttendanceGridTable from './attendance/AttendanceGridTable';
import type { ActivityLogType } from '../../../types/database';

type SubTab = 'attendance' | 'log' | 'certificate';

const SUB_TABS: { key: SubTab; label: string; Icon: typeof ClipboardCheck }[] = [
  { key: 'attendance',  label: '출석',     Icon: ClipboardCheck },
  { key: 'log',         label: '일지',     Icon: ListChecks },
  { key: 'certificate', label: '수료증',   Icon: Award },
];

const TYPE_STYLE: Record<ActivityLogType, string> = {
  mentoring: 'bg-violet-50 text-violet-600 border-violet-200',
  lecture: 'bg-orange-50 text-orange-600 border-orange-200',
  business_trip: 'bg-cyan-50 text-cyan-600 border-cyan-200',
  ta: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  operation: 'bg-slate-100 text-slate-600 border-slate-200',
  dispatch: 'bg-rose-50 text-rose-600 border-rose-200',
};

export default function AttendanceLogTab({ programId }: { programId: string }) {
  const [sub, setSub] = useState<SubTab>('attendance');
  const [gridKey, setGridKey] = useState(0);

  return (
    <div className="flex flex-col gap-3">
      {/* sub 탭 */}
      <nav
        role="tablist"
        aria-label="출석·일지 sub 탭"
        className="inline-flex items-center bg-violet-50 rounded-full p-0.5 border border-violet-100 self-start"
      >
        {SUB_TABS.map(({ key, label, Icon }) => {
          const active = sub === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSub(key)}
              className={`inline-flex items-center gap-1 h-8 px-3 text-xs font-bold rounded-full transition-colors ${
                active ? 'bg-violet-600 text-white' : 'text-violet-600 hover:bg-violet-100'
              }`}
            >
              <Icon size={12} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* sub 본문 */}
      {sub === 'attendance' && (
        <>
          {/* STEP-PROGRAM-ENHANCE-FULL — AI 출석 자동 처리 + 출석표 */}
          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
            <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
              <ClipboardCheck size={16} className="text-violet-500" aria-hidden="true" />
              AI 출석 자동 처리
            </h3>
            <AttendanceAISection programId={programId} onProcessed={() => setGridKey((k) => k + 1)} />
          </section>
          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
            <h3 className="text-sm font-bold text-[#1E1B4B]">출석 현황</h3>
            <AttendanceGridTable programId={programId} refreshKey={gridKey} />
          </section>
          {/* STEP-CURRICULUM-ATTEND-SURVEY-FULL — 차시별 외부 출석 링크·파일 */}
          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-2">
            <h3 className="text-sm font-bold text-[#1E1B4B]">차시별 출석 링크·파일</h3>
            <AttendanceLinkSection programId={programId} />
          </section>
          <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
            <SessionManagePanel programId={programId} />
          </section>
        </>
      )}

      {sub === 'log' && <ActivityLogSection programId={programId} />}

      {sub === 'certificate' && (
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <CertificateIssuePanel programId={programId} />
        </section>
      )}
    </div>
  );
}

function ActivityLogSection({ programId }: { programId: string }) {
  const toast = useToast();
  const [activities, setActivities] = useState<ActivityRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const a = await fetchProgramActivities(programId, 12);
        if (cancelled) return;
        setActivities(a);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[step-11/log] 활동 일지 조회 실패:', raw);
        toast.error('활동 일지를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [programId, toast]);

  return (
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
          <Plus size={12} aria-hidden="true" />
          새 일지
        </Link>
      </header>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : activities.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">기록된 활동이 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {activities.map((a) => (
            <li
              key={a.id}
              className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2"
            >
              <div className="flex items-center gap-1.5">
                <span className={`inline-flex items-center text-[10px] font-semibold px-1.5 py-0.5 rounded-md border ${TYPE_STYLE[a.log_type]} shrink-0`}>
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
  );
}
