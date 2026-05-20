// bal24 v2 — STEP-STAFF-PORTAL-P2 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 통합 포털 · 개요 탭 — 담당 프로그램 + D-7 다가오는 일정 + 미작성 일지 알림 placeholder.

import { useEffect, useState } from 'react';
import { Loader2, Calendar, BookOpen, AlertCircle } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import { BADGE_BASE } from '../../../utils/statusStyles';
import {
  fetchStaffPrograms, fetchUpcomingSchedule,
  type StaffPortalIdentity, type StaffPortalProgram, type StaffUpcomingSession,
} from '../staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
}

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

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
    <div className="space-y-4">
      {/* 담당 프로그램 */}
      <section className={CARD_CLASS}>
        <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-violet-500" aria-hidden="true" />
          담당 프로그램 ({programs.length}개)
        </h2>
        {programs.length === 0 ? (
          <EmptyState emoji="📚" title="아직 배정된 프로그램이 없어요." />
        ) : (
          <ul className="space-y-2">
            {programs.map((p) => (
              <li key={p.id} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
                <p className="font-semibold text-sm text-[#1E1B4B] truncate">{p.name}</p>
                <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                  <span className="text-xs text-slate-500 tabular-nums">
                    {formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}
                  </span>
                  <span className={`${BADGE_BASE} bg-violet-50 text-violet-600 border-violet-200`}>
                    {p.status}
                  </span>
                </div>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* D-7 다가오는 일정 */}
      <section className={CARD_CLASS}>
        <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
          <Calendar size={16} className="text-violet-500" aria-hidden="true" />
          다가오는 일정 (7일 이내)
        </h2>
        {upcoming.length === 0 ? (
          <EmptyState emoji="📅" title="앞으로 예정된 일정이 없어요." />
        ) : (
          <ul className="space-y-2">
            {upcoming.map((s) => (
              <li key={s.id} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 flex items-center justify-between gap-2">
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
      <section className={CARD_CLASS}>
        <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
          <AlertCircle size={16} className="text-orange-500" aria-hidden="true" />
          미작성 일지
        </h2>
        <p className="text-sm text-slate-400 italic text-center py-4">
          일지 탭에서 정확한 카운트가 표시될 예정이에요.
        </p>
      </section>
    </div>
  );
}
