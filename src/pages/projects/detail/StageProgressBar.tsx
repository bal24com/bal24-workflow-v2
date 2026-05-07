// bal24 v2 — 프로젝트 단계 진행 바 (V7 헤더 단계 칩 차용 / V2 4단계로 매핑)
// 시각화 전용 — 클릭 변경은 ProjectFormModal에서만 가능 (실수 방지).

import { Check } from 'lucide-react';
import type { ProjectStatus } from '../../../types/database';

const STAGES: ProjectStatus[] = ['제안', '진행', '정산', '종료'];

const STAGE_DESC: Record<ProjectStatus, string> = {
  제안: '계약 전 영업·제안서 단계',
  진행: '계약 체결 후 실행',
  정산: '결과 정리·세금계산서·지급',
  종료: '프로젝트 클로즈',
};

function stageIndex(status: ProjectStatus): number {
  return STAGES.indexOf(status);
}

export default function StageProgressBar({ status }: { status: ProjectStatus }) {
  const currentIdx = stageIndex(status);

  return (
    <section
      aria-label="프로젝트 단계 진행 상태"
      className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]"
    >
      <div className="flex items-center gap-1.5 sm:gap-2">
        {STAGES.map((s, idx) => {
          const isDone = idx < currentIdx;
          const isCurrent = idx === currentIdx;
          const isFuture = idx > currentIdx;

          const pillBase =
            'inline-flex items-center gap-1 px-3 py-1.5 rounded-full text-xs font-semibold transition-colors';
          const pillStyle = isCurrent
            ? 'bg-violet-600 text-white shadow-[0_2px_8px_rgba(124,58,237,0.25)]'
            : isDone
              ? 'bg-violet-50 text-violet-600 border border-violet-200'
              : 'bg-slate-50 text-slate-400 border border-slate-200';

          const connectorStyle = isFuture ? 'bg-slate-200' : 'bg-violet-200';

          return (
            <div key={s} className="flex items-center gap-1.5 sm:gap-2 flex-1 min-w-0">
              <span className={`${pillBase} ${pillStyle} shrink-0`} aria-current={isCurrent ? 'step' : undefined}>
                {isDone && <Check size={11} aria-hidden="true" />}
                {s}
              </span>
              {idx < STAGES.length - 1 && (
                <span className={`flex-1 h-0.5 rounded-full ${connectorStyle}`} aria-hidden="true" />
              )}
            </div>
          );
        })}
      </div>
      <p className="mt-3 text-[11px] text-slate-500">
        현재 단계: <b className="text-violet-700">{status}</b> · {STAGE_DESC[status]}
      </p>
    </section>
  );
}
