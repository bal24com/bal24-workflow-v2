// bal24 v2 — 외부공유 · 고객(담당자) 페이지 (Stage 3-B-2-①)
// 무인증 + 모바일 반응형. token으로 program_share fetch → 단계 자동 판별 → 7 항목 렌더.

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
import { fetchShareByToken, getPublicMaterials, type ShareContext } from './sharePortalUtils';
import { isItemVisible } from '../programs/detail/share/shareUtils';
import { STAGE_ITEMS } from '../programs/detail/share/visibilityCatalog';

export default function ClientSharePage() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<ShareContext | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'before' | 'ok'>('loading');

  useEffect(() => {
    if (!token) {
      setState('notfound');
      return;
    }
    let cancelled = false;
    setState('loading');
    void (async () => {
      const next = await fetchShareByToken('client', token);
      if (cancelled) return;
      if (!next) {
        setState('notfound');
        return;
      }
      setCtx(next);
      setState(next.stage === 'before' ? 'before' : 'ok');
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const visibleItems = ctx
    ? STAGE_ITEMS.client[ctx.stage].filter((item) =>
        isItemVisible(ctx.share.visibility, 'client', item),
      )
    : [];

  return (
    <SharePortalShell
      audience="client"
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
