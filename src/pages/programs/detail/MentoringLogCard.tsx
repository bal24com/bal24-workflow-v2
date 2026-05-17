// bal24 v2 — STEP-MENTOR-PORTAL-FULL
// 멘토링 배정 카드 펼친 영역 — 담당 멘티 목록 + 최근 일지 3건

import { useEffect, useState } from 'react';
import { Loader2, Users2, BookOpen } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import type { MentoringLog } from '../../../types/mentoring';

interface MenteeLite { id: string; name: string; organization: string | null }

interface Props {
  assignmentId: string;
  menteeIds: string[];
}

export default function MentoringLogCard({ assignmentId, menteeIds }: Props) {
  const [mentees, setMentees] = useState<MenteeLite[]>([]);
  const [logs, setLogs] = useState<MentoringLog[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      // STEP-MENTOR-PORTAL-FULL — 멘티 + 최근 일지 3건 lazy fetch (병렬)
      const mRes = menteeIds.length > 0
        ? await supabase.from('program_participants').select('id, name, organization').in('id', menteeIds)
        : { data: [] as MenteeLite[], error: null };
      const lRes = await supabase.from('mentoring_logs').select('*')
        .eq('assignment_id', assignmentId).order('log_date', { ascending: false }).limit(3);
      if (cancelled) return;
      if (mRes.error) console.warn('[mentoring-log-card] 멘티 조회 경고:', mRes.error.message);
      else setMentees((mRes.data ?? []) as MenteeLite[]);
      if (lRes.error) {
        const m = (lRes.error.message ?? '').toLowerCase();
        if (!m.includes('does not exist') && !m.includes('pgrst205')) {
          console.warn('[mentoring-log-card] 일지 조회 경고:', lRes.error.message);
        }
        setLogs([]);
      } else {
        setLogs((lRes.data ?? []) as MentoringLog[]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [assignmentId, menteeIds]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin mr-1.5" /> 불러오는 중…
      </div>
    );
  }

  return (
    <div className="border-t border-violet-100/70 pt-2 mt-2 space-y-3">
      {/* 담당 멘티 목록 */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
          <Users2 size={10} aria-hidden="true" /> 담당 멘티 ({mentees.length}명)
        </p>
        {mentees.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">배정된 멘티가 없어요.</p>
        ) : (
          <ul className="space-y-0.5">
            {mentees.map((m) => (
              <li key={m.id} className="text-[11px] text-slate-700">
                · {m.name}{m.organization ? <span className="text-slate-400"> ({m.organization})</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 최근 멘토링 일지 3건 */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
          <BookOpen size={10} aria-hidden="true" /> 최근 멘토링 일지 ({logs.length}건)
        </p>
        {logs.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">아직 작성된 일지가 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {logs.map((log) => (
              <li key={log.id} className="rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 text-[10px]">
                  <span className="font-bold text-slate-700 tabular-nums">{formatDateKo(log.log_date)}</span>
                  <span className="px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">{log.session_no ?? 1}회차</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-700 line-clamp-2">{log.content}</p>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
