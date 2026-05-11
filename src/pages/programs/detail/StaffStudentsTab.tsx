// bal24 v2 — 프로그램 상세 · 강사 배정 탭
// STEP-TAB-RESTRUCTURE-A — [교육생/신청/모집] sub는 교육생 탭으로 이동. 강사만 잔여.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, Mic2, ArrowRight } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { formatMoney } from '../../../lib/utils';
import { BADGE_BASE, INVITATION_STATUS_STYLE } from '../../../utils/statusStyles';
import {
  fetchProgramInvitations, type InvitationRow,
} from './programDetailUtils';

export default function StaffStudentsTab({ programId }: { programId: string }) {
  const toast = useToast();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const inv = await fetchProgramInvitations(programId);
        if (cancelled) return;
        setInvitations(inv);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[step-11/staff] 강사 조회 실패:', raw);
        toast.error('강사 정보를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, [programId, toast]);

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Mic2 size={16} className="text-violet-500" aria-hidden="true" />
          강사 초빙 ({invitations.length})
        </h3>
        <Link to="/programs" className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5">
          관리
          <ArrowRight size={12} aria-hidden="true" />
        </Link>
      </header>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : invitations.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">초빙된 강사가 없어요.</p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {invitations.map((inv) => (
            <li
              key={inv.id}
              className="flex items-center gap-2 rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2"
            >
              <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                {inv.name}
                {inv.role && <span className="ml-1 text-[10px] text-slate-400">· {inv.role}</span>}
              </span>
              {inv.lecture_fee != null && (
                <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                  {formatMoney(inv.lecture_fee)}
                </span>
              )}
              <span className={`${BADGE_BASE} ${INVITATION_STATUS_STYLE[inv.status]} shrink-0`}>
                {inv.status}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
