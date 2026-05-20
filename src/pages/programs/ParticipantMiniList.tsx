// bal24 v2 — STEP-OVERVIEW-UI-FULL / STEP-PARTICIPANTS-LIST-UPDATE
// 프로그램 목록 펼친 교육생 명단 — 이름·연락처·상태 (최대 50명, 초과 시 "외 N명").

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import {
  BADGE_BASE, PARTICIPANT_STATUS_LABEL, PARTICIPANT_STATUS_STYLE,
} from '../../utils/statusStyles';
import type { ParticipantStatus } from '../../types/database';

interface ParticipantLite {
  id: string;
  name: string;
  phone: string | null;
  status: ParticipantStatus;
}

interface Props { programId: string }

const MAX_VISIBLE = 50;

export default function ParticipantMiniList({ programId }: Props) {
  const [list, setList] = useState<ParticipantLite[]>([]);
  const [total, setTotal] = useState(0);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, count, error } = await supabase
        .from('program_participants')
        .select('id, name, phone, status', { count: 'exact' })
        .eq('program_id', programId)
        .order('display_order', { ascending: true, nullsFirst: false })
        .order('created_at', { ascending: true })
        .limit(MAX_VISIBLE);
      if (cancelled) return;
      if (error) {
        console.warn('[participant-mini] 조회 실패:', error.message);
        setList([]); setTotal(0); setLoading(false); return;
      }
      setList((data as ParticipantLite[] | null) ?? []);
      setTotal(count ?? 0);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin mr-1.5" /> 불러오는 중…
      </div>
    );
  }

  if (list.length === 0) {
    return <p className="text-xs text-slate-400 italic text-center py-3">등록된 교육생이 없어요.</p>;
  }

  return (
    <div className="border-t border-slate-100 px-4 py-3">
      <ul className="divide-y divide-slate-100">
        {list.map((p) => {
          const status: ParticipantStatus = p.status ?? 'pending';
          return (
            <li key={p.id} className="flex items-center gap-2 py-2 last:pb-0 first:pt-0">
              <span className="text-sm font-medium text-[#1E1B4B] w-20 truncate shrink-0">
                {p.name}
              </span>
              <span className="text-sm text-slate-500 flex-1 px-2 tabular-nums truncate">
                {p.phone || '—'}
              </span>
              <span className={`${BADGE_BASE} ${PARTICIPANT_STATUS_STYLE[status]} shrink-0`}>
                {PARTICIPANT_STATUS_LABEL[status] ?? status}
              </span>
            </li>
          );
        })}
      </ul>
      {total > MAX_VISIBLE && (
        <p className="mt-2 text-[11px] text-slate-400 italic text-center">
          외 {total - MAX_VISIBLE}명 (상세에서 전체 보기)
        </p>
      )}
    </div>
  );
}
