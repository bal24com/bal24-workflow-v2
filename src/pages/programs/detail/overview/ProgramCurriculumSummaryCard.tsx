// bal24 v2 — 커리큘럼 요약 카드 (차시 목록 5개 + 더보기 + AI 드롭존 토글)

import { useCallback, useEffect, useState } from 'react';
import { Loader2, ClipboardList, Sparkles, ChevronDown, ChevronUp } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import CurriculumAiDropZone from '../curriculum/CurriculumAiDropZone';
import type { ProgramCurriculum } from '../../../../types/database';

interface Props {
  programId: string;
}

type CurriculumSummary = Pick<ProgramCurriculum, 'id' | 'session_no' | 'title' | 'day_label' | 'start_time' | 'end_time'>;

export default function ProgramCurriculumSummaryCard({ programId }: Props) {
  const [sessions, setSessions] = useState<CurriculumSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [showAll, setShowAll] = useState(false);
  const [aiOpen, setAiOpen] = useState(false);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('program_curriculum')
      .select('id, session_no, title, day_label, start_time, end_time')
      .eq('program_id', programId)
      .order('session_no');
    if (error) console.error('[overview-curriculum] 조회 실패:', error.message);
    setSessions((data ?? []) as CurriculumSummary[]);
  }, [programId]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await reload();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [reload, programId]);

  // 차시가 비어있으면 AI 드롭존 자동 펼침
  useEffect(() => {
    if (!loading && sessions.length === 0) setAiOpen(true);
  }, [loading, sessions.length]);

  const displayed = showAll ? sessions : sessions.slice(0, 5);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold text-[#1E1B4B] flex items-center justify-between gap-2">
          <span className="flex items-center gap-1.5">
            <ClipboardList size={14} className="text-violet-500" aria-hidden="true" />
            커리큘럼
            <span className="text-xs font-normal text-slate-500 ml-1">({sessions.length}차시)</span>
          </span>
          <button type="button" onClick={() => setAiOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-semibold rounded-md text-violet-700 hover:bg-violet-50">
            <Sparkles size={11} aria-hidden="true" />
            AI 추출
            {aiOpen ? <ChevronUp size={11} aria-hidden="true" /> : <ChevronDown size={11} aria-hidden="true" />}
          </button>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {aiOpen && (
          <CurriculumAiDropZone programId={programId} lastSessionNo={sessions.length}
            onSessionsInserted={() => { void reload(); setAiOpen(false); }} />
        )}

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
