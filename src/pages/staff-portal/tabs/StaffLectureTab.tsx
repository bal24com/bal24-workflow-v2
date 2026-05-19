// bal24 v2 — STEP-STAFF-PORTAL-P3
// 강사 포털 · 강의 탭 — 대기 초대 + 프로그램별 차시 그룹핑.
// curriculum_staff → program_curriculum 2단 join (sourceType 분기).
// instructor_invitations 수락/거절 (status '대기' → '수락'/'거절').

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, BookOpen, CheckCircle2, XCircle, Calendar, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import type { CurriculumStaffRole, InvitationStatus } from '../../../types/database';
import type { StaffPortalIdentity } from '../staffPortalUtils';

interface Props { staff: StaffPortalIdentity }

interface LectureRow { id: string; role: CurriculumStaffRole; curriculum_id: string }
interface CurriculumRow {
  id: string; session_no: number; title: string;
  session_date: string | null; start_time: string | null; end_time: string | null;
  program_id: string;
}
interface ProgramLite { id: string; name: string }
interface InvitationRow {
  id: string; status: InvitationStatus; program_id: string | null;
  notes: string | null; program: ProgramLite | null;
}

function trimTime(t: string | null): string { return t ? t.slice(0, 5) : ''; }

export default function StaffLectureTab({ staff }: Props) {
  const toast = useToast();
  const [lectures, setLectures] = useState<LectureRow[]>([]);
  const [curriculums, setCurriculums] = useState<CurriculumRow[]>([]);
  const [programs, setPrograms] = useState<ProgramLite[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    setLoading(true);
    const staffCol = staff.sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';

    // 1) curriculum_staff
    const { data: cs, error: csErr } = await supabase.from('curriculum_staff')
      .select('id, role, curriculum_id').eq(staffCol, staff.id);
    if (csErr) console.warn('[staff-portal/lecture] curriculum_staff 경고:', csErr.message);
    const csRows = (cs ?? []) as LectureRow[];

    // 2) program_curriculum (차시 상세)
    const curIds = csRows.map((r) => r.curriculum_id);
    let curRows: CurriculumRow[] = [];
    if (curIds.length > 0) {
      const { data: cur, error: curErr } = await supabase.from('program_curriculum')
        .select('id, session_no, title, session_date, start_time, end_time, program_id')
        .in('id', curIds).order('session_no', { ascending: true });
      if (curErr) console.warn('[staff-portal/lecture] program_curriculum 경고:', curErr.message);
      curRows = (cur ?? []) as CurriculumRow[];
    }

    // 3) instructor_invitations
    const { data: inv, error: invErr } = await supabase.from('instructor_invitations')
      .select('id, status, program_id, notes, program:programs!instructor_invitations_program_id_fkey(id, name)')
      .eq(staffCol, staff.id).order('created_at', { ascending: false });
    if (invErr) console.warn('[staff-portal/lecture] 초대 조회 경고:', invErr.message);
    const invRows = ((inv ?? []) as unknown) as InvitationRow[];

    // 4) programs (차시 + 초대 program_id 합집합)
    const progIds = new Set<string>();
    curRows.forEach((c) => c.program_id && progIds.add(c.program_id));
    invRows.forEach((i) => i.program_id && progIds.add(i.program_id));
    let progRows: ProgramLite[] = [];
    if (progIds.size > 0) {
      const { data: prog } = await supabase.from('programs').select('id, name').in('id', Array.from(progIds));
      progRows = (prog ?? []) as ProgramLite[];
    }

    setLectures(csRows); setCurriculums(curRows);
    setInvitations(invRows); setPrograms(progRows);
    setLoading(false);
  }, [staff.id, staff.sourceType]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const programMap = useMemo(() => new Map(programs.map((p) => [p.id, p])), [programs]);
  const curByProgram = useMemo(() => {
    const m = new Map<string, CurriculumRow[]>();
    curriculums.forEach((c) => {
      const arr = m.get(c.program_id) ?? [];
      arr.push(c);
      m.set(c.program_id, arr);
    });
    return m;
  }, [curriculums]);
  const lectureRoleMap = useMemo(() => {
    const m = new Map<string, CurriculumStaffRole>();
    lectures.forEach((l) => m.set(l.curriculum_id, l.role));
    return m;
  }, [lectures]);
  const pendingInvs = invitations.filter((i) => i.status === '대기');
  const programIds = Array.from(curByProgram.keys());

  async function handleInviteAction(invitationId: string, next: '수락' | '거절') {
    setActingId(invitationId);
    const { error } = await supabase.from('instructor_invitations')
      .update({ status: next, responded_at: new Date().toISOString() }).eq('id', invitationId);
    setActingId(null);
    if (error) {
      console.error('[staff-portal/lecture] 초대 응답 실패:', error.message);
      toast.error('처리 중 오류가 발생했어요.');
      return;
    }
    toast.success(next === '수락' ? '초대를 수락했어요.' : '초대를 거절했어요.');
    void fetchData();
  }

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-5">
      {pendingInvs.length > 0 && (
        <section>
          <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
            <Mail size={14} className="text-orange-500" aria-hidden="true" />
            대기 중인 초대 ({pendingInvs.length})
          </h2>
          <ul className="space-y-2">
            {pendingInvs.map((i) => (
              <li key={i.id} className="bg-white rounded-xl border border-orange-200 p-4">
                <p className="text-sm font-bold text-[#1E1B4B]">{i.program?.name ?? '(프로그램 미지정)'}</p>
                {i.notes && <p className="text-xs text-slate-600 mt-1 whitespace-pre-wrap">{i.notes}</p>}
                <div className="flex items-center gap-2 mt-3">
                  <button type="button" onClick={() => void handleInviteAction(i.id, '수락')}
                    disabled={actingId === i.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-emerald-600 text-white text-xs font-bold hover:bg-emerald-700 disabled:opacity-50">
                    <CheckCircle2 size={12} aria-hidden="true" /> 수락
                  </button>
                  <button type="button" onClick={() => void handleInviteAction(i.id, '거절')}
                    disabled={actingId === i.id}
                    className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-rose-200 text-rose-600 text-xs font-bold hover:bg-rose-50 disabled:opacity-50">
                    <XCircle size={12} aria-hidden="true" /> 거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section>
        <h2 className="text-sm font-bold text-slate-700 mb-2 flex items-center gap-1.5">
          <BookOpen size={14} className="text-violet-500" aria-hidden="true" />
          담당 강의 ({lectures.length}차시)
        </h2>
        {programIds.length === 0 ? (
          <p className="text-sm text-slate-400 italic bg-white rounded-xl border border-slate-100 px-4 py-6 text-center">
            배정된 강의가 없어요.
          </p>
        ) : (
          <div className="space-y-3">
            {programIds.map((pid) => {
              const program = programMap.get(pid);
              const items = curByProgram.get(pid) ?? [];
              return (
                <div key={pid} className="bg-white rounded-2xl border border-slate-200 p-4">
                  <p className="text-sm font-bold text-[#1E1B4B] mb-2">
                    {program?.name ?? '(프로그램 미지정)'} <span className="text-xs text-slate-400 font-normal">· {items.length}차시</span>
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 rounded-lg border border-slate-100 bg-violet-50/30 px-3 py-2">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-md bg-violet-100 text-violet-700 text-[11px] font-bold tabular-nums">
                          {c.session_no}차시
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1E1B4B] truncate">{c.title}</p>
                          <p className="text-[11px] text-slate-500 tabular-nums flex items-center gap-2 flex-wrap">
                            {c.session_date && <span className="inline-flex items-center gap-0.5"><Calendar size={10} />{formatDateKo(c.session_date)}</span>}
                            {(c.start_time || c.end_time) && (
                              <span className="inline-flex items-center gap-0.5">
                                <Clock size={10} />{trimTime(c.start_time)}{c.end_time && `~${trimTime(c.end_time)}`}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className="shrink-0 text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                          {lectureRoleMap.get(c.id) ?? '강사'}
                        </span>
                      </li>
                    ))}
                  </ul>
                </div>
              );
            })}
          </div>
        )}
      </section>
    </div>
  );
}
