// 박경수님 2026-06-02 STEP-B — 4역할(지원기관·수혜기관·참여팀(개인)·강사/멘토) 공용 외부 공유 페이지.
// /share/{role}/:token 4개 라우트가 role prop 만 다르게 호출.
// 무인증 + 모바일 반응형. program_share 토큰 → 폴백으로 project_portals 토큰 지원.

import { useEffect, useState, useCallback } from 'react';
import { useParams, useSearchParams } from 'react-router-dom';
import { ChevronDown, ChevronUp } from 'lucide-react';
import SharePortalShell from './SharePortalShell';
import BasicInfoItem from './items/BasicInfoItem';
import CurriculumItem from './items/CurriculumItem';
import InstructorsItem from './items/InstructorsItem';
import MaterialsItem from './items/MaterialsItem';
import PortalProgressItem from './items/PortalProgressItem';
import SurveyViewItem from './items/SurveyViewItem';
import EditRequestItem from './items/EditRequestItem';
import FeedbackCommentsItem from './items/FeedbackCommentsItem';
import CheckinItem from './items/CheckinItem';
import SurveySubmitItem from './items/SurveySubmitItem';
import OutcomeUploadItem from './items/OutcomeUploadItem';
import SurveyResponseItem from './items/SurveyResponseItem';
import SurveyResultsViewItem from './items/SurveyResultsViewItem';
import ReportViewItem from './items/ReportViewItem';
import ClubDashboardItem from './items/ClubDashboardItem';
import FileUploadItem from './items/FileUploadItem';
import BeneficiarySchoolGate from './BeneficiarySchoolGate';
import {
  fetchShareByToken,
  fetchProjectShareByToken,
  fetchConsortiumShareByToken,
  getPublicMaterials,
  type ShareContext,
  type ProjectShareContext,
  type ConsortiumPortalData,
} from './sharePortalUtils';
import ConsortiumRolePortalPage from './ConsortiumRolePortalPage';
import { isItemVisible } from '../programs/detail/share/shareUtils';
import { STAGE_ITEMS, SHARE_AUDIENCE_LABEL } from '../programs/detail/share/visibilityCatalog';
import type { ShareAudience, ShareStage, ShareItem } from '../../types/database';

interface Props {
  role: Extract<ShareAudience, 'supporter' | 'beneficiary' | 'team' | 'staff'>;
}

// ── 역할별 탭 정의 ────────────────────────────────────────────────────────────
const ROLE_TABS: Record<Props['role'], Array<{ key: string; label: string }>> = {
  supporter:   [{ key: 'info', label: '기초정보' }, { key: 'curriculum', label: '커리큘럼' }, { key: 'instructors', label: '강사진' }, { key: 'clubs', label: '동아리 현황' }],
  beneficiary: [{ key: 'clubs', label: '동아리 관리' }, { key: 'survey', label: '설문·모집' }],
  team:        [{ key: 'info', label: '기초정보' }, { key: 'curriculum', label: '커리큘럼' }],
  staff:       [{ key: 'curriculum', label: '커리큘럼' }, { key: 'instructors', label: '강사진' }],
};

// ── 역할별 아코디언 카드 (탭 내장) ───────────────────────────────────────────
function RoleAccordionCard({
  role,
  program,
  token,
}: {
  role: Props['role'];
  program: ProjectShareContext['programs'][number];
  token: string;
}) {
  const [open, setOpen] = useState(false);
  const tabs = ROLE_TABS[role];
  const [activeTab, setActiveTab] = useState(tabs[0].key);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden">
      {/* 헤더 */}
      <button
        type="button"
        onClick={toggle}
        className="w-full flex items-center justify-between gap-3 px-5 py-4 text-left hover:bg-violet-50/40 transition-colors"
      >
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1E1B4B] truncate">{program.name}</p>
          {(program.start_date || program.end_date) && (
            <p className="text-[11px] text-slate-400 mt-0.5">
              {program.start_date ?? '?'} ~ {program.end_date ?? '?'}
            </p>
          )}
        </div>
        <div className="flex items-center gap-2 shrink-0">
          {program.status && (
            <span className="px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">
              {program.status}
            </span>
          )}
          {open
            ? <ChevronUp size={15} className="text-violet-500" />
            : <ChevronDown size={15} className="text-slate-400" />}
        </div>
      </button>

      {/* 탭 바 + 콘텐츠 */}
      {open && (
        <div className="border-t border-violet-100">
          {/* 탭 버튼 목록 */}
          <div className="flex border-b border-violet-50 bg-slate-50/60 px-4 gap-1 overflow-x-auto">
            {tabs.map((tab) => (
              <button
                key={tab.key}
                type="button"
                onClick={() => setActiveTab(tab.key)}
                className={`shrink-0 px-3 py-2.5 text-xs font-bold border-b-2 transition-colors ${
                  activeTab === tab.key
                    ? 'border-violet-600 text-violet-700'
                    : 'border-transparent text-slate-400 hover:text-slate-600'
                }`}
              >
                {tab.label}
              </button>
            ))}
          </div>

          {/* 탭 콘텐츠 */}
          <div className="px-5 py-4">
            {activeTab === 'info'        && <BasicInfoItem program={program} />}
            {activeTab === 'curriculum'  && <CurriculumItem programId={program.id} />}
            {activeTab === 'instructors' && <InstructorsItem programId={program.id} />}
            {activeTab === 'clubs'       && role === 'supporter' && <ClubDashboardItem programId={program.id} />}
            {activeTab === 'clubs'       && role === 'beneficiary' && <BeneficiarySchoolGate programId={program.id} />}
            {activeTab === 'survey'      && (
              <SurveyResponseItem programId={program.id} role="beneficiary" respondentToken={token} />
            )}
          </div>
        </div>
      )}
    </div>
  );
}

// ── 프로젝트 레벨 뷰 (program_share 없고 project_portals 토큰일 때) ──────────
function ProjectShareView({
  role,
  ctx,
  token,
}: {
  role: Props['role'];
  ctx: ProjectShareContext;
  token: string;
}) {
  const roleLabel = SHARE_AUDIENCE_LABEL[role];

  return (
    <div className="min-h-screen bg-slate-50/60 flex flex-col items-center px-4 py-10 gap-6">
      <div className="w-full max-w-2xl space-y-1">
        <span className="inline-flex px-2 py-0.5 rounded-full bg-violet-100 text-violet-700 text-[11px] font-bold">
          {roleLabel}
        </span>
        <h1 className="text-xl font-black text-[#1E1B4B]">{ctx.projectName}</h1>
        <p className="text-xs text-slate-400">프로젝트 외부 공유 포털입니다.</p>
      </div>

      <div className="w-full max-w-2xl space-y-3">
        {ctx.programs.length === 0 ? (
          <div className="rounded-3xl border border-slate-100 bg-white p-8 text-center">
            <p className="text-sm text-slate-400">등록된 프로그램이 없어요.</p>
          </div>
        ) : (
          ctx.programs.map((p) => (
            <RoleAccordionCard key={p.id} role={role} program={p} token={token} />
          ))
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function RoleSharePage({ role }: Props) {
  const { token } = useParams<{ token: string }>();
  const tokenStr = token ?? '';
  const [searchParams] = useSearchParams();
  // 박경수님 2026-06-08 — URL ?org= 로 학교/기관 식별 (수혜기관 학교별·지원기관 기관별 링크)
  const orgName = searchParams.get('org')?.trim() || undefined;
  const [ctx, setCtx] = useState<ShareContext | null>(null);
  const [projectCtx, setProjectCtx] = useState<ProjectShareContext | null>(null);
  const [consortiumData, setConsortiumData] = useState<ConsortiumPortalData | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'before' | 'ok' | 'project' | 'consortium'>('loading');
  const [viewStage, setViewStage] = useState<ShareStage>('pre');

  useEffect(() => {
    if (!token) { setState('notfound'); return; }
    let cancelled = false;
    setState('loading');
    void (async () => {
      // 1차: program_share 토큰 시도
      const next = await fetchShareByToken(role, token);
      if (cancelled) return;
      if (next) {
        setCtx(next);
        setViewStage(next.stage === 'before' ? 'pre' : next.stage);
        setState(next.stage === 'before' ? 'before' : 'ok');
        return;
      }
      // 2차: project_portals 토큰 폴백
      const proj = await fetchProjectShareByToken(role, token);
      if (cancelled) return;
      if (proj) {
        setProjectCtx(proj);
        setState('project');
        return;
      }
      // 3차: consortium_links 토큰 폴백 (보안 RPC)
      const conData = await fetchConsortiumShareByToken(role, token);
      if (cancelled) return;
      if (conData) {
        setConsortiumData(conData);
        setState('consortium');
        return;
      }
      setState('notfound');
    })();
    return () => { cancelled = true; };
  }, [token, role]);

  // 컨소시엄 포털 뷰
  if (state === 'consortium' && consortiumData) {
    return <ConsortiumRolePortalPage roleType={role} data={consortiumData} />;
  }

  // 프로젝트 레벨 뷰 — SharePortalShell 없이 직접 렌더
  if (state === 'project' && projectCtx) {
    return <ProjectShareView role={role} ctx={projectCtx} token={tokenStr} />;
  }

  const visibleItems = ctx
    ? STAGE_ITEMS[role][viewStage].filter((item) =>
        isItemVisible(ctx.share.visibility, role, item),
      )
    : [];

  // 박경수님 2026-06-08 — 기본정보·커리큘럼은 항상 탭 상단에 먼저 노출
  const LEAD_ITEMS: ShareItem[] = ['basic_info', 'curriculum'];
  const leadItems = visibleItems.filter((i) => LEAD_ITEMS.includes(i));
  const restItems = visibleItems.filter((i) => !LEAD_ITEMS.includes(i));

  const renderItem = (item: ShareItem) => {
    if (!ctx) return null;
    switch (item) {
      case 'basic_info':
        return <BasicInfoItem key={item} program={ctx.program} />;
      case 'curriculum':
        return <CurriculumItem key={item} programId={ctx.program.id} />;
      case 'instructors':
        return <InstructorsItem key={item} programId={ctx.program.id} />;
      case 'materials':
        return <MaterialsItem key={item} files={getPublicMaterials(ctx.program)} />;
      case 'portal_progress':
        return <PortalProgressItem key={item} programId={ctx.program.id} />;
      case 'survey_view':
        return <SurveyViewItem key={item} programId={ctx.program.id} />;
      case 'edit_request':
        return <EditRequestItem key={item} programId={ctx.program.id} />;
      case 'feedback_comments':
        return <FeedbackCommentsItem key={item} programId={ctx.program.id} />;
      case 'checkin':
        return <CheckinItem key={item} programId={ctx.program.id} />;
      case 'survey_submit':
        return (
          <SurveySubmitItem key={item} programId={ctx.program.id}
            surveyOpenAt={ctx.share.survey_open_at ?? null} />
        );
      case 'outcome_upload':
        return <OutcomeUploadItem key={item} programId={ctx.program.id} />;
      case 'survey_response':
        return (
          <SurveyResponseItem key={item}
            programId={ctx.program.id}
            role={role}
            respondentToken={tokenStr} />
        );
      case 'survey_results_view':
        return <SurveyResultsViewItem key={item} programId={ctx.program.id} />;
      case 'report_view':
        return <ReportViewItem key={item} programId={ctx.program.id} />;
      case 'club_dashboard':
        return <ClubDashboardItem key={item} programId={ctx.program.id} />;
      case 'file_download':
        return <MaterialsItem key={item} files={getPublicMaterials(ctx.program)} />;
      case 'file_upload':
        return <FileUploadItem key={item} programId={ctx.program.id} />;
      case 'approval':
      case 'tax_invoice':
        return (
          <section key={item} className="rounded-2xl border border-violet-100 bg-white p-4 text-center">
            <p className="text-xs font-semibold text-[#1E1B4B]">
              {item === 'approval' ? '동의·확인 요청 항목이에요.' : '세금계산서 요청 항목이에요.'}
            </p>
            <p className="text-[11px] text-slate-500 mt-0.5">담당자에게 문의해 주세요.</p>
          </section>
        );
      case 'invite_response':
      case 'activity_log':
      case 'lecture_certificate':
        return (
          <section key={item} className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 text-center">
            <p className="text-xs font-semibold text-amber-800">본인 확인이 필요한 항목이에요.</p>
            <p className="text-[11px] text-amber-700 mt-0.5">기존 강사 외부공유 링크(/share/expert) 를 이용해 주세요.</p>
          </section>
        );
      default:
        return null;
    }
  };

  return (
    <SharePortalShell
      audience={role}
      state={state === 'project' || state === 'consortium' ? 'loading' : state}
      program={ctx?.program ?? null}
      stage={ctx?.stage}
      orgName={orgName}
      currentStage={ctx?.stage}
      viewStage={viewStage}
      onStageChange={setViewStage}
    >
      {ctx && state === 'ok' && (
        <div className="flex flex-col gap-4">
          {/* 1) 기본정보·커리큘럼 먼저 */}
          {leadItems.map(renderItem)}
          {/* 2) 동아리 종합 현황 (지원기관·수혜기관) */}
          {(role === 'supporter' || role === 'beneficiary') && (
            <ClubDashboardItem programId={ctx.program.id} />
          )}
          {role === 'beneficiary' && (
            <BeneficiarySchoolGate programId={ctx.program.id} preselectedSchool={orgName} />
          )}
          {/* 3) 나머지 항목 */}
          {visibleItems.length === 0 ? (
            <section className="rounded-2xl border border-violet-100 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">이 단계에 노출된 항목이 없어요.</p>
              <p className="mt-1 text-[11px] text-slate-400">다른 단계 탭을 선택하거나 담당자에게 문의해 주세요.</p>
            </section>
          ) : (
            restItems.map(renderItem)
          )}
        </div>
      )}
    </SharePortalShell>
  );
}
