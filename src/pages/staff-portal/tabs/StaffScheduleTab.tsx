// bal24 v2 — STEP-STAFF-PORTAL-P4
// 강사 포털 · 일정 탭 — 차시 일정 월별 그룹핑 (지나간 일정은 접힘).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Calendar, ChevronDown, ChevronUp, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { StaffPortalIdentity } from '../staffPortalUtils';

interface Props { staff: StaffPortalIdentity }

interface ScheduleRow {
  id: string;
  title: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  session_no: number;
  program_id: string;
  program_name: string | null;
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

function trimTime(t: string | null): string { return t ? t.slice(0, 5) : ''; }
function monthKey(d: string): string { return d.slice(0, 7); }   // YYYY-MM
function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
function weekdayOf(d: string): string {
  return WEEKDAY[new Date(d).getDay()] ?? '';
}

export default function StaffScheduleTab({ staff }: Props) {
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const staffCol = staff.sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';
    const { data: cs } = await supabase.from('curriculum_staff')
      .select('curriculum_id').eq(staffCol, staff.id);
    const ids = ((cs ?? []) as Array<{ curriculum_id: string }>).map((r) => r.curriculum_id);
    if (ids.length === 0) { setRows([]); setLoading(false); return; }

    const { data: pc, error: pcErr } = await supabase.from('program_curriculum')
      .select('id, title, session_date, start_time, end_time, session_no, program_id')
      .in('id', ids).not('session_date', 'is', null).order('session_date', { ascending: true });
    if (pcErr) { console.warn('[staff-portal/schedule] 조회 경고:', pcErr.message); setLoading(false); return; }

    const list = ((pc ?? []) as Array<Omit<ScheduleRow, 'program_name'>>);
    const progIds = Array.from(new Set(list.map((r) => r.program_id).filter(Boolean)));
    let progMap = new Map<string, string>();
    if (progIds.length > 0) {
      const { data: prog } = await supabase.from('programs').select('id, name').in('id', progIds);
      (prog ?? []).forEach((p) => progMap.set(p.id as string, p.name as string));
    }
    setRows(list.map((r) => ({ ...r, program_name: progMap.get(r.program_id) ?? null })));
    setLoading(false);
  }, [staff.id, staff.sourceType]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const today = todayIso();
  const { past, upcoming } = useMemo(() => {
    const past: ScheduleRow[] = []; const upcoming: ScheduleRow[] = [];
    rows.forEach((r) => (r.session_date < today ? past : upcoming).push(r));
    return { past, upcoming };
  }, [rows, today]);

  // 월별 그룹핑
  const upcomingByMonth = useMemo(() => {
    const m = new Map<string, ScheduleRow[]>();
    upcoming.forEach((r) => {
      const k = monthKey(r.session_date);
      const arr = m.get(k) ?? []; arr.push(r); m.set(k, arr);
    });
    return Array.from(m.entries());
  }, [upcoming]);

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }
  if (rows.length === 0) {
    return (
      <div className="bg-white rounded-2xl border border-slate-200 px-4 py-12 text-center">
        <p className="text-slate-600 font-semibold">예정된 일정이 없어요</p>
        <p className="text-xs text-slate-400 mt-1">PM이 차시를 배정하면 여기에 표시돼요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {upcomingByMonth.length === 0 ? (
        <p className="text-sm text-slate-400 italic bg-white rounded-xl border border-slate-100 px-4 py-6 text-center">
          앞으로 예정된 일정이 없어요.
        </p>
      ) : (
        upcomingByMonth.map(([month, items]) => (
          <section key={month}>
            <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
              <Calendar size={14} className="text-violet-500" aria-hidden="true" />
              {month.replace(/^(\d{4})-(\d{2})$/, '$1년 $2월')}
            </h2>
            <ul className="space-y-1.5">
              {items.map((r) => (
                <ScheduleRowItem key={r.id} r={r} />
              ))}
            </ul>
          </section>
        ))
      )}

      {/* 지나간 일정 — 접힘 */}
      {past.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowPast((v) => !v)}
            className="w-full inline-flex items-center justify-between px-3 py-2 rounded-lg bg-slate-100 text-slate-600 text-xs font-semibold hover:bg-slate-200 transition-colors">
            <span>지나간 일정 ({past.length}건)</span>
            {showPast ? <ChevronUp size={12} /> : <ChevronDown size={12} />}
          </button>
          {showPast && (
            <ul className="space-y-1.5 mt-2 opacity-70">
              {past.map((r) => (
                <ScheduleRowItem key={r.id} r={r} />
              ))}
            </ul>
          )}
        </section>
      )}
    </div>
  );
}

function ScheduleRowItem({ r }: { r: ScheduleRow }) {
  return (
    <li className="bg-white rounded-xl border border-slate-200 p-3 flex items-center gap-3 flex-wrap">
      <div className="shrink-0 w-16 text-center">
        <p className="text-sm font-bold text-slate-700 tabular-nums">{r.session_date.slice(5)}</p>
        <p className="text-[10px] text-slate-400">({weekdayOf(r.session_date)})</p>
      </div>
      {(r.start_time || r.end_time) && (
        <p className="shrink-0 text-[11px] text-slate-500 tabular-nums inline-flex items-center gap-0.5">
          <Clock size={10} />{trimTime(r.start_time)}{r.end_time && `~${trimTime(r.end_time)}`}
        </p>
      )}
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1E1B4B] truncate">
          {r.session_no}차시 · {r.title}
        </p>
        {r.program_name && <p className="text-[11px] text-slate-500 truncate">{r.program_name}</p>}
      </div>
    </li>
  );
}
