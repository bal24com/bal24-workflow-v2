// bal24 v2 — 외부공유 항목 · 커리큘럼 (program_curriculum read-only)

import { useEffect, useState } from 'react';
import { BookOpen, Loader2, Clock, MapPin } from 'lucide-react';
import { formatDateKo } from '../../../lib/utils';
import { fetchPublicCurriculum } from '../sharePortalUtils';
import { trimTime } from '../../programs/detail/curriculum/curriculumTabUtils';
import type { ProgramCurriculum } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

export default function CurriculumItem({ programId }: Props) {
  const [items, setItems] = useState<ProgramCurriculum[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const next = await fetchPublicCurriculum(programId);
      if (cancelled) return;
      setItems(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  return (
    <ItemCard
      icon={<BookOpen size={18} aria-hidden="true" />}
      title="커리큘럼"
      hint={`${items.length}차시 — 차시별 일정·내용`}
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-2">아직 커리큘럼이 등록되지 않았어요.</p>
      ) : (
        <ol className="flex flex-col gap-2">
          {items.map((c) => (
            <li
              key={c.id}
              className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5 flex flex-col gap-1.5"
            >
              <div className="flex items-center gap-2 flex-wrap">
                <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-md bg-violet-100 text-violet-700 text-[11px] font-bold tabular-nums">
                  {c.session_no}차시
                </span>
                <span className="flex-1 min-w-0 text-sm font-bold text-[#1E1B4B]">{c.title}</span>
              </div>
              <div className="flex items-center gap-3 flex-wrap text-[11px] text-slate-500">
                {c.session_date && <span>{formatDateKo(c.session_date)}</span>}
                {(c.start_time || c.end_time) && (
                  <span className="inline-flex items-center gap-0.5 tabular-nums">
                    <Clock size={11} aria-hidden="true" />
                    {trimTime(c.start_time)}
                    {c.end_time && `~${trimTime(c.end_time)}`}
                  </span>
                )}
                {c.venue && (
                  <span className="inline-flex items-center gap-0.5">
                    <MapPin size={11} aria-hidden="true" />
                    {c.venue}
                  </span>
                )}
              </div>
              {c.content && (
                <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">
                  {c.content}
                </p>
              )}
            </li>
          ))}
        </ol>
      )}
    </ItemCard>
  );
}
