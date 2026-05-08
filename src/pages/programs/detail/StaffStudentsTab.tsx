// bal24 v2 — 프로그램 상세 · 강사·교육생 탭 (Stage 11-③ 재작성)
// 4 sub 섹션: 강사 / 교육생 / 신청 / 모집

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import {
  Loader2, Mic2, Users, UserPlus, Megaphone, ArrowRight, GraduationCap,
} from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { formatMoney } from '../../../lib/utils';
import { BADGE_BASE, INVITATION_STATUS_STYLE } from '../../../utils/statusStyles';
import {
  fetchProgramInvitations, fetchProgramApplications,
  PARTICIPANT_STATUS_LABEL, type InvitationRow, type ApplicationRow,
} from './programDetailUtils';
import ApplicationsPanel from './applications/ApplicationsPanel';
import RecruitsPanel from './applications/RecruitsPanel';
import type { ParticipantStatus } from '../../../types/application';

type SubTab = 'instructor' | 'student' | 'application' | 'recruit';

const SUB_TABS: { key: SubTab; label: string; Icon: typeof Mic2 }[] = [
  { key: 'instructor',  label: '강사',     Icon: Mic2 },
  { key: 'student',     label: '교육생',   Icon: Users },
  { key: 'application', label: '신청',     Icon: UserPlus },
  { key: 'recruit',     label: '모집',     Icon: Megaphone },
];

export default function StaffStudentsTab({ programId }: { programId: string }) {
  const [sub, setSub] = useState<SubTab>('instructor');

  return (
    <div className="flex flex-col gap-3">
      {/* sub 탭 */}
      <nav
        role="tablist"
        aria-label="강사·교육생 sub 탭"
        className="inline-flex items-center bg-violet-50 rounded-full p-0.5 border border-violet-100 self-start"
      >
        {SUB_TABS.map(({ key, label, Icon }) => {
          const active = sub === key;
          return (
            <button
              key={key}
              type="button"
              role="tab"
              aria-selected={active}
              onClick={() => setSub(key)}
              className={`inline-flex items-center gap-1 h-8 px-3 text-xs font-bold rounded-full transition-colors ${
                active ? 'bg-violet-600 text-white' : 'text-violet-600 hover:bg-violet-100'
              }`}
            >
              <Icon size={12} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      {/* sub 본문 */}
      {sub === 'instructor' && <InstructorSection programId={programId} />}
      {sub === 'student' && <StudentSection programId={programId} />}
      {sub === 'application' && (
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <ApplicationsPanel programId={programId} />
        </section>
      )}
      {sub === 'recruit' && (
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <RecruitsPanel programId={programId} />
        </section>
      )}
    </div>
  );
}

function InstructorSection({ programId }: { programId: string }) {
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

const ACCEPTED_STATUSES: ParticipantStatus[] = ['accepted', 'completed'];

function StudentSection({ programId }: { programId: string }) {
  const toast = useToast();
  const [students, setStudents] = useState<ApplicationRow[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const all = await fetchProgramApplications(programId, 100);
        if (cancelled) return;
        setStudents(all.filter((a) => ACCEPTED_STATUSES.includes(a.status)));
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[step-11/student] 교육생 조회 실패:', raw);
        toast.error('교육생 정보를 불러오지 못했어요.');
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
          <GraduationCap size={16} className="text-cyan-500" aria-hidden="true" />
          확정 교육생 ({students.length})
        </h3>
        <p className="text-[11px] text-slate-500">신청 → 승인 또는 수료 완료된 학생</p>
      </header>
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : students.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">
          확정된 교육생이 없어요. "신청" sub에서 신청자를 승인해 주세요.
        </p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {students.map((s) => (
            <li
              key={s.id}
              className="flex items-center gap-2 rounded-xl border border-cyan-100 bg-cyan-50/30 px-3 py-2"
            >
              <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                {s.name}
                <span className="ml-1 text-[10px] text-slate-400 font-normal">· {s.phone}</span>
              </span>
              <span className={`${BADGE_BASE} ${
                s.status === 'completed'
                  ? 'bg-violet-50 text-violet-700 border-violet-200'
                  : 'bg-emerald-50 text-emerald-600 border-emerald-200'
              } shrink-0`}>
                {PARTICIPANT_STATUS_LABEL[s.status]}
              </span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
