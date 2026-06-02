// bal24 v2 — 외부공유 페이지 공통 셸 (Stage 3-B-2-①)
// 헤더(프로그램명·기간·장소) + 단계 배지 + 본문 + 푸터 + 모바일 반응형.

import type { ReactNode } from 'react';
import { Loader2, ShieldAlert, Hourglass } from 'lucide-react';
import { formatDateKo } from '../../lib/utils';
import { BADGE_BASE, PROGRAM_TYPE_STYLE } from '../../utils/statusStyles';
import {
  SHARE_AUDIENCE_LABEL, SHARE_STAGE_LABEL,
} from '../programs/detail/share/visibilityCatalog';
import type { Program, ShareAudience, ShareStage } from '../../types/database';

interface Props {
  audience: ShareAudience;
  state: 'loading' | 'notfound' | 'before' | 'ok';
  program?: Program | null;
  stage?: ShareStage;
  children?: ReactNode;
  // 박경수님 2026-06-02 SHARE-UX-1 — 단계 탭 (외부인이 모든 과정 골라 보기)
  currentStage?: ShareStage;
  viewStage?: ShareStage;
  onStageChange?: (s: ShareStage) => void;
}

const STAGE_TONE: Record<ShareStage, string> = {
  before:   'bg-slate-100 text-slate-500',
  pre:      'bg-violet-100 text-violet-700',
  ready:    'bg-cyan-100 text-cyan-700',
  progress: 'bg-orange-100 text-orange-700',
  result:   'bg-emerald-100 text-emerald-700',
};

// 박경수님 2026-06-02 SHARE-UX-1 — 단계 탭 (before 제외 — 실제 운영 4단계)
const STAGE_TABS: ShareStage[] = ['pre', 'ready', 'progress', 'result'];

export default function SharePortalShell({
  audience, state, program, stage, children,
  currentStage, viewStage, onStageChange,
}: Props) {
  const audienceLabel = SHARE_AUDIENCE_LABEL[audience];

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 flex items-start justify-center px-4 py-6 sm:py-10">
      <div className="w-full max-w-md sm:max-w-2xl flex flex-col gap-4">
        {state === 'loading' && (
          <section className="rounded-2xl border border-violet-100 bg-white p-8 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col items-center gap-2">
            <Loader2 className="animate-spin text-violet-400" size={24} aria-hidden="true" />
            <p className="text-sm text-slate-500">불러오는 중…</p>
          </section>
        )}

        {state === 'notfound' && (
          <section className="rounded-2xl border border-rose-100 bg-white p-8 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col items-center gap-3 text-center">
            <ShieldAlert className="text-rose-400" size={32} aria-hidden="true" />
            <p className="text-base font-bold text-[#1E1B4B]">접근할 수 없는 링크예요</p>
            <p className="text-sm text-slate-500 leading-relaxed">
              이 링크는 만료됐거나 새로 발급된 링크일 수 있어요.
              <br />
              담당자에게 새 링크를 요청해 주세요.
            </p>
          </section>
        )}

        {(state === 'before' || state === 'ok') && program && (
          <>
            <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-2">
              <div className="flex items-center gap-2 flex-wrap">
                <span className={`${BADGE_BASE} ${PROGRAM_TYPE_STYLE[program.type]}`}>{program.type}</span>
                <span className="text-[11px] text-slate-500">{audienceLabel}</span>
                {stage && (
                  <span className={`ml-auto inline-flex items-center px-2.5 py-1 rounded-full text-[11px] font-bold ${STAGE_TONE[stage]}`}>
                    {SHARE_STAGE_LABEL[stage]}
                  </span>
                )}
              </div>
              <h1 className="text-lg sm:text-xl font-bold text-[#1E1B4B] leading-snug">{program.name}</h1>
              <div className="text-xs text-slate-500 flex flex-wrap gap-x-3 gap-y-1">
                {(program.start_date || program.end_date) && (
                  <span>
                    {formatDateKo(program.start_date) || '미정'} ~ {formatDateKo(program.end_date) || '미정'}
                  </span>
                )}
                {program.venue && <span>· {program.venue}</span>}
                {program.capacity != null && <span>· 정원 {program.capacity}명</span>}
              </div>
            </header>

            {/* 박경수님 2026-06-02 SHARE-UX-1 — 단계 탭 (모든 과정 골라 보기) */}
            {state === 'ok' && onStageChange && viewStage && (
              <nav role="tablist" aria-label="단계 선택"
                className="flex items-center gap-1 bg-white rounded-2xl border border-violet-100 p-1 shadow-[0_4px_16px_rgba(124,58,237,0.06)] overflow-x-auto">
                {STAGE_TABS.map((s) => {
                  const active = viewStage === s;
                  const isCurrent = currentStage === s;
                  return (
                    <button key={s} type="button" role="tab" aria-selected={active}
                      onClick={() => onStageChange(s)}
                      className={`flex-1 min-w-[72px] inline-flex items-center justify-center gap-1 px-2 py-2 rounded-xl text-xs font-bold whitespace-nowrap transition-colors ${
                        active ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-violet-50'
                      }`}>
                      {SHARE_STAGE_LABEL[s]}
                      {isCurrent && (
                        <span className={`w-1.5 h-1.5 rounded-full ${active ? 'bg-white' : 'bg-violet-500'}`} aria-hidden="true" />
                      )}
                    </button>
                  );
                })}
              </nav>
            )}

            {state === 'before' && (
              <section className="rounded-2xl border border-violet-100 bg-white p-8 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col items-center gap-3 text-center">
                <Hourglass className="text-violet-400" size={28} aria-hidden="true" />
                <p className="text-base font-bold text-[#1E1B4B]">아직 시작 전이에요</p>
                <p className="text-sm text-slate-500 leading-relaxed">
                  사전 단계 시작일이 되면 정보가 노출돼요.
                  <br />
                  잠시 후 다시 방문해 주세요.
                </p>
              </section>
            )}

            {state === 'ok' && children}
          </>
        )}

        <footer className="text-center pt-2 pb-1">
          <p className="text-[10px] text-slate-400">© 2026 BalanceDot WorkFlow · 외부 공유 페이지</p>
        </footer>
      </div>
    </div>
  );
}
