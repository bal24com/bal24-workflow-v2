// bal24 v2 — 프로그램 상세 페이지 (V7 EducationDetailV9 차용 / V2 표준)
// 5탭: 개요 / 강사·교육생 / 출석·일지 / 결과·만족도 / 외부 공유

import { useEffect, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, ClipboardCheck, FileText, Info, Loader2, Mic2, Share2, Pencil, FileBarChart, BookOpen,
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

type DetailProgram = Program & {
  project?: { id: string; name: string; status: string } | null;
};

type TabKey = 'overview' | 'curriculum' | 'staff' | 'attendance' | 'survey' | 'share' | 'report';

const TABS: { key: TabKey; label: string; Icon: LucideIcon }[] = [
  { key: 'overview',   label: '개요',         Icon: Info },
  { key: 'curriculum', label: '커리큘럼',     Icon: BookOpen },
  { key: 'staff',      label: '강사·교육생', Icon: Mic2 },
  { key: 'attendance', label: '출석·일지',   Icon: ClipboardCheck },
  { key: 'survey',     label: '결과·만족도', Icon: FileText },
  { key: 'share',      label: '외부 공유',   Icon: Share2 },
  { key: 'report',     label: '결과보고서',  Icon: FileBarChart },
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
  const [program, setProgram] = useState<DetailProgram | null>(null);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [tab, setTab] = useState<TabKey>('overview');

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

  return (
    <div className="space-y-5 max-w-[1400px]">
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
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setTab(key)}
              className={[
                'inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                active
                  ? 'text-violet-700 border-violet-600'
                  : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
              ].join(' ')}
            >
              <Icon size={15} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel">
        {tab === 'overview' && (
          <OverviewTab programId={programId} description={program.description ?? null} />
        )}
        {tab === 'curriculum' && <CurriculumTab programId={programId} />}
        {tab === 'staff' && <StaffStudentsTab programId={programId} />}
        {tab === 'attendance' && <AttendanceLogTab programId={programId} />}
        {tab === 'survey' && <SurveyResultTab programId={programId} />}
        {tab === 'share' && <ShareTab programId={programId} />}
        {tab === 'report' && <ReportBuilderTab programId={programId} />}
      </div>
    </div>
  );
}
