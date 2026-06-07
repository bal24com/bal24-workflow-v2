// bal24 v2 — STEP-STAFF-PORTAL-P4 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 포털 · 일정 탭 — 차시 일정 월별 그룹핑 (지나간 일정은 접힘).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Calendar, ChevronDown, ChevronUp, Clock, Plus, Trash2, Save, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import EmptyState from '../../../components/EmptyState';
import type { StaffPortalIdentity } from '../staffPortalUtils';
import ScheduleStagesSection from './ScheduleStagesSection'; // STEP-STAFF-PORTAL-REDESIGN PART E (2026-05-28)

interface Props {
  staff: StaffPortalIdentity;
  selectedProgramId: string | null;
}

type ScheduleKind = 'lecture' | 'personal';
interface ScheduleRow {
  id: string;
  kind: ScheduleKind;
  title: string;
  session_date: string;
  start_time: string | null;
  end_time: string | null;
  session_no: number | null;
  program_name: string | null;
}

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

const INPUT_CLASS =
  'w-full h-[42px] border border-gray-200 rounded-[10px] px-3 text-sm ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-slate-50';

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-violet-600 ' +
  'rounded-[10px] hover:bg-violet-700 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100';

const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 ' +
  'hover:bg-slate-100 rounded-[10px] transition-all duration-200';

function todayLocal(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

const WEEKDAY = ['일', '월', '화', '수', '목', '금', '토'];

function trimTime(t: string | null): string { return t ? t.slice(0, 5) : ''; }
function monthKey(d: string): string { return d.slice(0, 7); }
function weekdayOf(d: string): string { return WEEKDAY[new Date(d).getDay()] ?? ''; }

export default function StaffScheduleTab({ staff, selectedProgramId }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<ScheduleRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [showPast, setShowPast] = useState(false);
  const [showAddForm, setShowAddForm] = useState(false);
  const [savingEvent, setSavingEvent] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDate, setNewDate] = useState(todayLocal());
  const [newStartTime, setNewStartTime] = useState('');
  const [newEndTime, setNewEndTime] = useState('');

  const fetchData = useCallback(async () => {
    if (!selectedProgramId) { setRows([]); setLoading(false); return; }
    setLoading(true);
    const staffCol = staff.sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';
    const { data: cs } = await supabase.from('curriculum_staff')
      .select('curriculum_id').eq(staffCol, staff.id);
    const ids = ((cs ?? []) as Array<{ curriculum_id: string }>).map((r) => r.curriculum_id);
    let lectureRows: ScheduleRow[] = [];
    if (ids.length > 0) {
      const { data: pc } = await supabase.from('program_curriculum')
        .select('id, title, session_date, start_time, end_time, session_no, program_id')
        .in('id', ids)
        .eq('program_id', selectedProgramId)
        .not('session_date', 'is', null)
        .order('session_date', { ascending: true });
      const list = ((pc ?? []) as Array<{
        id: string; title: string; session_date: string; start_time: string | null;
        end_time: string | null; session_no: number; program_id: string;
      }>);
      const progIds = Array.from(new Set(list.map((r) => r.program_id).filter(Boolean)));
      let progMap = new Map<string, string>();
      if (progIds.length > 0) {
        const { data: prog } = await supabase.from('programs').select('id, name').in('id', progIds);
        (prog ?? []).forEach((p) => progMap.set(p.id as string, p.name as string));
      }
      lectureRows = list.map((r) => ({
        id: `lec-${r.id}`, kind: 'lecture' as ScheduleKind,
        title: r.title, session_date: r.session_date, start_time: r.start_time, end_time: r.end_time,
        session_no: r.session_no, program_name: progMap.get(r.program_id) ?? null,
      }));
    }
    const { data: pe, error: peErr } = await supabase.from('staff_personal_events')
      .select('id, title, event_date, start_time, end_time')
      .eq('staff_id', staff.id).eq('staff_source', staff.sourceType)
      .order('event_date', { ascending: true });
    let personalRows: ScheduleRow[] = [];
    if (peErr) {
      const m = (peErr.message ?? '').toLowerCase();
      if (!m.includes('does not exist') && !m.includes('pgrst205')) {
        console.warn('[staff-portal/schedule] 개인 일정 경고:', peErr.message);
      }
    } else {
      personalRows = ((pe ?? []) as Array<{
        id: string; title: string; event_date: string; start_time: string | null; end_time: string | null;
      }>).map((r) => ({
        id: `per-${r.id}`, kind: 'personal' as ScheduleKind,
        title: r.title, session_date: r.event_date, start_time: r.start_time, end_time: r.end_time,
        session_no: null, program_name: null,
      }));
    }
    const merged = [...lectureRows, ...personalRows].sort((a, b) => a.session_date.localeCompare(b.session_date));
    setRows(merged);
    setLoading(false);
  }, [staff.id, staff.sourceType, selectedProgramId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  async function handleSaveEvent() {
    if (!newTitle.trim()) { toast.error('일정 제목을 입력해 주세요.'); return; }
    setSavingEvent(true);
    const { error } = await supabase.from('staff_personal_events').insert({
      staff_id: staff.id, staff_source: staff.sourceType,
      title: newTitle.trim(), event_date: newDate,
      start_time: newStartTime || null, end_time: newEndTime || null,
    });
    setSavingEvent(false);
    if (error) {
      console.error('[staff-portal/schedule] 개인 일정 저장 실패:', error.message);
      toast.error('저장에 실패했어요.');
      return;
    }
    toast.success('일정을 추가했어요.');
    setNewTitle(''); setNewStartTime(''); setNewEndTime(''); setNewDate(todayLocal());
    setShowAddForm(false);
    void fetchData();
  }

  async function handleDeletePersonal(scheduleId: string) {
    const id = scheduleId.replace(/^per-/, '');
    if (!window.confirm('이 개인 일정을 삭제할까요?')) return;
    const { error } = await supabase.from('staff_personal_events').delete().eq('id', id);
    if (error) {
      console.error('[staff-portal/schedule] 개인 일정 삭제 실패:', error.message);
      toast.error('삭제에 실패했어요.');
      return;
    }
    toast.success('일정을 삭제했어요.');
    void fetchData();
  }

  const today = todayLocal();
  const { past, upcoming } = useMemo(() => {
    const past: ScheduleRow[] = []; const upcoming: ScheduleRow[] = [];
    rows.forEach((r) => (r.session_date < today ? past : upcoming).push(r));
    return { past, upcoming };
  }, [rows, today]);

  const upcomingByMonth = useMemo(() => {
    const m = new Map<string, ScheduleRow[]>();
    upcoming.forEach((r) => {
      const k = monthKey(r.session_date);
      const arr = m.get(k) ?? []; arr.push(r); m.set(k, arr);
    });
    return Array.from(m.entries());
  }, [upcoming]);

  if (!selectedProgramId) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState emoji="🎯" title="먼저 개요 탭에서 프로그램을 선택해 주세요."
          description="선택된 프로그램의 차시 일정과 개인 일정이 표시돼요." />
      </div>
    );
  }
  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-4">
      {/* 개인 일정 추가 */}
      {showAddForm ? (
        <section className={CARD_CLASS + ' space-y-3'}>
          <p className="text-base font-bold text-[#1E1B4B]">개인 일정 추가</p>
          <input type="text" value={newTitle} onChange={(e) => setNewTitle(e.target.value)} placeholder="일정 제목" disabled={savingEvent}
            className={INPUT_CLASS} />
          <div className="grid grid-cols-3 gap-2">
            <input type="date" value={newDate} onChange={(e) => setNewDate(e.target.value)} disabled={savingEvent}
              className={INPUT_CLASS} />
            <input type="time" value={newStartTime} onChange={(e) => setNewStartTime(e.target.value)} disabled={savingEvent}
              className={INPUT_CLASS} />
            <input type="time" value={newEndTime} onChange={(e) => setNewEndTime(e.target.value)} disabled={savingEvent}
              className={INPUT_CLASS} />
          </div>
          <div className="flex items-center justify-end gap-2">
            <button type="button" onClick={() => setShowAddForm(false)} disabled={savingEvent} className={BTN_GHOST}>
              <X size={14} /> 취소
            </button>
            <button type="button" onClick={() => void handleSaveEvent()} disabled={savingEvent} className={BTN_PRIMARY}>
              {savingEvent ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
            </button>
          </div>
        </section>
      ) : (
        <div className="flex justify-end">
          <button type="button" onClick={() => setShowAddForm(true)} className={BTN_PRIMARY}>
            <Plus size={14} /> 일정 추가
          </button>
        </div>
      )}

      {rows.length === 0 ? (
        <div className={CARD_CLASS}>
          <EmptyState emoji="📅" title="아직 예정된 일정이 없어요."
            description="PM 차시 배정 또는 위 [일정 추가]로 시작해 주세요." />
        </div>
      ) : upcomingByMonth.length === 0 ? (
        <div className={CARD_CLASS}>
          <EmptyState emoji="📅" title="앞으로 예정된 일정이 없어요." />
        </div>
      ) : (
        upcomingByMonth.map(([month, items]) => (
          <section key={month} className={CARD_CLASS}>
            <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
              <Calendar size={16} className="text-violet-500" aria-hidden="true" />
              {month.replace(/^(\d{4})-(\d{2})$/, '$1년 $2월')}
            </h2>
            <ul className="space-y-1.5">
              {items.map((r) => (
                <ScheduleRowItem key={r.id} r={r} onDelete={r.kind === 'personal' ? () => void handleDeletePersonal(r.id) : undefined} />
              ))}
            </ul>
          </section>
        ))
      )}

      {/* 지나간 일정 */}
      {past.length > 0 && (
        <section>
          <button type="button" onClick={() => setShowPast((v) => !v)}
            className="w-full inline-flex items-center justify-between px-4 py-2.5 rounded-[10px] bg-white border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] text-slate-600 text-sm font-semibold hover:bg-violet-50 transition-colors">
            <span>지나간 일정 ({past.length}건)</span>
            {showPast ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {showPast && (
            <ul className="space-y-1.5 mt-2 opacity-70">
              {past.map((r) => (
                <ScheduleRowItem key={r.id} r={r} onDelete={r.kind === 'personal' ? () => void handleDeletePersonal(r.id) : undefined} />
              ))}
            </ul>
          )}
        </section>
      )}

      {/* STEP-STAFF-PORTAL-REDESIGN PART E (2026-05-28) — 일정 4단계 (program_schedule_items) */}
      {selectedProgramId && <ScheduleStagesSection programId={selectedProgramId} />}
    </div>
  );
}

function ScheduleRowItem({ r, onDelete }: { r: ScheduleRow; onDelete?: () => void }) {
  const kindBadge = r.kind === 'lecture' ? '강의' : '개인';
  const kindStyle = r.kind === 'lecture' ? 'bg-blue-100 text-blue-700' : 'bg-emerald-100 text-emerald-700';
  return (
    <li className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 flex items-center gap-3 flex-wrap">
      <div className="shrink-0 w-14 text-center">
        <p className="text-sm font-bold text-slate-700 tabular-nums">{r.session_date.slice(5)}</p>
        <p className="text-[10px] text-slate-400">({weekdayOf(r.session_date)})</p>
      </div>
      {(r.start_time || r.end_time) && (
        <p className="shrink-0 text-xs text-slate-500 tabular-nums inline-flex items-center gap-1">
          <Clock size={11} />{trimTime(r.start_time)}{r.end_time && `~${trimTime(r.end_time)}`}
        </p>
      )}
      <span className={`shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded ${kindStyle}`}>{kindBadge}</span>
      <div className="flex-1 min-w-0">
        <p className="text-sm font-semibold text-[#1E1B4B] truncate">
          {r.session_no ? `${r.session_no}차시 · ` : ''}{r.title}
        </p>
        {r.program_name && <p className="text-xs text-slate-500 truncate">{r.program_name}</p>}
      </div>
      {onDelete && (
        <button type="button" onClick={onDelete} aria-label="개인 일정 삭제"
          className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-lg text-slate-400 hover:bg-red-50 hover:text-red-500 transition-colors">
          <Trash2 size={12} />
        </button>
      )}
    </li>
  );
}
