// bal24 v2 — 프로그램 교육 개요 카드 (기간·장소·주관·대상·정원·카테고리·목표·예산·상태·현재참여자)

import { useEffect, useState } from 'react';
import type { ReactNode } from 'react';
import { Calendar, MapPin, Building2, Users, Tag, Target, Wallet, CircleCheck } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import { formatDateKo } from '../../../../lib/utils';
import { PROGRAM_TYPE_LABELS } from '../../../../constants/programTypes';
import { BADGE_BASE, PROGRAM_STATUS_STYLE } from '../../../../utils/statusStyles';
import type { Program } from '../../../../types/database';

interface Props {
  program: Program;
}

export default function ProgramOverviewCard({ program }: Props) {
  const [participantCount, setParticipantCount] = useState<number>(0);

  useEffect(() => {
    if (!program.id) return;
    let cancelled = false;
    void (async () => {
      const { count, error } = await supabase
        .from('program_participants').select('id', { count: 'exact', head: true }).eq('program_id', program.id);
      if (cancelled) return;
      if (error) console.error('[overview-card] 참여자 카운트 실패:', error.message);
      setParticipantCount(count ?? 0);
    })();
    return () => { cancelled = true; };
  }, [program.id]);

  const typeLabel = program.program_type ? PROGRAM_TYPE_LABELS[program.program_type] ?? program.program_type : null;
  const period = (program.start_date || program.end_date)
    ? `${formatDateKo(program.start_date) || '미정'} ~ ${formatDateKo(program.end_date) || '미정'}`
    : null;
  const target = program.target_audience
    ? `${program.target_audience}${program.max_participants ? ` (${program.max_participants}명)` : ''}`
    : null;
  const orgLine = [program.client_org, program.department].filter(Boolean).join(' · ');
  const budget = program.grant_budget && program.grant_budget > 0
    ? `${program.grant_budget.toLocaleString()}원`
    : null;

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold text-[#1E1B4B] flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <Calendar size={14} className="text-violet-500" aria-hidden="true" />
            교육 개요
          </span>
          <span className={`${BADGE_BASE} ${PROGRAM_STATUS_STYLE[program.status]}`}>{program.status}</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-x-4 gap-y-1.5">
          {period       && <Info icon={<Calendar size={12} aria-hidden="true" />}     label="기간"     value={period} />}
          {program.venue && <Info icon={<MapPin size={12} aria-hidden="true" />}      label="장소"     value={program.venue} />}
          {orgLine      && <Info icon={<Building2 size={12} aria-hidden="true" />}    label="주관"     value={orgLine} />}
          {target       && <Info icon={<Users size={12} aria-hidden="true" />}        label="대상"     value={target} />}
          <Info          icon={<Users size={12} aria-hidden="true" />}                label="현재 참여자" value={`${participantCount}명`} />
          {typeLabel    && <Info icon={<Tag size={12} aria-hidden="true" />}          label="카테고리" value={typeLabel} />}
          {budget       && <Info icon={<Wallet size={12} aria-hidden="true" />}       label="예산"     value={budget} />}
          {program.goal_text && <Info icon={<Target size={12} aria-hidden="true" />} label="목표"     value={program.goal_text} fullWidth />}
          {program.description && <Info icon={<CircleCheck size={12} aria-hidden="true" />} label="설명" value={program.description} fullWidth />}
        </div>
      </CardContent>
    </Card>
  );
}

function Info({ icon, label, value, fullWidth }: { icon: ReactNode; label: string; value: string; fullWidth?: boolean }) {
  return (
    <div className={`flex items-start gap-2 text-sm ${fullWidth ? 'sm:col-span-2' : ''}`}>
      <span className="inline-flex items-center justify-center w-4 h-4 mt-0.5 text-slate-400 shrink-0">{icon}</span>
      <span className="text-[10px] font-bold text-slate-500 w-12 shrink-0 mt-0.5">{label}</span>
      <span className="text-slate-700 break-words">{value}</span>
    </div>
  );
}
