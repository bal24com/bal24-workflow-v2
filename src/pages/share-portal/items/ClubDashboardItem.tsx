// 박경수님 2026-06-02 CLUB-10 — 외부 토큰 페이지 동아리 전체 진행률 대시보드.
// 지원기관·수혜기관이 자기 토큰으로 8개 팀 진행 현황을 한눈에.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, LayoutGrid, School, Users, CheckCircle2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ProgramClub, ProgramClubSession } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

interface ClubAgg extends ProgramClub {
  activity_count: number;
  total_sessions: number;
  done_sessions: number;
}

export default function ClubDashboardItem({ programId }: Props) {
  const [clubs, setClubs] = useState<ClubAgg[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const cRes = await supabase.from('program_clubs').select('*').eq('program_id', programId).order('school_name');
    if (cRes.error) { console.error('[ClubDashboardItem] 동아리 조회:', cRes.error.message); setClubs([]); setLoading(false); return; }
    const list = (cRes.data ?? []) as ProgramClub[];
    if (list.length === 0) { setClubs([]); setLoading(false); return; }

    const ids = list.map((c) => c.id);
    const [aRes, sRes] = await Promise.all([
      supabase.from('activity_logs').select('club_id').in('club_id', ids).is('deleted_at', null),
      supabase.from('program_club_sessions').select('club_id, status').in('club_id', ids),
    ]);
    const actCount = new Map<string, number>();
    (aRes.data ?? []).forEach((r) => {
      const id = (r as { club_id: string | null }).club_id;
      if (id) actCount.set(id, (actCount.get(id) ?? 0) + 1);
    });
    const sessTotal = new Map<string, number>();
    const sessDone = new Map<string, number>();
    ((sRes.data ?? []) as Pick<ProgramClubSession, 'club_id' | 'status'>[]).forEach((s) => {
      sessTotal.set(s.club_id, (sessTotal.get(s.club_id) ?? 0) + 1);
      if (s.status === 'done') sessDone.set(s.club_id, (sessDone.get(s.club_id) ?? 0) + 1);
    });
    setClubs(list.map((c) => ({
      ...c,
      activity_count: actCount.get(c.id) ?? 0,
      total_sessions: sessTotal.get(c.id) ?? 0,
      done_sessions: sessDone.get(c.id) ?? 0,
    })));
    setLoading(false);
  }, [programId]);

  useEffect(() => { void reload(); }, [reload]);

  const stats = useMemo(() => {
    const schools = new Set(clubs.map((c) => c.school_name));
    const students = clubs.reduce((s, c) => s + (c.student_count ?? 0), 0);
    const totalSess = clubs.reduce((s, c) => s + c.total_sessions, 0);
    const doneSess = clubs.reduce((s, c) => s + c.done_sessions, 0);
    const totalAct = clubs.reduce((s, c) => s + c.activity_count, 0);
    return { schools: schools.size, students, totalSess, doneSess, totalAct };
  }, [clubs]);

  if (loading) {
    return (
      <ItemCard icon={<LayoutGrid size={18} />} title="동아리 전체 진행률">
        <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" /></div>
      </ItemCard>
    );
  }
  if (clubs.length === 0) return null;

  return (
    <ItemCard icon={<LayoutGrid size={18} className="text-violet-600" />} title="동아리 전체 진행률">
      <div className="space-y-3">
        {/* 요약 통계 */}
        <div className="grid grid-cols-3 gap-2">
          <Stat label="학교" value={`${stats.schools}`} sub={`${clubs.length}개 동아리`} />
          <Stat label="학생" value={`${stats.students}`} sub="명" />
          <Stat label="차수 진행" value={`${stats.doneSess}/${stats.totalSess}`} sub={`활동 ${stats.totalAct}건`} />
        </div>

        {/* 동아리별 진행 행 */}
        <ul className="space-y-1.5">
          {clubs.map((c) => {
            const pct = c.total_sessions > 0 ? Math.round((c.done_sessions / c.total_sessions) * 100) : 0;
            return (
              <li key={c.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#1E1B4B]">{c.club_name}</span>
                  <span className="text-[11px] text-slate-500 inline-flex items-center gap-0.5"><School size={10} aria-hidden="true" />{c.school_name}</span>
                  {c.student_count != null && <span className="text-[11px] text-slate-500 inline-flex items-center gap-0.5"><Users size={10} aria-hidden="true" />{c.student_count}</span>}
                  <span className="text-[11px] text-slate-500 ml-auto">활동 <strong className="text-violet-700">{c.activity_count}</strong></span>
                </div>
                {/* 차수 진행 바 */}
                <div className="flex items-center gap-2 mt-1.5">
                  <div className="flex-1 h-2 rounded-full bg-slate-200 overflow-hidden">
                    <div className="h-full bg-violet-500 rounded-full" style={{ width: `${pct}%` }} aria-hidden="true" />
                  </div>
                  <span className="text-[10px] font-bold text-slate-600 tabular-nums shrink-0 inline-flex items-center gap-0.5">
                    {c.done_sessions === c.total_sessions && c.total_sessions > 0 && <CheckCircle2 size={10} className="text-emerald-600" aria-hidden="true" />}
                    {c.done_sessions}/{c.total_sessions}차
                  </span>
                </div>
              </li>
            );
          })}
        </ul>
      </div>
    </ItemCard>
  );
}

function Stat({ label, value, sub }: { label: string; value: string; sub: string }) {
  return (
    <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-2.5 text-center">
      <p className="text-[10px] font-bold text-violet-600">{label}</p>
      <p className="text-lg font-bold text-[#1E1B4B] tabular-nums leading-tight">{value}</p>
      <p className="text-[10px] text-slate-500">{sub}</p>
    </div>
  );
}
