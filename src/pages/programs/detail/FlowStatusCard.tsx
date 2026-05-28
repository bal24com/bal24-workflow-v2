// bal24 v2 — STEP-V9-QUICKWIN QW-3 (박경수님 2026-05-28)
// 프로그램 진행 흐름도 카드 — 제안 → 계약 → 운영 → 종료 4 단계 시각화.
// program.status (한글 4종) 또는 contracts.lifecycle_stage (영문) 모두 자동 매핑.

import { ClipboardList, FileSignature, Rocket, CheckCircle2, ArrowRight } from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';

export type FlowStage = 'proposal' | 'contract' | 'operation' | 'closed';

interface Props {
  /** 영문 단계명(proposal/contract/operation/closed|closing) 또는 한글 status(준비/진행/완료/취소). */
  currentStage: string | null | undefined;
  startDate?: string | null;
  endDate?: string | null;
}

interface StageInfo {
  key: FlowStage;
  label: string;
  Icon: LucideIcon;
}

const STAGES: StageInfo[] = [
  { key: 'proposal',  label: '제안', Icon: ClipboardList   },
  { key: 'contract',  label: '계약', Icon: FileSignature   },
  { key: 'operation', label: '운영', Icon: Rocket          },
  { key: 'closed',    label: '종료', Icon: CheckCircle2    },
];

/** 한글 status 와 영문 lifecycle_stage 를 표준 FlowStage 로 정규화. */
function normalizeStage(raw: string | null | undefined): FlowStage | null {
  if (!raw) return null;
  const v = String(raw).trim().toLowerCase();
  // 영문
  if (v === 'proposal'  || v === '제안')               return 'proposal';
  if (v === 'contract'  || v === '계약' || v === '준비') return 'contract';
  if (v === 'operation' || v === '운영' || v === '진행') return 'operation';
  if (v === 'closed'    || v === 'closing'
   || v === '종료'      || v === '완료')               return 'closed';
  // '취소' 등은 흐름도에선 단계 없음으로 처리
  return null;
}

export default function FlowStatusCard({ currentStage, startDate, endDate }: Props) {
  const current = normalizeStage(currentStage);
  const currentIdx = current ? STAGES.findIndex((s) => s.key === current) : -1;

  const periodLabel = (() => {
    const s = startDate ? formatDateKo(startDate) : null;
    const e = endDate ? formatDateKo(endDate) : null;
    if (s && e) return `${s} ~ ${e}`;
    if (s)      return `${s} 시작`;
    if (e)      return `${e} 마감`;
    return null;
  })();

  return (
    <section
      className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]"
      aria-label="프로그램 진행 흐름도"
    >
      <header className="flex items-center justify-between gap-2 mb-3">
        <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
          <Rocket size={16} className="text-violet-500" aria-hidden="true" />
          진행 흐름
        </h3>
        {periodLabel && (
          <span className="text-[11px] text-slate-500 tabular-nums">{periodLabel}</span>
        )}
      </header>

      <ol
        className="flex items-center justify-between gap-1 sm:gap-2"
        role="list"
      >
        {STAGES.map((stage, idx) => {
          const tone = toneOf(idx, currentIdx);
          const isLast = idx === STAGES.length - 1;
          return (
            <li key={stage.key} className="flex items-center flex-1 min-w-0">
              <div className="flex flex-col items-center gap-1.5 min-w-0 w-full">
                <span
                  className={`inline-flex h-10 w-10 sm:h-12 sm:w-12 items-center justify-center rounded-xl
                              border ${tone.box}`}
                  aria-current={tone.isCurrent ? 'step' : undefined}
                >
                  <stage.Icon size={18} aria-hidden="true" />
                </span>
                <span className={`text-[11px] sm:text-xs font-semibold ${tone.label} truncate`}>
                  {stage.label}
                </span>
              </div>
              {!isLast && (
                <span className={`shrink-0 mx-0.5 sm:mx-1 ${tone.arrow}`} aria-hidden="true">
                  <ArrowRight size={14} />
                </span>
              )}
            </li>
          );
        })}
      </ol>

      {currentIdx < 0 && (
        <p className="mt-3 text-[11px] text-slate-400 text-center italic">
          단계 정보가 아직 없어요.
        </p>
      )}
    </section>
  );
}

/** 카드별 색감 — 완료(연보라) / 현재(진보라 강조) / 미도달(회색). */
function toneOf(idx: number, currentIdx: number) {
  if (currentIdx < 0) {
    return {
      box:   'bg-slate-50 border-slate-200 text-slate-400',
      label: 'text-slate-400',
      arrow: 'text-slate-300',
      isCurrent: false,
    };
  }
  if (idx < currentIdx) {
    return {
      box:   'bg-violet-100 border-violet-200 text-violet-700',
      label: 'text-violet-700',
      arrow: 'text-violet-400',
      isCurrent: false,
    };
  }
  if (idx === currentIdx) {
    return {
      box:   'bg-violet-600 border-violet-700 text-white ring-2 ring-violet-200',
      label: 'text-violet-800 font-bold',
      arrow: 'text-violet-400',
      isCurrent: true,
    };
  }
  return {
    box:   'bg-slate-50 border-slate-200 text-slate-400',
    label: 'text-slate-400',
    arrow: 'text-slate-200',
    isCurrent: false,
  };
}
