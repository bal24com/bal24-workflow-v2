// bal24 v2 — STEP-MYPAGE 프로그램 카드
// 사용자가 참여하는 프로그램을 1장의 카드로 표시.

import { Card, CardContent } from '../../components/ui';
import { formatDateKo } from '../../lib/utils';
import { BADGE_BASE } from '../../utils/statusStyles';
import { getProgramTypeLabel } from '../../constants/programTypes';
import { getProgramTypeConfig } from '../programs/programTypeConfig';
import type { MyPageProgram } from '../../types/mypage';
import { PARTICIPATION_ROLE_LABEL, PARTICIPATION_ROLE_COLOR } from '../../types/mypage';

interface Props {
  program: MyPageProgram;
}

/** 프로그램 유형별 이모지 (program_type 우선, fallback type) */
/** legacy programs.type (4종 한글) → 이모지 — fallback 표시용 */
const LEGACY_TYPE_EMOJI: Record<string, string> = {
  교육: '📚', 캠프: '🏕️', 행사: '🎉', 기타: '📌',
};

export default function MyProgramCard({ program }: Props) {
  // STEP-PROGRAM-TYPE-TS — program_type(영문) 우선, 없으면 legacy type(한글) fallback
  const config = program.program_type ? getProgramTypeConfig(program.program_type) : null;
  const displayType = program.program_type
    ? getProgramTypeLabel(program.program_type)
    : (program.type ?? '기타');
  const emoji = config?.emoji ?? LEGACY_TYPE_EMOJI[program.type ?? '기타'] ?? '📌';

  return (
    <Card className="h-full hover:border-violet-300 hover:shadow-md transition-all">
      <CardContent className="p-4 space-y-2">
        <header className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
            <span aria-hidden="true">{emoji}</span>
            <span className="font-semibold">{displayType}</span>
            <span className={`${BADGE_BASE} ${PARTICIPATION_ROLE_COLOR[program.participation_role]}`}>
              {PARTICIPATION_ROLE_LABEL[program.participation_role]}
            </span>
          </div>
          <div className="flex items-center gap-1">
            {program.status && (
              <span className={`${BADGE_BASE} bg-slate-50 text-slate-600 border-slate-200`}>
                {program.status}
              </span>
            )}
            {program.application_status && (
              <span className={`${BADGE_BASE} bg-emerald-50 text-emerald-600 border-emerald-200`}>
                {program.application_status}
              </span>
            )}
          </div>
        </header>

        <h3 className="text-sm font-bold text-[#1E1B4B] truncate">{program.name}</h3>

        <div className="text-[11px] text-slate-500 flex flex-wrap items-center gap-x-2 gap-y-0.5">
          {(program.start_date || program.end_date) && (
            <span className="tabular-nums">
              {formatDateKo(program.start_date) || '미정'} ~ {formatDateKo(program.end_date) || '미정'}
            </span>
          )}
          {program.venue && <span>· {program.venue}</span>}
        </div>
      </CardContent>
    </Card>
  );
}
