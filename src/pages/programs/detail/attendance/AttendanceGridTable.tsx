// bal24 v2 — STEP-PROGRAM-ENHANCE-FULL 출석 현황 그리드
// 행 = 교육생, 열 = day_label. ✅/❌ 표시 + 출석률

import { useEffect, useState } from 'react';
import { Loader2, Check, X } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import type { ProgramParticipant, ProgramAttendanceRecord } from '../../../../types/database';

interface Props {
  programId: string;
  /** 외부 새로고침 트리거 */
  refreshKey?: number;
}

export default function AttendanceGridTable({ programId, refreshKey }: Props) {
  const toast = useToast();
  const [participants, setParticipants] = useState<ProgramParticipant[]>([]);
  const [records, setRecords] = useState<ProgramAttendanceRecord[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const [pRes, rRes] = await Promise.all([
        supabase.from('program_participants').select('*').eq('program_id', programId).order('name'),
        supabase.from('program_attendance_records').select('*').eq('program_id', programId),
      ]);
      if (cancelled) return;
      if (pRes.error) console.error('[attend-grid] 교육생 조회 실패:', pRes.error.message);
      if (rRes.error) { console.error('[attend-grid] 출석 조회 실패:', rRes.error.message); toast.error('출석 데이터를 불러오지 못했어요.'); }
      setParticipants((pRes.data ?? []) as ProgramParticipant[]);
      setRecords((rRes.data ?? []) as ProgramAttendanceRecord[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, refreshKey, toast]);

  if (loading) return <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-violet-400" /></div>;
  if (participants.length === 0) return <p className="text-xs text-slate-400 italic text-center py-4">등록된 교육생이 없어요.</p>;

  // day_label 정렬 (1일차 < 2일차 < ... 순서)
  const days = Array.from(new Set(records.map((r) => r.day_label ?? '').filter(Boolean)))
    .sort((a, b) => {
      const na = Number((a.match(/\d+/) ?? ['0'])[0]);
      const nb = Number((b.match(/\d+/) ?? ['0'])[0]);
      return na - nb;
    });

  if (days.length === 0) return <p className="text-xs text-slate-400 italic text-center py-4">출석 기록이 없어요. 위에서 AI 처리하거나 직접 입력해 주세요.</p>;

  const grid = new Map<string, Map<string, boolean>>();
  for (const r of records) {
    if (!r.participant_id || !r.day_label) continue;
    const m = grid.get(r.participant_id) ?? new Map<string, boolean>();
    m.set(r.day_label, r.is_present);
    grid.set(r.participant_id, m);
  }

  return (
    <div className="rounded-2xl border border-violet-100 bg-white overflow-x-auto">
      <table className="w-full text-xs">
        <thead className="bg-violet-50/40 text-[10px] uppercase tracking-wide text-slate-500">
          <tr>
            <th className="px-2 py-2 text-left font-bold sticky left-0 bg-violet-50/40">이름</th>
            <th className="px-2 py-2 text-left font-bold">소속</th>
            {days.map((d) => (<th key={d} className="px-2 py-2 text-center font-bold">{d}</th>))}
            <th className="px-2 py-2 text-center font-bold bg-violet-100/60">출석률</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-100">
          {participants.map((p) => {
            const m = grid.get(p.id);
            const presentCnt = days.filter((d) => m?.get(d) === true).length;
            const pct = days.length > 0 ? Math.round((presentCnt / days.length) * 100) : 0;
            return (
              <tr key={p.id} className="hover:bg-violet-50/20">
                <td className="px-2 py-1.5 font-bold text-slate-700 sticky left-0 bg-white">{p.name}</td>
                <td className="px-2 py-1.5 text-slate-500">{p.organization ?? '—'}</td>
                {days.map((d) => {
                  const v = m?.get(d);
                  return (
                    <td key={d} className="px-2 py-1.5 text-center">
                      {v === true ? <Check size={14} className="inline text-emerald-600" />
                        : v === false ? <X size={14} className="inline text-rose-400" />
                          : <span className="text-slate-300">—</span>}
                    </td>
                  );
                })}
                <td className="px-2 py-1.5 text-center font-bold tabular-nums bg-violet-50/40">
                  <span className={pct >= 80 ? 'text-emerald-600' : pct >= 50 ? 'text-orange-600' : 'text-rose-600'}>
                    {pct}%
                  </span>
                </td>
              </tr>
            );
          })}
        </tbody>
      </table>
    </div>
  );
}
