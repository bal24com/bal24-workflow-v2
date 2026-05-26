// bal24 v2 — STEP-STAFF-PORTAL-P2 / STEP-STAFF-PORTAL-PROGRAM-SELECT
// 강사 통합 포털 · 개요 탭 — 담당 프로그램 카드 + D-7 일정 + 교육 개요·전체 커리큘럼 (PART B 2026-05-28)

import { useEffect, useState } from 'react';
import { Loader2, BookOpen, CheckCircle2, Info, ListChecks, User, Calendar, MapPin, Users } from 'lucide-react';
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
  // STEP-TABLE-COMPACT PART C (2026-05-28) — D-7 위젯 UI 제거. 데이터 fetch 도 비활성.
  const [, setUpcoming] = useState<StaffUpcomingSession[]>([]);
  const [, setUpcomingLoading] = useState(false);
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

  // STEP-TABLE-COMPACT PART C — filteredUpcoming 비사용 (D-7 위젯 제거)

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

      {/* STEP-TABLE-COMPACT PART C (2026-05-28) — D-7 다가오는 일정 위젯 제거 (일정 탭으로 통합)
          기존 fetchUpcomingSchedule 호출은 유지하되 UI 만 미노출 → 다른 활용처(useEffect) 영향 X */}

      {/* 2026-05-26 박경수님 — 교육 개요 단정화. 메타 인라인 한 줄 + 본문 단일 영역. */}
      {selectedProgramId && programDetail && (
        <section className={CARD_CLASS}>
          <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
            <Info size={16} className="text-blue-500" aria-hidden="true" /> 교육 개요
          </h2>
          {/* 메타 인라인 — 기간 · 장소 · 인원 · 주관기관 */}
          <div className="flex flex-wrap items-center gap-x-4 gap-y-2 text-sm text-slate-700 mb-3 pb-3 border-b border-slate-100">
            <span className="inline-flex items-center gap-1">
              <Calendar size={13} className="text-violet-500" aria-hidden="true" />
              <span className="tabular-nums">{formatDateKo(programDetail.start_date) || '미정'} ~ {formatDateKo(programDetail.end_date) || '미정'}</span>
            </span>
            {programDetail.venue && (
              <span className="inline-flex items-center gap-1">
                <MapPin size={13} className="text-violet-500" aria-hidden="true" />
                <span>{programDetail.venue}</span>
              </span>
            )}
            {programDetail.capacity != null && (
              <span className="inline-flex items-center gap-1">
                <Users size={13} className="text-violet-500" aria-hidden="true" />
                <span className="tabular-nums">{programDetail.capacity}명</span>
              </span>
            )}
            {clientName && (
              <span className="inline-flex items-center gap-1 ml-auto">
                <span className="text-[11px] text-slate-400">주관기관</span>
                <span className="font-semibold text-slate-800">{clientName}</span>
              </span>
            )}
          </div>
          {/* 본문 — 목적·설명 */}
          {programDetail.description ? (
            <p className="text-sm text-slate-700 leading-relaxed whitespace-pre-wrap">{programDetail.description}</p>
          ) : (
            <p className="text-xs text-slate-400 italic">목적·설명이 아직 등록되지 않았어요.</p>
          )}
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

      {/* 2026-05-26 박경수님 — 프로젝트 설명 카드는 교육 개요와 중복이라 제거. */}
    </div>
  );
}
