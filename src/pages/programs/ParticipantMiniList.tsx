// bal24 v2 — STEP-OVERVIEW-UI-FULL
// 프로그램 목록에서 펼친 교육생 명단 미니 테이블 (최대 50명, 초과 시 "외 N명").

import { useEffect, useState } from 'react';
import { Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';

interface ParticipantLite {
  id: string;
  name: string;
  organization: string | null;
  phone: string | null;
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
        .select('id, name, organization, phone', { count: 'exact' })
        .eq('program_id', programId)
        .in('status', ['active', 'completed'])
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
    <div className="border-t border-slate-100 px-4 py-3 overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="text-[10px] text-slate-400 uppercase">
          <tr>
            <th className="text-center px-2 py-1 font-bold w-8">#</th>
            <th className="text-left px-2 py-1 font-bold">이름</th>
            <th className="text-left px-2 py-1 font-bold">소속</th>
            <th className="text-left px-2 py-1 font-bold">연락처</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {list.map((p, idx) => (
            <tr key={p.id}>
              <td className="text-center px-2 py-1 text-slate-400 tabular-nums">{idx + 1}</td>
              <td className="px-2 py-1 font-semibold text-slate-700">{p.name}</td>
              <td className="px-2 py-1 text-slate-500">{p.organization ?? '—'}</td>
              <td className="px-2 py-1 text-slate-500 tabular-nums">{p.phone ?? '—'}</td>
            </tr>
          ))}
        </tbody>
      </table>
      {total > MAX_VISIBLE && (
        <p className="mt-2 text-[11px] text-slate-400 italic text-center">외 {total - MAX_VISIBLE}명 (상세에서 전체 보기)</p>
      )}
    </div>
  );
}
