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
// 박경수님 2026-06-02 — invite_response·activity_log·lecture_certificate 는 본인 식별 필요로 일단 안내문 처리
import { fetchShareByToken, getPublicMaterials, type ShareContext } from './sharePortalUtils';
import { isItemVisible } from '../programs/detail/share/shareUtils';
import { STAGE_ITEMS } from '../programs/detail/share/visibilityCatalog';
import type { ShareAudience } from '../../types/database';

interface Props {
  /** 박경수님 2026-06-02 — supporter·beneficiary·team·staff 중 하나 */
  role: Extract<ShareAudience, 'supporter' | 'beneficiary' | 'team' | 'staff'>;
}

export default function RoleSharePage({ role }: Props) {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<ShareContext | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'before' | 'ok'>('loading');

  useEffect(() => {
    if (!token) { setState('notfound'); return; }
    let cancelled = false;
    setState('loading');
    void (async () => {
      const next = await fetchShareByToken(role, token);
      if (cancelled) return;
      if (!next) { setState('notfound'); return; }
      setCtx(next);
      setState(next.stage === 'before' ? 'before' : 'ok');
    })();
    return () => { cancelled = true; };
  }, [token, role]);

  const visibleItems = ctx
    ? STAGE_ITEMS[role][ctx.stage].filter((item) =>
        isItemVisible(ctx.share.visibility, role, item),
      )
    : [];

  // team / staff 는 SharePortalShell 의 audience prop 호환 위해 student / expert 로 매핑
  const shellAudience: 'client' | 'student' | 'expert' =
      role === 'supporter'   ? 'client'
    : role === 'beneficiary' ? 'client'
    : role === 'team'        ? 'student'
    :                          'expert'; // staff

  return (
    <SharePortalShell
      audience={shellAudience}
      state={state}
      program={ctx?.program ?? null}
      stage={ctx?.stage}
    >
      {ctx && state === 'ok' && (
        <div className="flex flex-col gap-4">
          {visibleItems.length === 0 ? (
            <section className="rounded-2xl border border-violet-100 bg-white p-8 text-center">
              <p className="text-sm text-slate-500">현재 단계에 노출 가능한 항목이 없어요.</p>
              <p className="mt-1 text-[11px] text-slate-400">담당자에게 문의해 주세요.</p>
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
