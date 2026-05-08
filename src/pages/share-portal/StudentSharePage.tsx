// bal24 v2 — 외부공유 · 학생 페이지 (Stage 3-B-2-②)
// 진행 단계: 출석체크 / 결과 단계: 만족도 응답·결과물 업로드.

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SharePortalShell from './SharePortalShell';
import CheckinItem from './items/CheckinItem';
import SurveySubmitItem from './items/SurveySubmitItem';
import OutcomeUploadItem from './items/OutcomeUploadItem';
import { fetchShareByToken, type ShareContext } from './sharePortalUtils';
import { isItemVisible } from '../programs/detail/share/shareUtils';
import { STAGE_ITEMS } from '../programs/detail/share/visibilityCatalog';

export default function StudentSharePage() {
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
      const next = await fetchShareByToken('student', token);
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
    ? STAGE_ITEMS.student[ctx.stage].filter((item) =>
        isItemVisible(ctx.share.visibility, 'student', item),
      )
    : [];

  return (
    <SharePortalShell
      audience="student"
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
                case 'checkin':
                  return <CheckinItem key={item} programId={ctx.program.id} />;
                case 'survey_submit':
                  return (
                    <SurveySubmitItem
                      key={item}
                      programId={ctx.program.id}
                      surveyOpenAt={ctx.share.survey_open_at ?? null}
                    />
                  );
                case 'outcome_upload':
                  return <OutcomeUploadItem key={item} programId={ctx.program.id} />;
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
