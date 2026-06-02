// 박경수님 2026-06-02 STEP-B — 4역할(지원기관·수혜기관·참여팀(개인)·강사/멘토) 공용 외부 공유 페이지.
// /share/{role}/:token 4개 라우트가 role prop 만 다르게 호출.
// 무인증 + 모바일 반응형. ClientSharePage 패턴 재사용.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
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
// 박경수님 2026-06-02 STEP-SURVEY-MULTI-TARGET — 동적 설문 응답
import SurveyResponseItem from './items/SurveyResponseItem';
// 박경수님 2026-06-02 STEP-SURVEY-RESULTS-B — 동적 설문 결과 조회 (지원기관 공유)
import SurveyResultsViewItem from './items/SurveyResultsViewItem';
// 박경수님 2026-06-02 CLUB-3 — 결과보고서 외부 열람
import ReportViewItem from './items/ReportViewItem';
// 박경수님 2026-06-02 CLUB-10 — 동아리 전체 진행률 대시보드
import ClubDashboardItem from './items/ClubDashboardItem';
// 박경수님 2026-06-02 CLUB-13 — 진행 중 파일 제출 (과정 산출물·사진)
import FileUploadItem from './items/FileUploadItem';
// 박경수님 2026-06-02 — invite_response·activity_log·lecture_certificate 는 본인 식별 필요로 일단 안내문 처리
import { fetchShareByToken, getPublicMaterials, type ShareContext } from './sharePortalUtils';
import { isItemVisible } from '../programs/detail/share/shareUtils';
import { STAGE_ITEMS } from '../programs/detail/share/visibilityCatalog';
import type { ShareAudience, ShareStage } from '../../types/database';

interface Props {
  /** 박경수님 2026-06-02 — supporter·beneficiary·team·staff 중 하나 */
  role: Extract<ShareAudience, 'supporter' | 'beneficiary' | 'team' | 'staff'>;
}

export default function RoleSharePage({ role }: Props) {
  const { token } = useParams<{ token: string }>();
  const tokenStr = token ?? '';
  const [ctx, setCtx] = useState<ShareContext | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'before' | 'ok'>('loading');
  // 박경수님 2026-06-02 SHARE-UX-1 — 외부인이 단계 탭으로 모든 과정 골라 보기
  const [viewStage, setViewStage] = useState<ShareStage>('pre');

  useEffect(() => {
    if (!token) { setState('notfound'); return; }
    let cancelled = false;
    setState('loading');
    void (async () => {
      const next = await fetchShareByToken(role, token);
      if (cancelled) return;
      if (!next) { setState('notfound'); return; }
      setCtx(next);
      // 단계 탭 기본값 — 현재 단계 (before 면 pre 부터 보여줌)
      setViewStage(next.stage === 'before' ? 'pre' : next.stage);
      setState(next.stage === 'before' ? 'before' : 'ok');
    })();
    return () => { cancelled = true; };
  }, [token, role]);

  // 박경수님 2026-06-02 — 선택한 단계(viewStage) 기준으로 항목 필터
  const visibleItems = ctx
    ? STAGE_ITEMS[role][viewStage].filter((item) =>
        isItemVisible(ctx.share.visibility, role, item),
      )
    : [];

  return (
    <SharePortalShell
      audience={role}
      state={state}
      program={ctx?.program ?? null}
      stage={ctx?.stage}
      currentStage={ctx?.stage}
      viewStage={viewStage}
      onStageChange={setViewStage}
    >
      {ctx && state === 'ok' && (
        <div className="flex flex-col gap-4">
          {/* 박경수님 2026-06-02 CLUB-13 — 지원·수혜기관은 단계 무관 종합 현황을 상단 고정 (동아리 없으면 자동 숨김) */}
          {(role === 'supporter' || role === 'beneficiary') && (
            <ClubDashboardItem programId={ctx.program.id} />
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
                // 박경수님 2026-06-02 CLUB-10 — 동아리 전체 진행률
                case 'club_dashboard':
                  return <ClubDashboardItem key={item} programId={ctx.program.id} />;
                // 박경수님 2026-06-02 MERGE-2 — 파일 다운/업로드 (기존 컴포넌트 재사용)
                case 'file_download':
                  return <MaterialsItem key={item} files={getPublicMaterials(ctx.program)} />;
                case 'file_upload':
                  // 박경수님 2026-06-02 CLUB-13 — 실제 파일 업로드 (폼 발행 불필요)
                  return <FileUploadItem key={item} programId={ctx.program.id} />;
                case 'approval':
                case 'tax_invoice':
                  // 박경수님 2026-06-02 MERGE-2 — 동의·세금계산서는 PM 안내 + 담당자 연락 흐름 (외부 입력은 추후 STEP)
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
                  // 박경수님 2026-06-02 — 강사/멘토 본인 식별이 필요한 항목들.
                  //   ExpertSharePage 의 PhoneIdentityGate 흐름을 staff role 에 통합하는 작업은 별도 STEP.
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
