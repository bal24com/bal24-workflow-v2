// bal24 v2 — 프로그램 교육 개요 카드 (기간·장소·주관·대상·정원·카테고리)

import type { ReactNode } from 'react';
import { Calendar, MapPin, Building2, Users, Tag } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui';
import { formatDateKo } from '../../../../lib/utils';
import { PROGRAM_TYPE_LABELS } from '../../../../constants/programTypes';
import type { Program } from '../../../../types/database';

interface Props {
  program: Program;
}

export default function ProgramOverviewCard({ program }: Props) {
  const typeLabel = program.program_type ? PROGRAM_TYPE_LABELS[program.program_type] ?? program.program_type : null;
  const target = program.target_audience
    ? `${program.target_audience}${program.max_participants ? ` (${program.max_participants}명)` : ''}`
    : null;
  const orgLine = [program.client_org, program.department].filter(Boolean).join(' · ');

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Calendar size={14} className="text-violet-500" aria-hidden="true" />
          교육 개요
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-2">
        <InfoRow icon={<Calendar size={12} aria-hidden="true" />} label="시작" value={formatDateKo(program.start_date) || '미정'} />
        <InfoRow icon={<Calendar size={12} aria-hidden="true" />} label="종료" value={formatDateKo(program.end_date) || '미정'} />
        {program.venue && (
          <InfoRow icon={<MapPin size={12} aria-hidden="true" />} label="장소" value={program.venue} />
        )}
        {orgLine && (
          <InfoRow icon={<Building2 size={12} aria-hidden="true" />} label="주관" value={orgLine} />
        )}
        {target && (
          <InfoRow icon={<Users size={12} aria-hidden="true" />} label="대상" value={target} />
        )}
        {typeLabel && (
          <InfoRow icon={<Tag size={12} aria-hidden="true" />} label="카테고리" value={typeLabel} />
        )}
      </CardContent>
    </Card>
  );
}

function InfoRow({ icon, label, value }: { icon: ReactNode; label: string; value: string }) {
  return (
    <div className="flex items-center gap-2 text-sm">
      <span className="inline-flex items-center justify-center w-5 h-5 text-slate-400 shrink-0">{icon}</span>
      <span className="text-xs font-bold text-slate-500 w-12 shrink-0">{label}</span>
      <span className="text-slate-700 truncate">{value}</span>
    </div>
  );
}
