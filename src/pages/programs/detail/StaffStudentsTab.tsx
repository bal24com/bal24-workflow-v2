// bal24 v2 — 프로그램 상세 · 강사·교육생 탭
// instructor_invitations + participant_applications + recruit_forms 임베드.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Mic2, UserPlus, Megaphone, ArrowRight,
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import { BADGE_BASE, INVITATION_STATUS_STYLE } from '../../../utils/statusStyles';
import { RECRUIT_TYPE_LABEL } from '../../../types/application';
import {
  fetchProgramInvitations,
  fetchProgramApplications,
  fetchProgramRecruits,
  PARTICIPANT_STATUS_LABEL,
  type InvitationRow,
  type ApplicationRow,
  type RecruitRow,
} from './programDetailUtils';
import type { ParticipantStatus } from '../../../types/application';

const APPLICATION_STATUS_STYLE: Record<ParticipantStatus, string> = {
  applied: 'bg-slate-100 text-slate-500 border-slate-300',
  reviewing: 'bg-orange-50 text-orange-600 border-orange-200',
  accepted: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-600 border-rose-200',
  withdrawn: 'bg-slate-100 text-slate-400 border-slate-300',
  completed: 'bg-violet-50 text-violet-700 border-violet-200',
};

export default function StaffStudentsTab({ programId }: { programId: string }) {
  const toast = useToast();
  const [invitations, setInvitations] = useState<InvitationRow[]>([]);
  const [applications, setApplications] = useState<ApplicationRow[]>([]);
  const [recruits, setRecruits] = useState<RecruitRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [inv, app, rec] = await Promise.all([
          fetchProgramInvitations(programId),
          fetchProgramApplications(programId, 20),
          fetchProgramRecruits(programId),
        ]);
        if (cancelled) return;
        setInvitations(inv);
        setApplications(app);
        setRecruits(rec);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[program-detail] 강사·교육생 로드 실패:', raw);
        toast.error('강사·교육생 정보를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 강사 초빙 */}
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
        {invitations.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">초빙된 강사가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {invitations.slice(0, 8).map((inv) => (
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
            {invitations.length > 8 && (
              <li className="text-[11px] text-slate-400 text-center pt-1">
                +{invitations.length - 8}명 더
              </li>
            )}
          </ul>
        )}
      </section>

      {/* 교육생 신청 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <UserPlus size={16} className="text-cyan-500" aria-hidden="true" />
            교육생 신청 ({applications.length})
          </h3>
          <Link
            to="/applications"
            className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
          >
            전체 검토
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </header>
        {applications.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">아직 신청자가 없어요.</p>
        ) : (
          <ul className="flex flex-col gap-1.5 max-h-[360px] overflow-y-auto pr-1">
            {applications.map((a) => (
              <li
                key={a.id}
                className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/30 px-3 py-2"
              >
                <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                  {a.name}
                  <span className="ml-1 text-[10px] text-slate-400">· {a.phone}</span>
                </span>
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                  {formatDateKo(a.created_at).replace(/^\d{4}년\s/, '')}
                </span>
                <span
                  className={`${BADGE_BASE} ${APPLICATION_STATUS_STYLE[a.status]} shrink-0`}
                >
                  {PARTICIPANT_STATUS_LABEL[a.status]}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 모집 공고 — 두 컬럼 아래 가로 전체 */}
      <section className="lg:col-span-2 rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <Megaphone size={16} className="text-orange-500" aria-hidden="true" />
            모집 공고 ({recruits.length})
          </h3>
          <Link
            to="/recruit-manage"
            className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5"
          >
            관리
            <ArrowRight size={12} aria-hidden="true" />
          </Link>
        </header>
        {recruits.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">등록된 모집 공고가 없어요.</p>
        ) : (
          <ul className="grid grid-cols-1 md:grid-cols-2 gap-2">
            {recruits.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 rounded-xl border border-orange-100 bg-orange-50/30 px-3 py-2"
              >
                <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-orange-100 text-orange-700 shrink-0">
                  {RECRUIT_TYPE_LABEL[r.recruit_type]}
                </span>
                <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                  {r.title}
                </span>
                {r.deadline && (
                  <span className="text-[10px] text-slate-500 tabular-nums shrink-0">
                    ~ {formatDateKo(r.deadline).replace(/^\d{4}년\s/, '')}
                  </span>
                )}
                <span
                  className={`text-[10px] font-bold px-1.5 py-0.5 rounded shrink-0 ${
                    r.is_active ? 'bg-emerald-100 text-emerald-700' : 'bg-slate-100 text-slate-400'
                  }`}
                >
                  {r.is_active ? '진행중' : '종료'}
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>
    </div>
  );
}
