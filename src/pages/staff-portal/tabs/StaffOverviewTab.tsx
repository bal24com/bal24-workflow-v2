// bal24 v2 — STEP-STAFF-PORTAL-P2 / STEP-STAFF-PORTAL-PROGRAM-SELECT
// 강사 통합 포털 · 개요 탭 — 담당 프로그램 카드 클릭 선택 + D-7 일정 + 미작성 일지 placeholder.

import { useEffect, useState } from 'react';
import { Loader2, Calendar, BookOpen, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import { BADGE_BASE } from '../../../utils/statusStyles';
import {
  fetchUpcomingSchedule,
  type StaffPortalIdentity, type StaffPortalProgram, type StaffUpcomingSession,
} from '../staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
  programs: StaffPortalProgram[];
  programsLoading: boolean;
  selectedProgramId: string | null;
  onSelectProgram: (id: string) => void;
}

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

export default function StaffOverviewTab({
  staff, programs, programsLoading, selectedProgramId, onSelectProgram,
}: Props) {
  const [upcoming, setUpcoming] = useState<StaffUpcomingSession[]>([]);
  const [upcomingLoading, setUpcomingLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setUpcomingLoading(true);
    void (async () => {
      const u = await fetchUpcomingSchedule(staff.id, staff.sourceType);
      if (cancelled) return;
      setUpcoming(u);
      setUpcomingLoading(false);
    })();
    return () => { cancelled = true; };
  }, [staff.id, staff.sourceType]);

  const filteredUpcoming = selectedProgramId
    ? upcoming.filter((u) => u.program_id === selectedProgramId)
    : upcoming;

  return (
    <div className="space-y-4">
      {/* 담당 프로그램 — 카드 클릭으로 선택 */}
      <section className={CARD_CLASS}>
        <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-violet-500" aria-hidden="true" />
          담당 프로그램 ({programs.length}개)
        </h2>
        {programsLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : programs.length === 0 ? (
          <EmptyState emoji="📚" title="아직 배정된 프로그램이 없어요." />
        ) : (
          <>
            {programs.length > 1 && !selectedProgramId && (
              <p className="text-xs text-violet-600 mb-3 bg-violet-50 border border-violet-200 rounded-lg px-3 py-2">
                💡 작업할 프로그램을 아래에서 선택해 주세요. 다른 탭은 선택한 프로그램 기준으로 표시돼요.
              </p>
            )}
            <ul className="space-y-2">
              {programs.map((p) => {
                const selected = p.id === selectedProgramId;
                return (
                  <li key={p.id}>
                    <button type="button" onClick={() => onSelectProgram(p.id)}
                      aria-pressed={selected}
                      className={`w-full text-left rounded-xl border p-3 transition-all duration-200 ${
                        selected
                          ? 'border-violet-600 bg-violet-50 shadow-md'
                          : 'border-violet-100 bg-violet-50/30 hover:bg-violet-50 hover:border-violet-300'
                      }`}>
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0 flex-1">
                          <p className="font-semibold text-sm text-[#1E1B4B] truncate">{p.name}</p>
                          <div className="flex items-center gap-2 mt-1.5 flex-wrap">
                            <span className="text-xs text-slate-500 tabular-nums">
                              {formatDateKo(p.start_date) || '미정'} ~ {formatDateKo(p.end_date) || '미정'}
                            </span>
                            <span className={`${BADGE_BASE} bg-violet-50 text-violet-600 border-violet-200`}>
                              {p.status}
                            </span>
                          </div>
                        </div>
                        {selected && (
                          <span className="shrink-0 inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-600 text-white text-[10px] font-bold">
                            <CheckCircle2 size={10} aria-hidden="true" /> 선택됨
                          </span>
                        )}
                      </div>
                    </button>
                  </li>
                );
              })}
            </ul>
          </>
        )}
      </section>

      {/* D-7 다가오는 일정 — 선택된 프로그램 기준 필터링 */}
      <section className={CARD_CLASS}>
        <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
          <Calendar size={16} className="text-violet-500" aria-hidden="true" />
          다가오는 일정 (7일 이내)
        </h2>
        {upcomingLoading ? (
          <div className="flex justify-center py-6">
            <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : filteredUpcoming.length === 0 ? (
          <EmptyState emoji="📅"
            title={selectedProgramId ? '선택한 프로그램의 예정된 일정이 없어요.' : '앞으로 예정된 일정이 없어요.'} />
        ) : (
          <ul className="space-y-2">
            {filteredUpcoming.map((s) => (
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

      {/* 미작성 일지 알림 placeholder */}
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
