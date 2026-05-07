// bal24 v2 — 외부공유 항목 · 기본정보 (장소·날짜·준비물)

import { Info, MapPin, Calendar, Megaphone } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';
import type { Program } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  program: Program;
}

export default function BasicInfoItem({ program }: Props) {
  return (
    <ItemCard icon={<Info size={18} aria-hidden="true" />} title="기본정보" hint="장소·일정·준비물">
      <ul className="flex flex-col gap-2.5">
        {(program.start_date || program.end_date) && (
          <li className="flex items-start gap-2">
            <Calendar size={14} className="shrink-0 mt-0.5 text-violet-500" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-bold text-slate-500">일정</p>
              <p className="text-sm text-[#1E1B4B]">
                {formatDateKo(program.start_date) || '미정'} ~ {formatDateKo(program.end_date) || '미정'}
              </p>
            </div>
          </li>
        )}
        {program.venue && (
          <li className="flex items-start gap-2">
            <MapPin size={14} className="shrink-0 mt-0.5 text-violet-500" aria-hidden="true" />
            <div>
              <p className="text-[11px] font-bold text-slate-500">장소</p>
              <p className="text-sm text-[#1E1B4B]">{program.venue}</p>
            </div>
          </li>
        )}
        {program.notice && (
          <li className="flex items-start gap-2">
            <Megaphone size={14} className="shrink-0 mt-0.5 text-orange-500" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-slate-500">공지·준비물</p>
              <p className="text-sm text-[#1E1B4B] whitespace-pre-wrap leading-relaxed">{program.notice}</p>
            </div>
          </li>
        )}
        {!program.start_date && !program.end_date && !program.venue && !program.notice && (
          <li className="text-sm text-slate-400 italic text-center py-2">
            기본정보가 아직 등록되지 않았어요.
          </li>
        )}
      </ul>
    </ItemCard>
  );
}
