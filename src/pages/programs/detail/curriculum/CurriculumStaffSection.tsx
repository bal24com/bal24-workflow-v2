// bal24 v2 — 커리큘럼 강사·멘토 배정 현황 카드 (STEP-CURRICULUM-INSTRUCTOR-VIEW)

import { useCallback, useEffect, useState } from 'react';
import { CheckCircle2, Mail, AlertTriangle, UserPlus, X, Loader2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { trimTime } from './curriculumTabUtils';
import type {
  CurriculumStaff, CurriculumStaffRole, ProgramCurriculum, InvitationStatus,
} from '../../../../types/database';

interface Props {
  programId: string;
  refreshKey?: number;
  onRequestInstructor: (curriculumId: string, sessionInfo: string) => void;
}

interface StaffCell { id: string; name: string; role: CurriculumStaffRole; }
interface InvitationCell { id: string; name: string; status: InvitationStatus; }

interface SessionRow {
  id: string; session_no: number; title: string;
  day_label: string | null; start_time: string | null; end_time: string | null;
  raw: string | null; staff: StaffCell[]; invitations: InvitationCell[];
}

type NameRef = { id: string; name: string } | { id: string; name: string }[] | null;
type StaffJoinRow = CurriculumStaff & { staff_pool: NameRef; profile: NameRef };

function pickName(v: NameRef): string {
  if (!v) return '?';
  return Array.isArray(v) ? v[0]?.name ?? '?' : v.name;
}

function metaLabel(s: Pick<SessionRow, 'day_label' | 'start_time' | 'end_time'>, sep = ' '): string {
  return [s.day_label, [trimTime(s.start_time), trimTime(s.end_time)].filter(Boolean).join('~')]
    .filter(Boolean).join(sep);
}

function sessionInfoText(s: SessionRow): string {
  const meta = metaLabel(s);
  return `${s.session_no}차시 — ${s.title}${meta ? ` (${meta})` : ''}`;
}

export default function CurriculumStaffSection({ programId, refreshKey, onRequestInstructor }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);

  const refresh = useCallback(async () => {
    const cur = await supabase.from('program_curriculum')
      .select('id, session_no, title, day_label, start_time, end_time, instructor_name_raw')
      .eq('program_id', programId).order('session_no', { ascending: true });
    if (cur.error) {
      console.error('[curriculum-staff-section] 차시 조회 실패:', cur.error.message);
      toast.error('차시를 불러오지 못했어요.');
      setRows([]); return;
    }
    type CurRow = Pick<ProgramCurriculum,
      'id' | 'session_no' | 'title' | 'day_label' | 'start_time' | 'end_time' | 'instructor_name_raw'>;
    const items = (cur.data ?? []) as CurRow[];
    if (items.length === 0) { setRows([]); return; }
    const ids = items.map((c) => c.id);
    const [staffR, invR] = await Promise.all([
      supabase.from('curriculum_staff')
        .select('*, staff_pool:staff_pool(id,name), profile:profiles(id,name)').in('curriculum_id', ids),
      supabase.from('instructor_invitations').select('id, name, status, curriculum_id')
        .eq('program_id', programId).not('curriculum_id', 'is', null),
    ]);
    if (staffR.error) console.error('[curriculum-staff-section] 인력 조회 실패:', staffR.error.message);
    if (invR.error) console.error('[curriculum-staff-section] 초대 조회 실패:', invR.error.message);
    const staffByCur = new Map<string, StaffCell[]>();
    for (const s of (staffR.data ?? []) as StaffJoinRow[]) {
      const name = s.staff_pool ? pickName(s.staff_pool) : pickName(s.profile);
      const arr = staffByCur.get(s.curriculum_id) ?? [];
      arr.push({ id: s.id, name, role: s.role });
      staffByCur.set(s.curriculum_id, arr);
    }
    const invByCur = new Map<string, InvitationCell[]>();
    for (const inv of (invR.data ?? []) as Array<InvitationCell & { curriculum_id: string }>) {
      const arr = invByCur.get(inv.curriculum_id) ?? [];
      arr.push({ id: inv.id, name: inv.name, status: inv.status });
      invByCur.set(inv.curriculum_id, arr);
    }
    setRows(items.map((c) => ({
      id: c.id, session_no: c.session_no, title: c.title,
      day_label: c.day_label ?? null, start_time: c.start_time ?? null, end_time: c.end_time ?? null,
      raw: c.instructor_name_raw ?? null,
      staff: staffByCur.get(c.id) ?? [], invitations: invByCur.get(c.id) ?? [],
    })));
  }, [programId, toast]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => { await refresh(); if (!cancelled) setLoading(false); })();
    return () => { cancelled = true; };
  }, [programId, refresh, refreshKey]);

  async function removeStaff(id: string, name: string) {
    if (!window.confirm(`"${name}" 배정을 해제할까요?`)) return;
    const { error } = await supabase.from('curriculum_staff').delete().eq('id', id);
    if (error) {
      console.error('[curriculum-staff-section] 배정 해제 실패:', error.message);
      toast.error('배정 해제에 실패했어요.'); return;
    }
    toast.success('배정을 해제했어요.');
    void refresh();
  }

  // 요약 카운트
  const assigned = rows.reduce((n, r) => n + r.staff.length, 0);
  const requested = rows.reduce((n, r) => n + r.invitations.filter((i) => i.status === '대기').length, 0);
  const unassigned = rows.filter((r) => r.staff.length === 0 && (r.raw?.trim() || r.invitations.length === 0)).length;

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-bold text-[#1E1B4B]">강사·멘토 배정 현황</p>
          <p className="text-[11px] text-slate-500 mt-0.5">차시별 매칭 결과를 확인하고 미배정은 [강사 요청]으로 초대해 주세요.</p>
        </div>
        <div className="flex items-center gap-1.5 text-[11px] font-bold flex-wrap">
          {([
            [CheckCircle2, '배정', assigned, 'bg-emerald-50 text-emerald-700 border-emerald-200'],
            [Mail, '요청중', requested, 'bg-amber-50 text-amber-700 border-amber-200'],
            [AlertTriangle, '미배정', unassigned, 'bg-rose-50 text-rose-700 border-rose-200'],
          ] as const).map(([Ic, label, n, cls]) => (
            <span key={label} className={`inline-flex items-center gap-1 px-2 py-0.5 rounded-full border ${cls}`}>
              <Ic size={11} aria-hidden="true" /> {label} {n}
            </span>
          ))}
        </div>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-6 text-xs text-slate-400">
          <Loader2 size={14} className="animate-spin mr-1.5" /> 불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">등록된 차시가 없어요.</p>
      ) : (
        <ul className="space-y-2">
          {rows.map((s) => {
            const meta = metaLabel(s, ' / ');
            const pendingInvs = s.invitations.filter((i) => i.status === '대기');
            const isUnassigned = s.staff.length === 0;
            return (
              <li key={s.id} className="rounded-xl border border-slate-100 bg-slate-50/40 p-3">
                <div className="flex items-start justify-between gap-2 flex-wrap">
                  <div className="min-w-0">
                    <p className="text-xs font-bold text-slate-700">
                      <span className="text-violet-600">{s.session_no}차시</span> — {s.title}
                    </p>
                    {meta && <p className="text-[10px] text-slate-400 mt-0.5">{meta}</p>}
                  </div>
                  {isUnassigned && (
                    <button type="button" onClick={() => onRequestInstructor(s.id, sessionInfoText(s))}
                      className="inline-flex items-center gap-1 px-2.5 py-1 rounded-lg text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200">
                      <UserPlus size={11} aria-hidden="true" /> 강사 요청
                    </button>
                  )}
                </div>
                <div className="mt-2 flex flex-wrap items-center gap-1">
                  {s.staff.map((st) => (
                    <span key={st.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-emerald-100 text-emerald-700 border border-emerald-200">
                      <CheckCircle2 size={10} aria-hidden="true" />
                      <span>{st.name}</span>
                      <span className="text-emerald-500/70">· {st.role}</span>
                      <button type="button" onClick={() => void removeStaff(st.id, st.name)}
                        aria-label="배정 해제"
                        className="ml-0.5 opacity-60 hover:opacity-100"><X size={9} aria-hidden="true" /></button>
                    </span>
                  ))}
                  {pendingInvs.map((i) => (
                    <span key={i.id}
                      className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-amber-100 text-amber-700 border border-amber-200">
                      <Mail size={10} aria-hidden="true" /><span>{i.name}</span>
                      <span className="text-amber-500/70">· 요청중</span>
                    </span>
                  ))}
                  {isUnassigned && pendingInvs.length === 0 && (
                    <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-[10px] font-bold bg-rose-50 text-rose-600 border border-rose-200">
                      <AlertTriangle size={10} aria-hidden="true" /> 미배정{s.raw?.trim() ? ` — ${s.raw}` : ''}
                    </span>
                  )}
                </div>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
