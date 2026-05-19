// bal24 v2 — STEP-STAFF-PORTAL-P2
// 강사 통합 포털 · 개요 탭 — 담당 프로그램 + D-7 다가오는 일정 + 미작성 일지 알림 placeholder.

import { useEffect, useState } from 'react';
import { Loader2, Calendar, BookOpen, AlertCircle } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';
import {
  fetchStaffPrograms, fetchUpcomingSchedule,
  type StaffPortalIdentity, type StaffPortalProgram, type StaffUpcomingSession,
} from '../staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
}

export default function StaffOverviewTab({ staff }: Props) {
  const [programs, setPrograms] = useState<StaffPortalProgram[]>([]);
  const [upcoming, setUpcoming] = useState<StaffUpcomingSession[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [p, u] = await Promise.all([
        fetchStaffPrograms(staff.id, staff.sourceType),
        fetchUpcomingSchedule(staff.id, staff.sourceType),
      ]);
      if (cancelled) return;
      setPrograms(p);
      setUpcoming(u);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [staff.id, staff.sourceType]);

  if (loading) {
    return (
      <div className="flex justify-center py-12">
        <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 담당 프로그램 */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <BookOpen size={14} className="text-violet-500" aria-hidden="true" />
          담당 프로그램 ({programs.length}개)
        </h2>
        {programs.length === 0 ? (
          <p className="text-sm text-slate-400 italic bg-white rounded-xl border border-slate-100 px-4 py-6 text-center">
            배정된 프로그램이 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {programs.map((p) => (
              <li key={p.id} className="bg-white rounded-xl border border-slate-200 p-4">
                <p className="font-semibold text-sm text-[#1E1B4B] truncate">{p.name}</p>
                <p className="text-xs text-slate-500 mt-1 tabular-nums">
                  {formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}
                  <span className="ml-2 text-[10px] inline-flex items-center px-1.5 py-0.5 rounded bg-violet-50 text-violet-700">
                    {p.status}
                  </span>
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D-7 다가오는 일정 */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <Calendar size={14} className="text-violet-500" aria-hidden="true" />
          다가오는 일정 (7일 이내)
        </h2>
        {upcoming.length === 0 ? (
          <p className="text-sm text-slate-400 italic bg-white rounded-xl border border-slate-100 px-4 py-6 text-center">
            예정된 일정이 없어요.
          </p>
        ) : (
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <li key={s.id} className="bg-white rounded-xl border border-slate-200 p-4 flex items-center justify-between gap-2">
                <p className="text-sm font-semibold text-[#1E1B4B] truncate">{s.title}</p>
                <p className="text-xs text-slate-500 tabular-nums shrink-0">
                  {formatDateKo(s.session_date)}{s.start_time ? ` · ${s.start_time.slice(0, 5)}` : ''}
                </p>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 미작성 일지 알림 placeholder (P4에서 activity_logs 카운트로 교체) */}
      <section>
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <AlertCircle size={14} className="text-orange-500" aria-hidden="true" />
          미작성 일지
        </h2>
        <p className="text-sm text-slate-400 italic bg-white rounded-xl border border-slate-100 px-4 py-6 text-center">
          P4(일지 탭)에서 정확한 카운트 표시 예정.
        </p>
      </section>
    </div>
  );
}
