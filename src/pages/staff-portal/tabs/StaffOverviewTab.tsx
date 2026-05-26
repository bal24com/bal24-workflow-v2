// bal24 v2 — STEP-STAFF-PORTAL-P2 / STEP-STAFF-PORTAL-PROGRAM-SELECT
// 강사 통합 포털 · 개요 탭 — 담당 프로그램 카드 + D-7 일정 + 교육 개요·전체 커리큘럼 (PART B 2026-05-28)

import { useEffect, useState } from 'react';
import { Loader2, Calendar, BookOpen, AlertCircle, CheckCircle2, Info, ListChecks, User } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import { BADGE_BASE } from '../../../utils/statusStyles';
import { supabase } from '../../../lib/supabase';
import {
  fetchUpcomingSchedule,
  type StaffPortalIdentity, type StaffPortalProgram, type StaffUpcomingSession,
} from '../staffPortalUtils';

interface ProgramDetail {
  description: string | null;
  venue: string | null;
  capacity: number | null;
  start_date: string | null;
  end_date: string | null;
  project?: { name: string; client?: { name: string } | { name: string }[] | null } | null;
}
interface CurriculumRow {
  id: string;
  session_no: number | null;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  title: string | null;
  staff_id: string | null;
  staff?: { id: string; name: string } | { id: string; name: string }[] | null;
}

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
  // STEP-STAFF-PORTAL-REDESIGN PART B (2026-05-28) — 선택 프로그램의 교육 개요 + 전체 커리큘럼
  const [programDetail, setProgramDetail] = useState<ProgramDetail | null>(null);
  const [curriculum, setCurriculum] = useState<CurriculumRow[]>([]);

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

  // PART B — 선택 프로그램의 상세 + 커리큘럼 fetch
  useEffect(() => {
    if (!selectedProgramId) { setProgramDetail(null); setCurriculum([]); return; }
    let cancelled = false;
    void (async () => {
      const [pRes, cRes] = await Promise.all([
        supabase.from('programs')
          .select('description, venue, capacity, start_date, end_date, project:projects(name, client:clients(name))')
          .eq('id', selectedProgramId).maybeSingle(),
        supabase.from('program_curriculum')
          .select('id, session_no, session_date, start_time, end_time, title, staff_id, staff:staff_pool!program_curriculum_staff_id_fkey(id, name)')
          .eq('program_id', selectedProgramId).order('session_no', { ascending: true }),
      ]);
      if (cancelled) return;
      setProgramDetail((pRes.data ?? null) as ProgramDetail | null);
      setCurriculum(((cRes.data ?? []) as unknown) as CurriculumRow[]);
    })();
    return () => { cancelled = true; };
  }, [selectedProgramId]);

  const clientName = (() => {
    const c = programDetail?.project?.client;
    if (!c) return null;
    return Array.isArray(c) ? c[0]?.name : c.name;
  })();
  const staffName = (s: CurriculumRow['staff']): string => {
    if (!s) return '미정';
    const x = Array.isArray(s) ? s[0] : s;
    return x?.name ?? '미정';
  };

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

      {/* PART B — 교육 개요 (선택 프로그램) */}
      {selectedProgramId && programDetail && (
        <section className={CARD_CLASS}>
          <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
            <Info size={16} className="text-blue-500" aria-hidden="true" /> 교육 개요
          </h2>
          <dl className="grid grid-cols-2 gap-x-4 gap-y-2 text-sm">
            {clientName && (<><dt className="text-slate-500">주관기관</dt><dd className="font-semibold text-slate-800">{clientName}</dd></>)}
            <dt className="text-slate-500">기간</dt>
            <dd className="text-slate-800">{formatDateKo(programDetail.start_date) || '미정'} ~ {formatDateKo(programDetail.end_date) || '미정'}</dd>
            {programDetail.venue && (<><dt className="text-slate-500">장소</dt><dd className="text-slate-800">{programDetail.venue}</dd></>)}
            {programDetail.capacity != null && (<><dt className="text-slate-500">인원</dt><dd className="text-slate-800 tabular-nums">{programDetail.capacity}명</dd></>)}
            {programDetail.description && (<><dt className="text-slate-500 col-span-2 mt-1">목적·설명</dt><dd className="col-span-2 text-slate-700 whitespace-pre-line text-xs">{programDetail.description}</dd></>)}
          </dl>
        </section>
      )}

      {/* PART B — 전체 커리큘럼 (담당 강사 표시, 본인 차시 강조) */}
      {selectedProgramId && curriculum.length > 0 && (
        <section className={CARD_CLASS}>
          <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
            <ListChecks size={16} className="text-violet-500" aria-hidden="true" /> 전체 커리큘럼 ({curriculum.length}차시)
          </h2>
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-violet-50/50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold">차시</th>
                  <th className="text-left px-3 py-2 font-semibold">날짜·시간</th>
                  <th className="text-left px-3 py-2 font-semibold">제목</th>
                  <th className="text-left px-3 py-2 font-semibold">담당 강사</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {curriculum.map((c) => {
                  const mine = c.staff_id === staff.id;
                  return (
                    <tr key={c.id} className={mine ? 'bg-violet-50' : 'hover:bg-violet-50/40'}>
                      <td className="px-3 py-2 text-xs font-bold text-violet-700 tabular-nums">{c.session_no ?? '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">{formatDateKo(c.session_date)}{c.start_time ? ` · ${c.start_time.slice(0, 5)}` : ''}</td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-800">{c.title ?? '-'}</td>
                      <td className="px-3 py-2 text-xs">{mine ? <span className="inline-flex items-center gap-1 text-violet-700 font-semibold"><User size={11} aria-hidden="true" />{staffName(c.staff)} (본인)</span> : <span className="text-slate-600">{staffName(c.staff)}</span>}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

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
