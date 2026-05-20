// bal24 v2 — STEP-STAFF-PORTAL-P3 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 포털 · 강의 탭 — 대기 초대 + 프로그램별 차시 그룹핑.
// curriculum_staff → program_curriculum 2단 join (sourceType 분기).
// instructor_invitations 수락/거절 (status '대기' → '수락'/'거절').

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mail, BookOpen, CheckCircle2, XCircle, Calendar, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import { BADGE_BASE, INVITATION_STATUS_STYLE } from '../../../utils/statusStyles';
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

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

const BTN_SUCCESS =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-emerald-600 ' +
  'rounded-[10px] hover:bg-emerald-700 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100';

const BTN_DANGER =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-red-500 bg-red-50 ' +
  'border border-red-200 rounded-[10px] hover:bg-red-100 transition-all duration-200 disabled:opacity-50';

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

    const { data: cs, error: csErr } = await supabase.from('curriculum_staff')
      .select('id, role, curriculum_id').eq(staffCol, staff.id);
    if (csErr) console.warn('[staff-portal/lecture] curriculum_staff 경고:', csErr.message);
    const csRows = (cs ?? []) as LectureRow[];

    const curIds = csRows.map((r) => r.curriculum_id);
    let curRows: CurriculumRow[] = [];
    if (curIds.length > 0) {
      const { data: cur, error: curErr } = await supabase.from('program_curriculum')
        .select('id, session_no, title, session_date, start_time, end_time, program_id')
        .in('id', curIds).order('session_no', { ascending: true });
      if (curErr) console.warn('[staff-portal/lecture] program_curriculum 경고:', curErr.message);
      curRows = (cur ?? []) as CurriculumRow[];
    }

    const { data: inv, error: invErr } = await supabase.from('instructor_invitations')
      .select('id, status, program_id, notes, program:programs!instructor_invitations_program_id_fkey(id, name)')
      .eq(staffCol, staff.id).order('created_at', { ascending: false });
    if (invErr) console.warn('[staff-portal/lecture] 초대 조회 경고:', invErr.message);
    const invRows = ((inv ?? []) as unknown) as InvitationRow[];

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
    <div className="space-y-4">
      {pendingInvs.length > 0 && (
        <section className={CARD_CLASS}>
          <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
            <Mail size={16} className="text-orange-500" aria-hidden="true" />
            대기 중인 초대 ({pendingInvs.length})
          </h2>
          <ul className="space-y-2">
            {pendingInvs.map((i) => (
              <li key={i.id} className="rounded-xl border border-orange-200 bg-orange-50/40 p-4">
                <div className="flex items-start gap-2 mb-2">
                  <span className={`${BADGE_BASE} ${INVITATION_STATUS_STYLE[i.status]}`}>{i.status}</span>
                  <p className="text-sm font-bold text-[#1E1B4B]">{i.program?.name ?? '(프로그램 미지정)'}</p>
                </div>
                {i.notes && <p className="text-sm text-slate-600 mb-3 whitespace-pre-wrap">{i.notes}</p>}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => void handleInviteAction(i.id, '수락')}
                    disabled={actingId === i.id} className={BTN_SUCCESS}>
                    <CheckCircle2 size={14} aria-hidden="true" /> 수락
                  </button>
                  <button type="button" onClick={() => void handleInviteAction(i.id, '거절')}
                    disabled={actingId === i.id} className={BTN_DANGER}>
                    <XCircle size={14} aria-hidden="true" /> 거절
                  </button>
                </div>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className={CARD_CLASS}>
        <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-violet-500" aria-hidden="true" />
          담당 강의 ({lectures.length}차시)
        </h2>
        {programIds.length === 0 ? (
          <EmptyState emoji="📖" title="아직 배정된 강의가 없어요." />
        ) : (
          <div className="space-y-4">
            {programIds.map((pid) => {
              const program = programMap.get(pid);
              const items = curByProgram.get(pid) ?? [];
              return (
                <div key={pid}>
                  <p className="text-sm font-bold text-[#1E1B4B] mb-2">
                    {program?.name ?? '(프로그램 미지정)'}
                    <span className="text-xs text-slate-400 font-normal ml-1.5">· {items.length}차시</span>
                  </p>
                  <ul className="space-y-1.5">
                    {items.map((c) => (
                      <li key={c.id} className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5">
                        <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-md bg-violet-100 text-violet-700 text-xs font-bold tabular-nums">
                          {c.session_no}차시
                        </span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-semibold text-[#1E1B4B] truncate">{c.title}</p>
                          <p className="text-xs text-slate-500 tabular-nums flex items-center gap-2 flex-wrap mt-0.5">
                            {c.session_date && (
                              <span className="inline-flex items-center gap-1"><Calendar size={11} />{formatDateKo(c.session_date)}</span>
                            )}
                            {(c.start_time || c.end_time) && (
                              <span className="inline-flex items-center gap-1">
                                <Clock size={11} />{trimTime(c.start_time)}{c.end_time && `~${trimTime(c.end_time)}`}
                              </span>
                            )}
                          </p>
                        </div>
                        <span className={`${BADGE_BASE} bg-violet-50 text-violet-600 border-violet-200`}>
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
