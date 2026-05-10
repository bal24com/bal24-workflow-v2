// bal24 v2 — 프로그램 상세 페이지 (V7 EducationDetailV9 차용 / V2 표준)
// STEP-PROGRAM-MODULE-RENDER: programs.modules 배열 기반 탭 동적 렌더 + 미구현 placeholder.

import { useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ClipboardCheck, FileText, Info, Loader2, Mic2, Share2, Pencil, FileBarChart, BookOpen, FolderOpen, Hourglass, Users2, Handshake, Receipt, Award,
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
import StaffStudentsTab from './detail/StaffStudentsTab';
import AttendanceLogTab from './detail/AttendanceLogTab';
import SurveyResultTab from './detail/SurveyResultTab';
import ShareTab from './detail/ShareTab';
import ReportBuilderTab from './detail/ReportBuilderTab';
import ProgramFilesTab from './detail/ProgramFilesTab';
import AssignmentTab from './detail/AssignmentTab';
import MentoringTab from './detail/MentoringTab';
import StaffFeeTab from './detail/StaffFeeTab';
import EvaluatorTab from './detail/EvaluatorTab';
import ApplicationTab from './detail/ApplicationTab';
import {
  resolveVisibleTabs, SHARE_TAB_ALWAYS,
  type TabKey, type VisibleTab,
} from './programModuleConfig';
import { useUserProfile } from '../../hooks/useUserProfile';
import { usePartnerProfile } from '../../hooks/usePartnerProfile';
import PartnerReadOnlyBanner from '../../components/PartnerReadOnlyBanner';

type DetailProgram = Program & {
  project?: { id: string; name: string; status: string } | null;
};

// 탭 → 아이콘 매핑 (programModuleConfig 의 TabKey 와 동기화)
const TAB_ICON: Record<TabKey, LucideIcon> = {
  overview:   Info,
  curriculum: BookOpen,
  staff:      Mic2,
  attendance: ClipboardCheck,
  survey:     FileText,
  share:      Share2,
  report:     FileBarChart,
  files:      FolderOpen,
  mentoring:  Handshake,
  staff_fee:    Receipt,
  evaluator:    Award,
  applications: Users2,
};

function getTabIcon(tab: VisibleTab): LucideIcon {
  if (tab.isPlaceholder) return Hourglass;
  return TAB_ICON[tab.key as TabKey] ?? Info;
}

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
  const { isPM } = useUserProfile();
  const { isPartner, programIds: partnerProgramIds } = usePartnerProfile();
  const [program, setProgram] = useState<DetailProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  // 동적 탭 — placeholder 모듈 ID 도 받기 위해 string 으로 확장
  const [tab, setTab] = useState<string>('overview');

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

  // 2) 동적 탭 (훅 #2) — program?.modules 가 null/undefined 이어도 안전 (resolveVisibleTabs 내부 가드)
  const visibleTabs = useMemo<VisibleTab[]>(
    () => resolveVisibleTabs(program?.modules ?? null),
    [program?.modules],
  );

  // 3) 탭 fallback (훅 #3) — visibleTabs 에 현재 tab 없으면 첫 가시 탭으로
  useEffect(() => {
    if (visibleTabs.length === 0) return;
    const allKeys = [...visibleTabs.map((t) => t.key), 'share', 'assignment', 'evaluator', 'applications'];
    if (!allKeys.includes(tab)) {
      setTab(visibleTabs[0]?.key ?? 'overview');
    }
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
  const isPlaceholderActive = visibleTabs.some((t) => t.key === tab && t.isPlaceholder);
  const activePlaceholderLabel = visibleTabs.find((t) => t.key === tab)?.label;
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
          <Link to={`/programs/${program.id}/edit`} className="shrink-0">
            <Button variant="primary" size="sm" leftIcon={<Pencil size={14} />}>
              수정
            </Button>
          </Link>
        </div>
      </div>

      <nav
        role="tablist"
        aria-label="프로그램 상세 탭"
        className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto"
      >
        {visibleTabs.map((vt) => {
          const active = tab === vt.key;
          const Icon = getTabIcon(vt);
          return (
            <button
              key={vt.key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(vt.key)}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'text-violet-700 border-violet-600'
                  : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}
            >
              <Icon size={15} aria-hidden="true" />
              {vt.label}
              {vt.isPlaceholder && (
                <span className="text-[10px] text-slate-400 font-normal">(준비 중)</span>
              )}
            </button>
          );
        })}
        {/* Q7-A: PM/ADMIN + 컨소시엄 연결 시만 배정 탭 표시 */}
        {isPM && program.consortium_id && (() => {
          const active = tab === 'assignment';
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab('assignment')}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'text-violet-700 border-violet-600'
                  : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}
            >
              <Users2 size={15} aria-hidden="true" />
              배정
            </button>
          );
        })()}

        {/* STEP-APPLICATION-MGMT — 신청자 탭 (항상 노출) */}
        {(() => {
          const active = tab === 'applications';
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab('applications')}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'text-violet-700 border-violet-600'
                  : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}
            >
              <Users2 size={15} aria-hidden="true" />
              신청자
            </button>
          );
        })()}

        {/* STEP-EVALUATION-SYSTEM — application_type='evaluation' 일 때만 평가위원 탭 */}
        {program.application_type === 'evaluation' && (() => {
          const active = tab === 'evaluator';
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab('evaluator')}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'text-violet-700 border-violet-600'
                  : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}
            >
              <Award size={15} aria-hidden="true" />
              평가위원
            </button>
          );
        })()}

        {SHARE_TAB_ALWAYS && (() => {
          const active = tab === 'share';
          return (
            <button
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab('share')}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'text-violet-700 border-violet-600'
                  : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}
            >
              <Share2 size={15} aria-hidden="true" />
              외부 공유
            </button>
          );
        })()}
      </nav>

      <div role="tabpanel">
        {tab === 'overview' && (
          <OverviewTab programId={programId} description={program.description ?? null} />
        )}
        {tab === 'curriculum' && <CurriculumTab programId={programId} />}
        {tab === 'staff' && <StaffStudentsTab programId={programId} />}
        {tab === 'attendance' && <AttendanceLogTab programId={programId} />}
        {tab === 'mentoring' && <MentoringTab programId={programId} />}
        {tab === 'staff_fee' && <StaffFeeTab programId={programId} />}
        {tab === 'evaluator' && <EvaluatorTab programId={programId} />}
        {tab === 'applications' && <ApplicationTab programId={programId} />}
        {tab === 'survey' && <SurveyResultTab programId={programId} />}
        {tab === 'share' && <ShareTab programId={programId} />}
        {tab === 'report' && <ReportBuilderTab programId={programId} />}
        {tab === 'files' && <ProgramFilesTab programId={programId} />}
        {tab === 'assignment' && isPM && (
          <AssignmentTab
            programId={programId}
            consortiumId={program.consortium_id ?? null}
            isPM={isPM}
          />
        )}

        {/* 미구현 모듈 placeholder (Q4-A) */}
        {isPlaceholderActive && (
          <div className="flex flex-col items-center justify-center py-20 text-slate-400">
            <Hourglass size={32} className="mb-3 text-slate-300" aria-hidden="true" />
            <p className="text-sm font-bold text-slate-600">
              ✦ {activePlaceholderLabel} 탭은 곧 추가될 예정이에요
            </p>
            <p className="text-xs mt-1">
              현재는 모듈만 등록되어 있고 상세 화면이 준비 중입니다.
            </p>
          </div>
        )}
      </div>
    </div>
  );
}
