// bal24 v2 — STEP-PORTAL-LECTURE-LOG-REDESIGN (박경수님 2026-05-26)
// 강사 포털 · 강의 탭 심플화 — 대기 초대 + 담당 차시 테이블 1개만.
// 일지 섹션·전체 커리큘럼 아코디언은 [일지] 탭의 [강의일지] 서브탭으로 이동.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Mail, BookOpen, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import { BADGE_BASE, INVITATION_STATUS_STYLE } from '../../../utils/statusStyles';
import type { CurriculumStaffRole, InvitationStatus } from '../../../types/database';
import type { StaffPortalIdentity } from '../staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
  selectedProgramId: string | null;
}

interface MyLectureRow {
  curriculum_id: string;
  session_no: number;
  title: string;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  role: CurriculumStaffRole;
}

interface InvitationRow {
  id: string; status: InvitationStatus; program_id: string | null;
  notes: string | null; program: { id: string; name: string } | null;
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

export default function StaffLectureTab({ staff, selectedProgramId }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<MyLectureRow[]>([]);
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [actingId, setActingId] = useState<string | null>(null);

  const fetchData = useCallback(async () => {
    if (!selectedProgramId) {
      setRows([]); setInvitations([]);
      setLoading(false); return;
    }
    setLoading(true);
    const staffCol = staff.sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';

    // 1) 본인 담당 차시 (curriculum_staff → program_curriculum 2단 join)
    const { data: cs } = await supabase.from('curriculum_staff')
      .select('curriculum_id, role').eq(staffCol, staff.id);
    type CsRow = { curriculum_id: string; role: CurriculumStaffRole };
    const csRows = (cs ?? []) as CsRow[];
    const roleMap = new Map(csRows.map((r) => [r.curriculum_id, r.role]));
    const curIds = csRows.map((r) => r.curriculum_id);

    let myRows: MyLectureRow[] = [];
    if (curIds.length > 0) {
      const { data: cur } = await supabase.from('program_curriculum')
        .select('id, session_no, title, session_date, start_time, end_time')
        .in('id', curIds)
        .eq('program_id', selectedProgramId)
        .order('session_no', { ascending: true });
      type CurRow = {
        id: string; session_no: number; title: string;
        session_date: string | null; start_time: string | null; end_time: string | null;
      };
      myRows = ((cur ?? []) as CurRow[]).map((c) => ({
        curriculum_id: c.id,
        session_no: c.session_no,
        title: c.title,
        session_date: c.session_date,
        start_time: c.start_time,
        end_time: c.end_time,
        role: roleMap.get(c.id) ?? '강사',
      }));
    }

    // 2) 대기 초대
    const { data: inv } = await supabase.from('instructor_invitations')
      .select('id, status, program_id, notes, program:programs!instructor_invitations_program_id_fkey(id, name)')
      .eq(staffCol, staff.id)
      .eq('program_id', selectedProgramId)
      .order('created_at', { ascending: false });
    const invRows = ((inv ?? []) as unknown) as InvitationRow[];

    setRows(myRows);
    setInvitations(invRows);
    setLoading(false);
  }, [staff.id, staff.sourceType, selectedProgramId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const pendingInvs = invitations.filter((i) => i.status === '대기');

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

  if (!selectedProgramId) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState emoji="🎯" title="먼저 개요 탭에서 프로그램을 선택해 주세요."
          description="선택된 프로그램의 강의·초대만 표시돼요." />
      </div>
    );
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

      {/* 박경수님 2026-05-26 — 담당 차시 심플 테이블 (4컬럼) */}
      <section className={CARD_CLASS}>
        <h2 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
          <BookOpen size={16} className="text-violet-500" aria-hidden="true" />
          담당 강의 ({rows.length}차시)
        </h2>
        {rows.length === 0 ? (
          <EmptyState emoji="📖" title="배정된 강의가 없어요." />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="bg-violet-50/50 text-slate-500 text-xs">
                <tr>
                  <th className="text-left px-3 py-2 font-semibold w-16">차시</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">날짜</th>
                  <th className="text-left px-3 py-2 font-semibold">제목</th>
                  <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">시간</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((r) => (
                  <tr key={r.curriculum_id} className="hover:bg-violet-50/40">
                    <td className="px-3 py-2 text-xs font-bold text-violet-700 tabular-nums">
                      {r.session_no}차시
                    </td>
                    <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {formatDateKo(r.session_date) || '-'}
                    </td>
                    <td className="px-3 py-2 text-sm font-medium text-slate-800">{r.title}</td>
                    <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                      {r.start_time || r.end_time
                        ? `${trimTime(r.start_time)}${r.end_time ? `~${trimTime(r.end_time)}` : ''}`
                        : '-'}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            <p className="mt-3 text-[11px] text-slate-400">
              💡 강의 일지는 [일지] 탭 → [강의일지] 서브탭에서 작성·제출하실 수 있어요.
            </p>
          </div>
        )}
      </section>
    </div>
  );
}
