// bal24 v2 — 프로그램 상세 페이지 (V7 EducationDetailV9 차용 / V2 표준)
// STEP-PROGRAM-MODULE-RENDER: programs.modules 배열 기반 탭 동적 렌더 + 미구현 placeholder.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ClipboardCheck, Info, Loader2, Mic2, Pencil, FileBarChart, BookOpen, Users2, Award, Settings, FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatDateKo } from '../../lib/utils';
import {
  BADGE_BASE, PROGRAM_STATUS_STYLE, PROGRAM_TYPE_STYLE,
} from '../../utils/statusStyles';
import type { Program } from '../../types/database';
import OverviewTab from './detail/OverviewTab';
import CurriculumTab from './detail/CurriculumTab';
import AttendanceLogTab from './detail/AttendanceLogTab';
import ProgramDeleteButton from './ProgramDeleteButton';
import ProgramOverviewCard from './detail/overview/ProgramOverviewCard';
import ProgramCurriculumSummaryCard from './detail/overview/ProgramCurriculumSummaryCard';
import ProgramParticipantSummaryCard from './detail/overview/ProgramParticipantSummaryCard';
import ProgramInstructorSummaryCard from './detail/overview/ProgramInstructorSummaryCard';
import ParticipantManageTab from './detail/ParticipantManageTab';
import InstructorManageTab from './detail/InstructorManageTab';
import ReportManageTab from './detail/ReportManageTab';
import ProgramReportTab from './detail/ProgramReportTab';
import GrantManageTab from './detail/GrantManageTab';
import SettingsShareTab from './detail/SettingsShareTab';
import { useUserProfile } from '../../hooks/useUserProfile';
import { usePartnerProfile } from '../../hooks/usePartnerProfile';
import PartnerReadOnlyBanner from '../../components/PartnerReadOnlyBanner';

type DetailProgram = Program & {
  project?: { id: string; name: string; status: string } | null;
};

// STEP-PROGRAM-TABS-CONSOLIDATE — 9 탭 (STEP-PROGRAM-REPORT-TAB에서 'final-report' 추가)
// STEP-PROGRAM-UX-A — 'attendance' → 'activity-log' (출석은 교육생 탭으로 이동, 본 탭은 일지·수료증 전담)
type TabKey = 'overview' | 'curriculum' | 'participants' | 'activity-log' | 'instructor' | 'report' | 'final-report' | 'grant' | 'settings';

interface AuthCtx {
  isPM: boolean; isStaff: boolean; isMember: boolean; isPartner: boolean;
  /** STEP-CURRICULUM-ATTEND-SURVEY-FULL — 출석/만족도 데이터 존재 여부 */
  hasAttendData: boolean; hasSurveyData: boolean;
}

interface TabDef {
  key: TabKey;
  label: string;
  Icon: LucideIcon;
  hide?: (c: AuthCtx) => boolean;
}

const TABS: TabDef[] = [
  { key: 'overview',     label: '개요',         Icon: Info },
  { key: 'curriculum',   label: '커리큘럼',     Icon: BookOpen,        hide: (c) => c.isMember || c.isPartner },
  { key: 'participants', label: '교육생',       Icon: Users2,          hide: (c) => c.isMember || c.isPartner },
  // STEP-PROGRAM-UX-A — 출석은 교육생 탭으로 통합, 본 탭은 '일지·수료증' 전담
  { key: 'activity-log', label: '일지·수료증',  Icon: ClipboardCheck,
    hide: (c) => c.isMember || c.isPartner || (!c.isPM && !c.hasAttendData) },
  { key: 'instructor',   label: '강사',         Icon: Mic2 },
  { key: 'report',       label: '만족도·보고',  Icon: FileBarChart,
    hide: (c) => !c.isPM && !c.hasSurveyData && (c.isMember || c.isPartner) },
  // STEP-PROGRAM-REPORT-TAB — 결과보고서 (6섹션 자동집계·편집)
  { key: 'final-report', label: '결과보고서',   Icon: FileText,        hide: (c) => c.isMember || c.isPartner },
  { key: 'grant',        label: '지원금',       Icon: Award,           hide: (c) => !c.isPM },
  { key: 'settings',     label: '설정·공유',    Icon: Settings,        hide: (c) => !c.isPM },
];

const SELECT_COLUMNS = '*, project:projects(id,name,status)';

function NotFound() {
  return (
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-2">
        🔍
      </div>
      <p className="text-sm text-slate-500 mb-3">프로그램을 찾을 수 없어요.</p>
      <Link
        to="/programs"
        className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline"
      >
        <ArrowLeft size={14} aria-hidden="true" />
        프로그램 목록으로
      </Link>
    </div>
  );
}

export default function ProgramDetailPage() {
  const { id } = useParams<{ id: string }>();
  const toast = useToast();
  const { isPM, isStaff, isMember } = useUserProfile();
  const { isPartner, programIds: partnerProgramIds } = usePartnerProfile();
  const [program, setProgram] = useState<DetailProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');
  // STEP-CURRICULUM-ATTEND-SURVEY-FULL — 데이터 존재 여부 (탭 자동 숨김용)
  const [hasAttendData, setHasAttendData] = useState(false);
  const [hasSurveyData, setHasSurveyData] = useState(false);

  // 1) 데이터 fetch (훅 #1)
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    setLoading(true);
    setErrorMsg(null);

    supabase
      .from('programs')
      .select(SELECT_COLUMNS)
      .eq('id', id)
      .maybeSingle()
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) {
          console.error('[program-detail] 조회 실패:', error.message);
          setErrorMsg('프로그램 정보를 불러오지 못했어요.');
          toast.error('프로그램 정보를 불러오지 못했어요.');
        } else {
          setProgram((data ?? null) as DetailProgram | null);
        }
        setLoading(false);
      });

    return () => {
      cancelled = true;
    };
  }, [id, toast]);

  // STEP-CURRICULUM-ATTEND-SURVEY-FULL — 출석·만족도 데이터 존재 여부 fetch
  useEffect(() => {
    if (!id) return;
    let cancelled = false;
    void (async () => {
      const opt = { count: 'exact' as const, head: true };
      const [s, c, sv] = await Promise.all([
        supabase.from('attendance_sessions').select('id', opt).eq('program_id', id),
        supabase.from('program_curriculum').select('id', opt).eq('program_id', id)
          .or('attendance_link.not.is.null,attendance_file_url.not.is.null'),
        supabase.from('satisfaction_surveys').select('id', opt).eq('program_id', id),
      ]);
      if (cancelled) return;
      setHasAttendData((s.count ?? 0) > 0 || (c.count ?? 0) > 0);
      setHasSurveyData((sv.count ?? 0) > 0);
    })();
    return () => { cancelled = true; };
  }, [id]);

  // STEP-PROGRAM-TABS-CONSOLIDATE — 권한별 보이는 탭 계산
  const authCtx = useMemo<AuthCtx>(
    () => ({ isPM, isStaff, isMember, isPartner, hasAttendData, hasSurveyData }),
    [isPM, isStaff, isMember, isPartner, hasAttendData, hasSurveyData],
  );
  const visibleTabs = useMemo(() => TABS.filter((t) => !t.hide || !t.hide(authCtx)), [authCtx]);

  // 탭 fallback — 현재 tab이 visibleTabs에 없으면 첫 가시 탭으로
  useEffect(() => {
    if (visibleTabs.length === 0) return;
    if (!visibleTabs.some((t) => t.key === tab)) setTab(visibleTabs[0].key);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [visibleTabs]);

  // ⚠️ 모든 훅은 위에서 호출 완료 — 아래는 조기 반환만 허용 (Rules of Hooks)
  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin mr-2" aria-hidden="true" />
        불러오는 중…
      </div>
    );
  }

  if (errorMsg) {
    return (
      <div className="space-y-3">
        <div
          role="alert"
          className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-3 text-sm text-rose-600"
        >
          {errorMsg}
        </div>
        <Link
          to="/programs"
          className="inline-flex items-center gap-1.5 text-sm text-violet-600 hover:underline"
        >
          <ArrowLeft size={14} aria-hidden="true" />
          프로그램 목록으로
        </Link>
      </div>
    );
  }

  if (!program) return <NotFound />;

  const programId = program.id;
  // STEP-PARTNER-SIDEBAR — PARTNER 가 본인 담당 프로그램이 아닌 경우 읽기 전용 배너
  const isPartnerReadOnly = isPartner && !partnerProgramIds.has(programId);

  return (
    <div className="space-y-5 max-w-[1400px]">
      {isPartnerReadOnly && <PartnerReadOnlyBanner />}
      <div className="space-y-2">
        <Link
          to="/programs"
          className="inline-flex items-center gap-1.5 text-xs text-slate-500 hover:text-violet-600"
        >
          <ArrowLeft size={12} aria-hidden="true" />
          프로그램 목록
        </Link>
        <div className="flex flex-wrap items-start justify-between gap-3">
          <div className="flex-1 min-w-0 space-y-2">
            <div className="flex flex-wrap items-center gap-2">
              <h1 className="text-2xl font-bold text-[#1E1B4B] truncate">{program.name}</h1>
              <span className={`${BADGE_BASE} ${PROGRAM_TYPE_STYLE[program.type]}`}>{program.type}</span>
              <span className={`${BADGE_BASE} ${PROGRAM_STATUS_STYLE[program.status]}`}>{program.status}</span>
            </div>
            <div className="text-xs text-slate-500 flex flex-wrap items-center gap-x-3 gap-y-1">
              {(program.start_date || program.end_date) && (
                <span>
                  {formatDateKo(program.start_date) || '미정'} ~ {formatDateKo(program.end_date) || '미정'}
                </span>
              )}
              {program.venue && <span>· {program.venue}</span>}
              {program.capacity != null && <span>· 정원 {program.capacity}명</span>}
              {program.project && (
                <span>
                  · 프로젝트{' '}
                  <Link
                    to={`/projects/${program.project.id}`}
                    className="text-violet-600 hover:underline"
                  >
                    {program.project.name}
                  </Link>
                </span>
              )}
            </div>
          </div>
          <div className="shrink-0 flex items-center gap-2">
            <Link to={`/programs/${program.id}/edit`}>
              <Button variant="primary" size="sm" leftIcon={<Pencil size={14} />}>
                수정
              </Button>
            </Link>
            {isStaff && <ProgramDeleteButton programId={program.id} programName={program.name} />}
          </div>
        </div>
      </div>

      <nav
        role="tablist"
        aria-label="프로그램 상세 탭"
        className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto"
      >
        {visibleTabs.map((vt) => {
          const active = tab === vt.key;
          const Icon = vt.Icon;
          return (
            <button key={vt.key} type="button" role="tab" aria-selected={active}
              onClick={() => setTab(vt.key)}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}>
              <Icon size={15} aria-hidden="true" />
              {vt.label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel">
        {tab === 'overview' && (
          <div className="space-y-4">
            <ProgramOverviewCard program={program} />
            <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
              <ProgramCurriculumSummaryCard programId={programId} />
              <ProgramParticipantSummaryCard programId={programId} />
            </div>
            <ProgramInstructorSummaryCard programId={programId} />
            <OverviewTab programId={programId} description={program.description ?? null} />
          </div>
        )}
        {tab === 'curriculum'   && <CurriculumTab programId={programId} programName={program.name} />}
        {tab === 'participants' && <ParticipantManageTab programId={programId} programName={program.name} canEdit={isStaff} />}
        {tab === 'activity-log' && <AttendanceLogTab programId={programId} />}
        {tab === 'instructor'   && <InstructorManageTab programId={programId} isPartner={isPartner} />}
        {tab === 'report'       && <ReportManageTab programId={programId} isPartner={isPartner} isMember={isMember} isStaff={isStaff} applicationType={program.application_type} />}
        {tab === 'final-report' && <ProgramReportTab programId={programId} />}
        {tab === 'grant'        && <GrantManageTab programId={programId} consortiumId={program.consortium_id ?? null} isPM={isPM} applicationType={program.application_type} hasConsortium={Boolean(program.consortium_id)} />}
        {tab === 'settings'     && <SettingsShareTab programId={programId} />}
      </div>
    </div>
  );
}
