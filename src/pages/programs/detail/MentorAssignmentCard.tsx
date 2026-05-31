// 박경수님 2026-05-29 — 멘토 배정 카드 (MentoringTab V-1 슬림화 분리).

import { Copy, ChevronDown, ChevronUp, FileDown, Loader2 } from 'lucide-react';
import { copyToClipboard } from '../../../lib/clipboard';
import { getMentorName, isUnregisteredMentor } from '../../../types/mentoring';
import type { MentoringAssignment } from '../../../types/mentoring';
import MentoringLogCard from './MentoringLogCard';
import type { useToast } from '../../../contexts/ToastContext';
import { countCompletedSessions } from './mentoringUtils';
import type { LogBatchLoading } from './useMentoringLogBatch';

interface Props {
  a: MentoringAssignment;
  allAssignments: MentoringAssignment[];
  expanded: boolean;
  setExpanded: (id: string | null) => void;
  setSessionTarget: (t: { assignmentId: string; mentorName: string; session: null }) => void;
  setMenteeTarget: (a: MentoringAssignment) => void;
  handleCopyMentorLink: (token: string, name: string) => Promise<void>;
  handleDownloadMentorFee: (a: MentoringAssignment) => Promise<void>;
  handleDownloadMentorLogs: (a: MentoringAssignment) => Promise<void>;
  feeDownloadingId: string | null;
  feeBatchProgress: { current: number; total: number } | null;
  logBatchLoading: LogBatchLoading;
  toast: ReturnType<typeof useToast>;
}

export default function MentorAssignmentCard({
  a, allAssignments, expanded, setExpanded, setSessionTarget, setMenteeTarget,
  handleCopyMentorLink, handleDownloadMentorFee, handleDownloadMentorLogs,
  feeDownloadingId, feeBatchProgress, logBatchLoading, toast,
}: Props) {
  const completed = countCompletedSessions(a.sessions);
  const planned = a.session_count ?? 0;
  const menteeCount = a.mentee_ids?.length ?? 0;
  const unregistered = isUnregisteredMentor(a);

  return (
    <li className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 flex flex-col gap-1.5">
      <div className="flex items-center justify-between">
        <span className="text-sm font-bold text-[#1E1B4B] truncate inline-flex items-center gap-1">
          {getMentorName(a)}
          {unregistered && (
            <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1 py-0.5">미등록</span>
          )}
        </span>
        <span className="text-[10px] text-slate-500 shrink-0">{a.meet_type ?? '-'} · {a.pay_type ?? '-'}</span>
      </div>
      <div className="flex items-center justify-between text-[10px]">
        <span className="text-slate-500">
          담당 멘티 <strong className="text-slate-700 tabular-nums">{menteeCount}</strong>명
          {menteeCount === 0 && <span className="ml-1 text-slate-400 italic">(미지정)</span>}
        </span>
        {unregistered && a.mentor_invite_token && (
          <button type="button"
            onClick={() => void copyToClipboard(`${window.location.origin}/mentor-invite/${a.mentor_invite_token}`)
              .then((ok) => toast.success(ok ? '초대 링크 복사됨' : '복사 실패'))}
            className="text-violet-600 hover:underline font-semibold">
            초대 링크 복사
          </button>
        )}
        <button type="button" onClick={() => setMenteeTarget(a)}
          className="text-violet-600 hover:underline font-semibold">
          멘티 배정
        </button>
      </div>
      <div className="flex items-center justify-between text-[11px] text-slate-500">
        <span>완료 {completed}/{planned}회 · 원천 {a.tax_type}</span>
        <div className="flex items-center gap-1">
          <button type="button"
            onClick={() => void handleCopyMentorLink(a.mentor_access_token, getMentorName(a))}
            title="멘토 링크 복사"
            className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:bg-violet-100 hover:text-violet-700">
            <Copy size={11} aria-hidden="true" />
          </button>
          <button type="button"
            onClick={() => setSessionTarget({ assignmentId: a.id, mentorName: getMentorName(a), session: null })}
            className="text-[10px] font-semibold text-violet-700 hover:underline">
            보고서 추가
          </button>
          <button type="button"
            onClick={() => void handleDownloadMentorLogs(a)}
            disabled={logBatchLoading === a.id || logBatchLoading === 'all'}
            title="이 멘토의 모든 일지를 한 번에 인쇄 (PDF 로 저장 가능)"
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-emerald-700 hover:underline disabled:opacity-50">
            {logBatchLoading === a.id ? <Loader2 size={10} className="animate-spin" /> : <FileDown size={10} aria-hidden="true" />}
            일지 모음
          </button>
          <button type="button"
            onClick={() => void handleDownloadMentorFee(a)}
            disabled={feeDownloadingId === a.id || !!feeBatchProgress}
            title="강사료 확인서 PDF 다운로드"
            className="inline-flex items-center gap-0.5 text-[10px] font-semibold text-violet-700 hover:underline disabled:opacity-50">
            {feeDownloadingId === a.id ? <Loader2 size={10} className="animate-spin" /> : <FileDown size={10} aria-hidden="true" />}
            강사료 PDF
          </button>
          <button type="button"
            onClick={() => setExpanded(expanded ? null : a.id)}
            aria-label={expanded ? '접기' : '펼치기'}
            className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:bg-violet-100 hover:text-violet-700">
            {expanded ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
          </button>
        </div>
      </div>
      {expanded && (
        <MentoringLogCard assignmentId={a.id} menteeIds={a.mentee_ids ?? []}
          allAssignments={allAssignments} />
      )}
    </li>
  );
}
