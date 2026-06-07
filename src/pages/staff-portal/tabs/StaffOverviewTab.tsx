// bal24 v2 — STEP-STAFF-PORTAL-P2 / STEP-STAFF-PORTAL-PROGRAM-SELECT
// 강사 통합 포털 · 개요 탭 — 담당 프로그램 카드 + D-7 일정 + 교육 개요·전체 커리큘럼 (PART B 2026-05-28)

import { useEffect, useState } from 'react';
import { 
  Loader2, BookOpen, CheckCircle2, Info, ListChecks, User, 
  Calendar, MapPin, Users, CalendarDays, Wallet, Activity
} from 'lucide-react';
import ScheduleStagesSection from './ScheduleStagesSection';
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
  is_completed?: boolean;
  staff?: { id: string; name: string } | { id: string; name: string }[] | null;
}

interface Stats {
  totalSessions: number;
  completedSessions: number;
  totalFee: number;
  paidFee: number;
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
  const [stats, setStats] = useState<Stats>({ totalSessions: 0, completedSessions: 0, totalFee: 0, paidFee: 0 });
  const [statsLoading, setStatsLoading] = useState(false);
  const [mySessionIds, setMySessionIds] = useState<Set<string>>(new Set());

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
    if (!selectedProgramId) { 
      setProgramDetail(null); 
      setCurriculum([]); 
      setStats({ totalSessions: 0, completedSessions: 0, totalFee: 0, paidFee: 0 });
      return; 
    }
    let cancelled = false;
    setStatsLoading(true);

    void (async () => {
      const staffCol = staff.sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';
      
      const [pRes, cRes, csRes, feeRes] = await Promise.all([
        supabase.from('programs')
          .select('description, venue, capacity, start_date, end_date, project:projects(name, client:clients(name))')
          .eq('id', selectedProgramId).maybeSingle(),
        supabase.from('program_curriculum')
          .select('id, session_no, session_date, start_time, end_time, title, is_completed')
          .eq('program_id', selectedProgramId).order('session_no', { ascending: true }),
        supabase.from('curriculum_staff')
          .select('curriculum_id, role')
          .eq(staffCol, staff.id),
        supabase.from('payroll_expenses')
          .select('subtotal, net_amount, payment_status')
          .eq(staffCol, staff.id)
          .eq('program_id', selectedProgramId)
          .is('deleted_at', null),
      ]);

      if (cancelled) return;

      const curData = (cRes.data ?? []) as CurriculumRow[];
      const assignedCurIds = new Set((csRes.data ?? []).map(r => r.curriculum_id));
      setMySessionIds(assignedCurIds);
      
      // 담당 차시만 필터링하거나 전체 보여주되 담당 표시 (기존 로직 유지하며 stats 계산)
      const mySessions = curData.filter(c => assignedCurIds.has(c.id));
      const today = new Date().toISOString().slice(0, 10);
      const completed = mySessions.filter(c => c.is_completed || (c.session_date && c.session_date < today)).length;
      
      let totalFee = 0;
      let paidFee = 0;
      (feeRes.data ?? []).forEach(f => {
        totalFee += Number(f.subtotal ?? 0);
        if (f.payment_status === 'paid') paidFee += Number(f.net_amount ?? f.subtotal ?? 0);
      });

      setProgramDetail((pRes.data ?? null) as ProgramDetail | null);
      setCurriculum(curData);
      setStats({
        totalSessions: mySessions.length,
        completedSessions: completed,
        totalFee,
        paidFee
      });
      setStatsLoading(false);
    })();
    return () => { cancelled = true; };
  }, [selectedProgramId, staff.id, staff.sourceType]);

  const clientName = (() => {
    const c = programDetail?.project?.client;
    if (!c) return null;
    return Array.isArray(c) ? c[0]?.name : c.name;
  })();
  
  // curriculum_staff 정보를 한 번 더 가져와서 매칭 (join 에러 방지 위해 수동 매칭)
  const [assignedStaffMap, setAssignedStaffMap] = useState<Record<string, string>>({});
  useEffect(() => {
    if (!selectedProgramId) return;
    void (async () => {
      const { data } = await supabase
        .from('curriculum_staff')
        .select('curriculum_id, staff_pool:staff_pool(name), profile:profiles(name)')
        .in('curriculum_id', curriculum.map(c => c.id));
      
      const map: Record<string, string> = {};
      (data ?? []).forEach((row: any) => {
        const name = row.staff_pool?.name || row.profile?.name || '미정';
        map[row.curriculum_id] = name;
      });
      setAssignedStaffMap(map);
    })();
  }, [selectedProgramId, curriculum.length]);

  const getStaffName = (curriculumId: string): string => {
    return assignedStaffMap[curriculumId] ?? '미정';
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

      {/* 2026-06-07 — 전문가 KPI 요약 카드 */}
      {selectedProgramId && (
        <div className="grid grid-cols-2 sm:grid-cols-3 gap-3">
          <div className={`${CARD_CLASS} flex flex-col justify-between border-violet-200/60`}>
            <div className="flex items-center gap-1.5 mb-2">
              <Activity size={14} className="text-violet-500" />
              <span className="text-[11px] font-bold text-slate-500">배정 차시</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#1E1B4B] tabular-nums">{stats.totalSessions}</span>
              <span className="text-xs text-slate-400 font-medium">차시</span>
            </div>
          </div>
          <div className={`${CARD_CLASS} flex flex-col justify-between border-emerald-200/60`}>
            <div className="flex items-center gap-1.5 mb-2">
              <CheckCircle2 size={14} className="text-emerald-500" />
              <span className="text-[11px] font-bold text-slate-500">진행 상태</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#1E1B4B] tabular-nums">
                {stats.totalSessions > 0 ? Math.round((stats.completedSessions / stats.totalSessions) * 100) : 0}
              </span>
              <span className="text-xs text-slate-400 font-medium">% ({stats.completedSessions}/{stats.totalSessions})</span>
            </div>
          </div>
          <div className={`${CARD_CLASS} flex flex-col justify-between col-span-2 sm:col-span-1 border-blue-200/60`}>
            <div className="flex items-center gap-1.5 mb-2">
              <Wallet size={14} className="text-blue-500" />
              <span className="text-[11px] font-bold text-slate-500">예정 강사료</span>
            </div>
            <div className="flex items-baseline gap-1">
              <span className="text-xl font-black text-[#1E1B4B] tabular-nums">
                {(stats.totalFee / 10000).toLocaleString('ko-KR')}
              </span>
              <span className="text-xs text-slate-400 font-medium">만원</span>
            </div>
          </div>
        </div>
      )}

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
                  const mine = mySessionIds.has(c.id);
                  const instructorName = getStaffName(c.id);
                  return (
                    <tr key={c.id} className={mine ? 'bg-violet-50' : 'hover:bg-violet-50/40'}>
                      <td className="px-3 py-2 text-xs font-bold text-violet-700 tabular-nums">{c.session_no ?? '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">{formatDateKo(c.session_date)}{c.start_time ? ` · ${c.start_time.slice(0, 5)}` : ''}</td>
                      <td className="px-3 py-2 text-sm font-medium text-slate-800">{c.title ?? '-'}</td>
                      <td className="px-3 py-2 text-xs">
                        {mine ? (
                          <span className="inline-flex items-center gap-1 text-violet-700 font-semibold">
                            <User size={11} aria-hidden="true" />{instructorName} (본인)
                          </span>
                        ) : (
                          <span className="text-slate-600">{instructorName}</span>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>
      )}

      {/* 2026-05-26 박경수님 — 프로젝트 설명 카드는 교육 개요와 중복이라 제거. */}

      {/* 박경수님 2026-05-26 STEP-PORTAL-MULTI-FIX PART E — 일정 탭 → 개요 하단으로 이동 */}
      {selectedProgramId && (
        <section className={CARD_CLASS}>
          <header className="mb-3 flex items-center gap-2">
            <CalendarDays size={16} className="text-violet-500" aria-hidden="true" />
            <h2 className="text-base font-bold text-[#1E1B4B]">일정</h2>
            <span className="text-[11px] text-slate-400">PM이 등록한 일정 (읽기 전용)</span>
          </header>
          <ScheduleStagesSection programId={selectedProgramId} />
        </section>
      )}
    </div>
  );
}
