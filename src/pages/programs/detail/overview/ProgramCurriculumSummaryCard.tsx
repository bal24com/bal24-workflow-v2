// bal24 v2 — 커리큘럼 요약 카드 (차시 목록 최대 5개 + 더보기)

import { useEffect, useState } from 'react';
import { Loader2, ClipboardList } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import type { ProgramCurriculum } from '../../../../types/database';

interface Props {
  programId: string;
}

type CurriculumSummary = Pick<ProgramCurriculum, 'id' | 'session_no' | 'title' | 'day_label' | 'start_time' | 'end_time'>;

export default function ProgramCurriculumSummaryCard({ programId }: Props) {
  const [sessions, setSessions] = useState<CurriculumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('program_curriculum')
        .select('id, session_no, title, day_label, start_time, end_time')
        .eq('program_id', programId)
        .order('session_no');
      if (cancelled) return;
      if (error) console.error('[overview-curriculum] 조회 실패:', error.message);
      setSessions((data ?? []) as CurriculumSummary[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  const displayed = showAll ? sessions : sessions.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <ClipboardList size={14} className="text-violet-500" aria-hidden="true" />
          커리큘럼
          <span className="text-xs font-normal text-slate-500 ml-1">({sessions.length}차시)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : sessions.length === 0 ? (
          <p className="text-sm text-slate-400 italic">등록된 커리큘럼이 없어요.</p>
        ) : (
          <div className="divide-y divide-slate-100 -mx-2">
            {displayed.map((s) => (
              <div key={s.id} className="grid grid-cols-[60px_minmax(80px,100px)_1fr] items-center gap-2 px-2 py-1.5 text-xs">
                <span className="text-slate-400 font-bold tabular-nums">
                  {s.day_label ?? `${s.session_no}차시`}
                </span>
                <span className="text-slate-500 tabular-nums">
                  {s.start_time && s.end_time ? `${s.start_time.slice(0, 5)}~${s.end_time.slice(0, 5)}` : '—'}
                </span>
                <span className="font-medium text-slate-700 truncate">{s.title}</span>
              </div>
            ))}
            {sessions.length > 5 && (
              <button type="button" onClick={() => setShowAll((v) => !v)}
                className="w-full text-xs text-violet-600 hover:bg-violet-50 py-2 mt-1 transition-colors">
                {showAll ? '접기' : `+${sessions.length - 5}개 더보기`}
              </button>
            )}
          </div>
        )}
      </CardContent>
    </Card>
  );
}
