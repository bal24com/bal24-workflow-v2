// bal24 v2 — 외부공유 항목 · 출석체크 (학생, 진행 단계)
// attendance_sessions 활성 세션 → /attend/:session_token 점프.

import { useEffect, useState } from 'react';
import { ClipboardCheck, ExternalLink, Loader2, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import type { AttendanceSession } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

type Row = Pick<
  AttendanceSession,
  'id' | 'title' | 'session_date' | 'start_time' | 'end_time' | 'session_token' | 'check_in_open'
>;

function trimTime(t?: string | null): string {
  return t ? t.slice(0, 5) : '';
}

export default function CheckinItem({ programId }: Props) {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('id, title, session_date, start_time, end_time, session_token, check_in_open')
        .eq('program_id', programId)
        .order('session_date', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[share-portal/student] 출석 세션 조회 실패:', error.message);
      } else {
        setList((data as Row[] | null) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  return (
    <ItemCard
      icon={<ClipboardCheck size={18} aria-hidden="true" />}
      title="출석체크"
      hint="진행 중인 세션을 클릭하면 출석 페이지로 이동해요"
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-2">
          아직 등록된 출석 세션이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((s) => (
            <li key={s.id}>
              <a
                href={`/attend/${s.session_token}`}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                  s.check_in_open
                    ? 'border-emerald-200 bg-emerald-50/40 hover:bg-emerald-50'
                    : 'border-slate-200 bg-slate-50/60 cursor-not-allowed pointer-events-none opacity-60'
                }`}
                aria-disabled={!s.check_in_open}
              >
                <span
                  className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${
                    s.check_in_open ? 'bg-emerald-500 text-white' : 'bg-slate-200 text-slate-500'
                  }`}
                >
                  {s.check_in_open ? '진행중' : '마감'}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1E1B4B] truncate">{s.title}</p>
                  <p className="mt-0.5 text-[11px] text-slate-500 tabular-nums inline-flex items-center gap-1">
                    {formatDateKo(s.session_date)}
                    {(s.start_time || s.end_time) && (
                      <span className="inline-flex items-center gap-0.5">
                        <Clock size={10} aria-hidden="true" />
                        {trimTime(s.start_time)}
                        {s.end_time && `~${trimTime(s.end_time)}`}
                      </span>
                    )}
                  </p>
                </div>
                {s.check_in_open && (
                  <ExternalLink size={13} className="shrink-0 text-emerald-500" aria-hidden="true" />
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </ItemCard>
  );
}
