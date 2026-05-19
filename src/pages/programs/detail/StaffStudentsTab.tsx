// bal24 v2 — 프로그램 상세 · 강사 배정 탭 (STEP-STAFF-PORTAL-P4 강사 활동 현황 추가)
// 강사 초빙 목록 + 담당 차시 수 + 멘토링 일지 수 + 강사 포털 바로가기.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Mic2, ExternalLink, Send } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/utils';
import { BADGE_BASE, INVITATION_STATUS_STYLE } from '../../../utils/statusStyles';
import type { InstructorInvitation } from '../../../types/database';

interface Props { programId: string }

type InvitationFull = Pick<
  InstructorInvitation,
  'id' | 'name' | 'role' | 'status' | 'lecture_fee' | 'staff_pool_id' | 'profile_id'
>;

interface Summary {
  inv: InvitationFull;
  curriculumCount: number;
  mentoringLogCount: number;
  staffPortalToken: string | null;
  mentorInviteToken: string | null;
}

export default function StaffStudentsTab({ programId }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<Summary[]>([]);
  const [loading, setLoading] = useState(true);

  const fetchData = useCallback(async () => {
    setLoading(true);
    // 1) 초대 목록
    const { data: invs, error: invErr } = await supabase.from('instructor_invitations')
      .select('id, name, role, status, lecture_fee, staff_pool_id, profile_id')
      .eq('program_id', programId).order('created_at', { ascending: true });
    if (invErr) {
      console.error('[staff-students] 초대 조회 실패:', invErr.message);
      toast.error('강사 정보를 불러오지 못했어요.');
      setRows([]); setLoading(false); return;
    }
    const invList = (invs ?? []) as InvitationFull[];
    const poolIds = Array.from(new Set(invList.map((i) => i.staff_pool_id).filter(Boolean) as string[]));
    const profIds = Array.from(new Set(invList.map((i) => i.profile_id).filter(Boolean) as string[]));

    // 2) staff_portal_token 매핑
    const poolTokenMap = new Map<string, string>();
    if (poolIds.length > 0) {
      const { data: pools } = await supabase.from('staff_pool').select('id, staff_portal_token').in('id', poolIds);
      (pools ?? []).forEach((r) => r.staff_portal_token && poolTokenMap.set(r.id as string, r.staff_portal_token as string));
    }
    const profTokenMap = new Map<string, string>();
    if (profIds.length > 0) {
      const { data: profs } = await supabase.from('profiles').select('id, staff_portal_token').in('id', profIds);
      (profs ?? []).forEach((r) => r.staff_portal_token && profTokenMap.set(r.id as string, r.staff_portal_token as string));
    }

    // 3) 차시 카운트 (curriculum_staff → program_curriculum 매칭)
    const { data: csAll } = await supabase.from('curriculum_staff')
      .select('staff_pool_id, profile_id, curriculum:program_curriculum!inner(program_id)')
      .or([
        poolIds.length > 0 ? `staff_pool_id.in.(${poolIds.join(',')})` : '',
        profIds.length > 0 ? `profile_id.in.(${profIds.join(',')})` : '',
      ].filter(Boolean).join(','));
    type CsRow = { staff_pool_id: string | null; profile_id: string | null; curriculum: { program_id: string } | { program_id: string }[] | null };
    const curByPool = new Map<string, number>();
    const curByProf = new Map<string, number>();
    ((csAll ?? []) as unknown as CsRow[]).forEach((r) => {
      const cur = Array.isArray(r.curriculum) ? r.curriculum[0] : r.curriculum;
      if (!cur || cur.program_id !== programId) return;
      if (r.staff_pool_id) curByPool.set(r.staff_pool_id, (curByPool.get(r.staff_pool_id) ?? 0) + 1);
      if (r.profile_id) curByProf.set(r.profile_id, (curByProf.get(r.profile_id) ?? 0) + 1);
    });

    // 4) 멘토링 + 일지 카운트 (PGRST205 안전)
    const { data: asnAll } = await supabase.from('mentoring_assignments')
      .select('id, mentor_pool_id, mentor_profile_id, mentor_invite_token').eq('program_id', programId);
    type AsnRow = { id: string; mentor_pool_id: string | null; mentor_profile_id: string | null; mentor_invite_token: string | null };
    const asnRows = (asnAll ?? []) as AsnRow[];
    const asnIds = asnRows.map((a) => a.id);
    const inviteTokenByPool = new Map<string, string>();
    const inviteTokenByProf = new Map<string, string>();
    asnRows.forEach((a) => {
      if (a.mentor_pool_id && a.mentor_invite_token) inviteTokenByPool.set(a.mentor_pool_id, a.mentor_invite_token);
      if (a.mentor_profile_id && a.mentor_invite_token) inviteTokenByProf.set(a.mentor_profile_id, a.mentor_invite_token);
    });
    const logsByAsn = new Map<string, number>();
    if (asnIds.length > 0) {
      const { data: logs, error: logErr } = await supabase.from('mentoring_logs')
        .select('id, assignment_id').in('assignment_id', asnIds);
      if (logErr) {
        const m = (logErr.message ?? '').toLowerCase();
        if (!m.includes('does not exist') && !m.includes('pgrst205')) console.warn('[staff-students] 일지 카운트 경고:', logErr.message);
      } else {
        ((logs ?? []) as Array<{ assignment_id: string }>).forEach((l) => {
          logsByAsn.set(l.assignment_id, (logsByAsn.get(l.assignment_id) ?? 0) + 1);
        });
      }
    }
    const logsByPool = new Map<string, number>();
    const logsByProf = new Map<string, number>();
    asnRows.forEach((a) => {
      const cnt = logsByAsn.get(a.id) ?? 0;
      if (a.mentor_pool_id) logsByPool.set(a.mentor_pool_id, (logsByPool.get(a.mentor_pool_id) ?? 0) + cnt);
      if (a.mentor_profile_id) logsByProf.set(a.mentor_profile_id, (logsByProf.get(a.mentor_profile_id) ?? 0) + cnt);
    });

    // 5) summary 구성
    setRows(invList.map((inv) => ({
      inv,
      curriculumCount: (inv.staff_pool_id ? curByPool.get(inv.staff_pool_id) ?? 0 : 0)
        + (inv.profile_id ? curByProf.get(inv.profile_id) ?? 0 : 0),
      mentoringLogCount: (inv.staff_pool_id ? logsByPool.get(inv.staff_pool_id) ?? 0 : 0)
        + (inv.profile_id ? logsByProf.get(inv.profile_id) ?? 0 : 0),
      staffPortalToken: (inv.staff_pool_id ? poolTokenMap.get(inv.staff_pool_id) : null)
        ?? (inv.profile_id ? profTokenMap.get(inv.profile_id) : null) ?? null,
      mentorInviteToken: (inv.staff_pool_id ? inviteTokenByPool.get(inv.staff_pool_id) : null)
        ?? (inv.profile_id ? inviteTokenByProf.get(inv.profile_id) : null) ?? null,
    })));
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const totalInvites = rows.length;
  const sortedRows = useMemo(() => rows, [rows]);

  function openPortal(s: Summary) {
    if (s.staffPortalToken) {
      window.open(`${window.location.origin}/staff-portal/${s.staffPortalToken}`, '_blank', 'noopener');
      return;
    }
    if (s.mentorInviteToken) {
      window.open(`${window.location.origin}/mentor-invite/${s.mentorInviteToken}`, '_blank', 'noopener');
      return;
    }
    toast.error('포털 토큰이 없어요. 강사가 staff_pool에 등록되어 있는지 확인해 주세요.');
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Mic2 size={16} className="text-violet-500" aria-hidden="true" />
          강사 활동 현황 ({totalInvites})
        </h3>
      </header>
      {loading ? (
        <div className="flex justify-center py-6"><Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" /></div>
      ) : sortedRows.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">초빙된 강사가 없어요.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="w-full text-xs">
            <thead className="bg-violet-50/40 text-[10px] uppercase tracking-wide text-slate-500">
              <tr>
                <th className="px-2 py-2 text-left font-bold">강사명</th>
                <th className="px-2 py-2 text-center font-bold">초대 상태</th>
                <th className="px-2 py-2 text-center font-bold whitespace-nowrap">담당 차시</th>
                <th className="px-2 py-2 text-center font-bold whitespace-nowrap">멘토링 일지</th>
                <th className="px-2 py-2 text-right font-bold whitespace-nowrap">강사료</th>
                <th className="px-2 py-2 text-right font-bold whitespace-nowrap">포털</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {sortedRows.map((s) => {
                const unreg = !s.inv.staff_pool_id && !s.inv.profile_id;
                return (
                  <tr key={s.inv.id} className="hover:bg-violet-50/30">
                    <td className="px-2 py-2 font-semibold text-slate-700">
                      {s.inv.name}
                      {s.inv.role && <span className="ml-1 text-[10px] text-slate-400">· {s.inv.role}</span>}
                      {unreg && <span className="ml-1 text-[10px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1">미등록</span>}
                    </td>
                    <td className="px-2 py-2 text-center">
                      <span className={`${BADGE_BASE} ${INVITATION_STATUS_STYLE[s.inv.status]}`}>{s.inv.status}</span>
                    </td>
                    <td className="px-2 py-2 text-center tabular-nums text-slate-600">{s.curriculumCount}차시</td>
                    <td className="px-2 py-2 text-center tabular-nums text-slate-600">{s.mentoringLogCount}건</td>
                    <td className="px-2 py-2 text-right tabular-nums text-slate-500">
                      {s.inv.lecture_fee != null ? formatMoney(s.inv.lecture_fee) : '-'}
                    </td>
                    <td className="px-2 py-2 text-right">
                      <button type="button" onClick={() => openPortal(s)}
                        title={s.staffPortalToken ? '강사 포털 열기' : s.mentorInviteToken ? '멘토 초대 페이지 열기' : '토큰 없음'}
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded-md text-[11px] font-semibold text-violet-700 border border-violet-200 hover:bg-violet-50 disabled:opacity-40"
                        disabled={!s.staffPortalToken && !s.mentorInviteToken}>
                        {s.staffPortalToken ? <><ExternalLink size={11} aria-hidden="true" /> 포털 보기</> : <><Send size={11} aria-hidden="true" /> 초대 페이지</>}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}
    </section>
  );
}
