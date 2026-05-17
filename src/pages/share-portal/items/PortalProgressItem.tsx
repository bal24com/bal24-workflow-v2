// bal24 v2 — 외부공유 항목 · 고객 포털 (진행현황)
// STEP-PORTAL-PROGRESS-FIX — 진행 단계의 client 노출 항목. 진행률·다음 차시·일지 수.

import { useEffect, useState } from 'react';
import { Activity, Loader2, Calendar, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import { fetchPublicCurriculum } from '../sharePortalUtils';
import { trimTime } from '../../programs/detail/curriculum/curriculumTabUtils';
import type { ProgramCurriculum } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function PortalProgressItem({ programId }: Props) {
  const [curriculum, setCurriculum] = useState<ProgramCurriculum[]>([]);
  const [logCount, setLogCount] = useState<number>(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const cur = await fetchPublicCurriculum(programId);
      // 일지 수 (테이블이 아직 없는 경우 PGRST205 무시)
      let cnt = 0;
      const { count, error } = await supabase
        .from('activity_logs')
        .select('id', { count: 'exact', head: true })
        .eq('program_id', programId);
      if (error) {
        const m = (error.message ?? '').toLowerCase();
        if (!m.includes('does not exist') && !m.includes('pgrst205')) {
          console.warn('[portal-progress] 일지 카운트 경고:', error.message);
        }
      } else {
        cnt = count ?? 0;
      }
      if (cancelled) return;
      setCurriculum(cur);
      setLogCount(cnt);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  const today = todayIso();
  const totalSessions = curriculum.length;
  const passedSessions = curriculum.filter((c) => c.session_date && c.session_date < today).length;
  const todaySessions = curriculum.filter((c) => c.session_date === today);
  const upcomingSessions = curriculum
    .filter((c) => c.session_date && c.session_date > today)
    .slice(0, 3);
  const progressPct = totalSessions > 0 ? Math.round((passedSessions / totalSessions) * 100) : 0;

  return (
    <ItemCard
      icon={<Activity size={18} aria-hidden="true" />}
      title="진행현황"
      hint="교육 진행률과 앞으로의 일정"
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : (
        <div className="flex flex-col gap-4">
          {/* 진행률 요약 */}
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 flex flex-col gap-2">
            <div className="flex items-end justify-between gap-2">
              <div>
                <p className="text-[11px] font-bold text-slate-500">진행률</p>
                <p className="text-2xl font-bold text-violet-700 tabular-nums leading-none mt-0.5">
                  {passedSessions}<span className="text-sm text-slate-400">/{totalSessions}차시</span>
                </p>
              </div>
              <span className="text-base font-bold text-violet-600 tabular-nums">{progressPct}%</span>
            </div>
            <div className="h-2 rounded-full bg-violet-100 overflow-hidden">
              <div
                className="h-full bg-gradient-to-r from-violet-500 to-violet-600 transition-all"
                style={{ width: `${progressPct}%` }}
                aria-hidden="true"
              />
            </div>
          </div>

          {/* 오늘 진행 차시 */}
          {todaySessions.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-orange-600 mb-1.5">● 오늘 진행</p>
              <ul className="flex flex-col gap-1.5">
                {todaySessions.map((c) => (
                  <li key={c.id} className="rounded-lg border border-orange-100 bg-orange-50/40 px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] h-5 px-1.5 rounded bg-orange-100 text-orange-700 text-[10px] font-bold tabular-nums">
                        {c.session_no}차시
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-bold text-[#1E1B4B]">{c.title}</span>
                      {(c.start_time || c.end_time) && (
                        <span className="text-[11px] text-slate-500 tabular-nums">
                          {trimTime(c.start_time)}{c.end_time && `~${trimTime(c.end_time)}`}
                        </span>
                      )}
                    </div>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 다음 차시 (최대 3개) */}
          {upcomingSessions.length > 0 && (
            <div>
              <p className="text-[11px] font-bold text-slate-500 mb-1.5 flex items-center gap-1">
                <Calendar size={11} aria-hidden="true" /> 다음 일정
              </p>
              <ul className="flex flex-col gap-1.5">
                {upcomingSessions.map((c) => (
                  <li key={c.id} className="rounded-lg border border-violet-100 bg-violet-50/30 px-3 py-2">
                    <div className="flex items-center gap-2 flex-wrap">
                      <span className="inline-flex items-center justify-center min-w-[2.5rem] h-5 px-1.5 rounded bg-violet-100 text-violet-700 text-[10px] font-bold tabular-nums">
                        {c.session_no}차시
                      </span>
                      <span className="flex-1 min-w-0 text-sm font-semibold text-[#1E1B4B]">{c.title}</span>
                    </div>
                    <p className="mt-1 text-[11px] text-slate-500 tabular-nums">
                      {formatDateKo(c.session_date)}
                      {c.start_time && ` · ${trimTime(c.start_time)}`}
                      {c.end_time && `~${trimTime(c.end_time)}`}
                      {c.venue && ` · ${c.venue}`}
                    </p>
                  </li>
                ))}
              </ul>
            </div>
          )}

          {/* 활동 일지 수 */}
          {logCount > 0 && (
            <div className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/40 px-3 py-2.5">
              <FileText size={14} className="text-cyan-600" aria-hidden="true" />
              <p className="text-xs text-slate-700">
                작성된 활동 일지 <span className="font-bold text-cyan-700 tabular-nums">{logCount}건</span>
              </p>
            </div>
          )}

          {totalSessions === 0 && (
            <p className="text-sm text-slate-400 italic text-center py-2">
              아직 차시가 등록되지 않았어요.
            </p>
          )}
        </div>
      )}
    </ItemCard>
  );
}
