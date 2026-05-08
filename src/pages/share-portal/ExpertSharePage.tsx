// bal24 v2 — 외부공유 · 전문가 페이지 (Stage 3-B-2-②)
// 본인 식별 게이트 → 단계별: 사전·준비(invite_response) / 진행(activity_log) / 결과(lecture_certificate).

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import SharePortalShell from './SharePortalShell';
import PhoneIdentityGate, { type IdentifiedExpert } from './identity/PhoneIdentityGate';
import InviteResponseItem from './items/InviteResponseItem';
import ActivityLogItem from './items/ActivityLogItem';
import LectureCertificateItem from './items/LectureCertificateItem';
import ItemCard from './items/ItemCard';
import { fetchShareByToken, type ShareContext } from './sharePortalUtils';
import { isItemVisible } from '../programs/detail/share/shareUtils';
import { STAGE_ITEMS } from '../programs/detail/share/visibilityCatalog';
import { ShieldCheck } from 'lucide-react';

export default function ExpertSharePage() {
  const { token } = useParams<{ token: string }>();
  const [ctx, setCtx] = useState<ShareContext | null>(null);
  const [state, setState] = useState<'loading' | 'notfound' | 'before' | 'ok'>('loading');
  const [identified, setIdentified] = useState<IdentifiedExpert | null>(null);

  useEffect(() => {
    if (!token) {
      setState('notfound');
      return;
    }
    let cancelled = false;
    setState('loading');
    void (async () => {
      const next = await fetchShareByToken('expert', token);
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
    ? STAGE_ITEMS.expert[ctx.stage].filter((item) =>
        isItemVisible(ctx.share.visibility, 'expert', item),
      )
    : [];

  // ActivityLog는 외부 강사(staff_pool)만 작성 가능 — 내부 직원은 V2 내부 메뉴 사용
  const expertId = identified?.source === 'external' ? identified.identifierId : null;

  return (
    <SharePortalShell
      audience="expert"
      state={state}
      program={ctx?.program ?? null}
      stage={ctx?.stage}
    >
      {ctx && state === 'ok' && (
        <div className="flex flex-col gap-4">
          {!identified ? (
            <PhoneIdentityGate
              programId={ctx.program.id}
              onIdentified={setIdentified}
            />
          ) : (
            <>
              {/* 식별 정보 안내 */}
              <section className="rounded-2xl border border-violet-100 bg-violet-50/40 px-4 py-3 flex items-center gap-2">
                <ShieldCheck size={16} className="shrink-0 text-violet-600" aria-hidden="true" />
                <p className="text-xs text-[#1E1B4B]">
                  <b>{identified.name}</b> ({identified.source === 'external' ? '외부 강사' : '내부 직원'}) 본인 확인 완료 ·{' '}
                  매칭 {identified.curriculumStaffIds.length}건
                </p>
                <button
                  type="button"
                  onClick={() => setIdentified(null)}
                  className="ml-auto text-[11px] font-semibold text-slate-500 hover:text-violet-700 transition-colors"
                >
                  변경
                </button>
              </section>

              {visibleItems.length === 0 ? (
                <ItemCard icon={<ShieldCheck size={18} />} title="안내">
                  <p className="text-sm text-slate-500">현재 단계에 노출 가능한 항목이 없어요.</p>
                </ItemCard>
              ) : (
                visibleItems.map((item) => {
                  switch (item) {
                    case 'invite_response':
                      return (
                        <InviteResponseItem
                          key={item}
                          curriculumStaffIds={identified.curriculumStaffIds}
                        />
                      );
                    case 'activity_log':
                      return (
                        <ActivityLogItem
                          key={item}
                          programId={ctx.program.id}
                          expertId={expertId}
                        />
                      );
                    case 'lecture_certificate':
                      return (
                        <LectureCertificateItem
                          key={item}
                          programId={ctx.program.id}
                          expertId={expertId}
                        />
                      );
                    default:
                      return null;
                  }
                })
              )}
            </>
          )}
        </div>
      )}
    </SharePortalShell>
  );
}
