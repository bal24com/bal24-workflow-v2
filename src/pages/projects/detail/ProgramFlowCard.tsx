// bal24 v2 — 프로그램 흐름도 카드 (STEP-PROJECT-FLOW)
// 카드 1개 — 유형 이모지·기간·상태 배지. 완료 시 dimmed + Check 아이콘. 클릭 → 상세 이동.

import { useNavigate } from 'react-router-dom';
import { CheckCircle2, Calendar } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';
import { getProgramTypeConfig } from '../../programs/programTypeConfig';
import { getProgramTypeLabel } from '../../../constants/programTypes';
import { BADGE_BASE, PROGRAM_STATUS_STYLE } from '../../../utils/statusStyles';
import type { ProgramStatus } from '../../../types/database';
import type { FlowProgram } from './projectDetailUtils';

interface Props {
  program: FlowProgram;
  isDone: boolean;
}

export default function ProgramFlowCard({ program, isDone }: Props) {
  const navigate = useNavigate();
  // STEP-PROGRAM-TYPE-TS — 영문 키 fallback 'general'
  const typeKey = program.program_type ?? 'general';
  const config = getProgramTypeConfig(typeKey);
  const typeLabel = getProgramTypeLabel(typeKey);
  const statusKey = (program.status ?? '준비') as ProgramStatus;
  const statusStyle = PROGRAM_STATUS_STYLE[statusKey] ?? PROGRAM_STATUS_STYLE['준비'];

  const periodLabel = (() => {
    const s = formatDateKo(program.start_date);
    const e = formatDateKo(program.end_date);
    if (s && e) return `${s} ~ ${e}`;
    if (s) return s;
    if (e) return e;
    return '일정 미정';
  })();

  return (
    <button
      type="button"
      onClick={() => navigate(`/programs/${program.id}`)}
      className={[
        'relative shrink-0 flex flex-col gap-2 text-left',
        'min-w-[240px] max-w-[280px] w-[260px]',
        'rounded-2xl border-2 px-4 py-3.5',
        'transition-all hover:shadow-md hover:-translate-y-0.5',
        config.color,
        isDone ? 'opacity-60 grayscale' : '',
      ].join(' ')}
      aria-label={`${program.name} 상세 보기`}
    >
      {isDone && (
        <CheckCircle2
          size={16}
          className="absolute top-2 right-2 text-emerald-500"
          aria-hidden="true"
        />
      )}

      {/* 상단: 이모지 + 유형 */}
      <div className="flex items-center gap-1.5">
        <span className="text-lg" aria-hidden="true">{config.emoji}</span>
        <span className="text-[11px] font-semibold text-slate-500 truncate">
          {typeLabel}
        </span>
      </div>

      {/* 중앙: 프로그램명 */}
      <p className="text-sm font-bold text-[#1E1B4B] line-clamp-2 min-h-[2.5em]">
        {program.name}
      </p>

      {/* 하단: 기간 + 상태 */}
      <div className="flex items-center justify-between gap-2 mt-1">
        <span className="flex items-center gap-1 text-[10px] text-slate-500 truncate">
          <Calendar size={10} aria-hidden="true" />
          {periodLabel}
        </span>
        <span className={`${BADGE_BASE} ${statusStyle} shrink-0 text-[10px]`}>
          {statusKey}
        </span>
      </div>
    </button>
  );
}
