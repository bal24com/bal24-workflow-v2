// 박경수님 2026-06-02 STEP-B — 4역할(지원기관·수혜기관·참여팀(개인)·강사/멘토) 공용 외부 공유 페이지.
// /share/{role}/:token 4개 라우트가 role prop 만 다르게 호출.
// 무인증 + 모바일 반응형. program_share 토큰 → 폴백으로 project_portals 토큰 지원.

import { useEffect, useState, useCallback } from 'react';
import { useParams } from 'react-router-dom';
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
  getPublicMaterials,
  type ShareContext,
  type ProjectShareContext,
} from './sharePortalUtils';
import { isItemVisible } from '../programs/detail/share/shareUtils';
import { STAGE_ITEMS, SHARE_AUDIENCE_LABEL } from '../programs/detail/share/visibilityCatalog';
import type { ShareAudience, ShareStage } from '../../types/database';

interface Props {
  role: Extract<ShareAudience, 'supporter' | 'beneficiary' | 'team' | 'staff'>;
}

// ── 프로그램 아코디언 카드 (지원기관용) ────────────────────────────────────────
function SupporterProgramCard({
  program,
}: {
  program: ProjectShareContext['programs'][number];
}) {
  const [open, setOpen] = useState(false);
  const toggle = useCallback(() => setOpen((v) => !v), []);

  return (
    <div className="rounded-2xl border border-violet-100 bg-white shadow-sm overflow-hidden">
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

      {open && (
        <div className="border-t border-violet-50 px-5 py-4 flex flex-col gap-4 bg-slate-50/30">
          <BasicInfoItem program={program} />
          <CurriculumItem programId={program.id} />
          <InstructorsItem programId={program.id} />
          <ClubDashboardItem programId={program.id} />
        </div>
      )}
    </div>
  );
}

// ── 프로젝트 레벨 뷰 (program_share 없고 project_portals 토큰일 때) ──────────
function ProjectShareView({
  role,
  ctx,
}: {
  role: Props['role'];
  ctx: ProjectShareContext;
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
        ) : role === 'supporter' ? (
          ctx.programs.map((p) => (
            <SupporterProgramCard key={p.id} program={p} />
          ))
        ) : role === 'beneficiary' ? (
          ctx.programs.map((p) => (
            <div key={p.id} className="rounded-3xl border border-violet-100 bg-white p-5 shadow-sm space-y-3">
              <div className="flex items-center gap-2">
                <span className="text-sm font-bold text-[#1E1B4B]">{p.name}</span>
                {p.status && (
                  <span className="px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 text-[10px] font-bold">
                    {p.status}
                  </span>
                )}
              </div>
              <BeneficiarySchoolGate programId={p.id} />
            </div>
          ))
        ) : (
          <>
            {ctx.programs.map((p) => (
              <div
                key={p.id}
                className="rounded-2xl border border-violet-100 bg-white p-4 shadow-sm flex items-center justify-between gap-3"
              >
                <div className="min-w-0 flex-1">
                  <p className="text-sm font-bold text-[#1E1B4B] truncate">{p.name}</p>
                  {(p.start_date || p.end_date) && (
                    <p className="text-[11px] text-slate-400 mt-0.5">
                      {p.start_date ?? '?'} ~ {p.end_date ?? '?'}
                    </p>
                  )}
                </div>
                {p.status && (
                  <span className="shrink-0 px-2 py-0.5 rounded-full bg-slate-100 text-slate-500 text-[11px] font-bold">
                    {p.status}
                  </span>
                )}
              </div>
            ))}
            <p className="text-xs text-slate-400 text-center">
              각 프로그램의 상세 공유 링크는 담당자에게 문의해 주세요.
            </p>
          </>
        )}
      </div>
    </div>
  );
}

// ── 메인 컴포넌트 ──────────────────────────────────────────────────────────────
export default function RoleSharePage({ role }: Props) {
  const { token } = useParams<{ token: string }>();
  const tokenStr = token ?? '';
  const [ctx, setCtx] = useState<ShareContext | null>(null);
  const [projectCtx, setProjectCtx] = useState<ProjectShareContext | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'before' | 'ok' | 'project'>('loading');
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
      setState('notfound');
    })();
    return () => { cancelled = true; };
  }, [token, role]);

  // 프로젝트 레벨 뷰 — SharePortalShell 없이 직접 렌더
  if (state === 'project' && projectCtx) {
    return <ProjectShareView role={role} ctx={projectCtx} />;
  }

  const visibleItems = ctx
    ? STAGE_ITEMS[role][viewStage].filter((item) =>
        isItemVisible(ctx.share.visibility, role, item),
      )
    : [];

  return (
    <SharePortalShell
      audience={role}
      state={state === 'project' ? 'loading' : state}
      program={ctx?.program ?? null}
      stage={ctx?.stage}
      currentStage={ctx?.stage}
      viewStage={viewStage}
      onStageChange={setViewStage}
    >
      {ctx && state === 'ok' && (
        <div className="flex flex-col gap-4">
          {(role === 'supporter' || role === 'beneficiary') && (
            <ClubDashboardItem programId={ctx.program.id} />
          )}
          {role === 'beneficiary' && (
            <BeneficiarySchoolGate programId={ctx.program.id} />
          )}
          {visibleItems.length === 0 ? (
            <section className="rounded-2xl border border-violet-100 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">이 단계에 노출된 항목이 없어요.</p>
              <p className="mt-1 text-[11px] text-slate-400">다른 단계 탭을 선택하거나 담당자에게 문의해 주세요.</p>
            </section>
          ) : (
            visibleItems.map((item) => {
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
            })
          )}
        </div>
      )}
    </SharePortalShell>
  );
}
