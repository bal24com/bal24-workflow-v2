// bal24 v2 — 강사 배정 현황 카드 (instructor_invitations 요약)

import { useEffect, useState } from 'react';
import { Mic2, Loader2 } from 'lucide-react';
import { Card, CardContent, CardHeader, CardTitle } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import type { InvitationStatus } from '../../../../types/database';

interface Props {
  programId: string;
}

interface InvitationRow {
  id: string;
  name: string;
  status: InvitationStatus;
  session_info: string | null;
}

const STATUS_CLASS: Record<InvitationStatus, string> = {
  '대기': 'bg-amber-100 text-amber-700',
  '수락': 'bg-emerald-100 text-emerald-700',
  '거절': 'bg-red-100 text-red-600',
  '완료': 'bg-blue-100 text-blue-700',
};

const STATUS_LABEL: Record<InvitationStatus, string> = {
  '대기': '발송 대기', '수락': '수락', '거절': '거절', '완료': '완료',
};

export default function ProgramInstructorSummaryCard({ programId }: Props) {
  const [list, setList] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('instructor_invitations')
        .select('id, name, status, session_info')
        .eq('program_id', programId)
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[overview-instructor] 조회 실패:', error.message);
      setList((data ?? []) as InvitationRow[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  return (
    <Card>
      <CardHeader>
        <CardTitle className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Mic2 size={14} className="text-violet-500" aria-hidden="true" />
          강사 배정 현황
          <span className="text-xs font-normal text-slate-500 ml-1">({list.length}명)</span>
        </CardTitle>
      </CardHeader>
      <CardContent>
        {loading ? (
          <div className="flex items-center justify-center py-4">
            <Loader2 size={14} className="animate-spin text-violet-400" aria-hidden="true" />
          </div>
        ) : list.length === 0 ? (
          <p className="text-sm text-slate-400 italic">배정된 강사가 없어요.</p>
        ) : (
          <ul className="divide-y divide-slate-100 -mx-2">
            {list.map((inv) => (
              <li key={inv.id} className="flex items-center justify-between gap-2 px-2 py-1.5 text-sm">
                <div className="min-w-0 flex-1">
                  <span className="font-semibold text-slate-700">{inv.name}</span>
                  {inv.session_info && (
                    <span className="ml-2 text-[11px] text-slate-400">{inv.session_info}</span>
                  )}
                </div>
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${STATUS_CLASS[inv.status]}`}>
                  {STATUS_LABEL[inv.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </CardContent>
    </Card>
  );
}
