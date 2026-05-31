// bal24 v2 — STEP-MENTOR-PORTAL-FULL / STEP-MENTOR-MENTEE-MATCHING
// 멘토링 배정 카드 펼친 영역 — 담당 멘티 목록 + 최근 일지 3건 + 연관 멘토 일지

import { useEffect, useMemo, useState } from 'react';
import { Loader2, Users2, BookOpen, Link2, FileDown, CheckCircle2, XCircle } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo } from '../../../lib/utils';
import { getMentorName, MENTORING_LOG_STATUS_LABEL, MENTORING_LOG_STATUS_STYLE } from '../../../types/mentoring';
import type { MentoringAssignment, MentoringLog } from '../../../types/mentoring';
import { fetchLogForPdf } from './mentoringLogPdfFetch';
import { downloadMentoringLogPdf, printMentoringLogViaNewWindow } from './mentoringLogPdf';
import { approveMentoringLog, rejectMentoringLog } from './mentoringLogApproval';
import MentoringRejectModal from './MentoringRejectModal';
import { hasRole } from '../../../constants/roles';
import PortalCommentSection from '../../../components/portal/PortalCommentSection';

interface MenteeLite { id: string; name: string; organization: string | null }

interface RelatedLogRow {
  log: MentoringLog;
  mentorName: string;
  sharedMenteeNames: string[];
}

interface Props {
  assignmentId: string;
  menteeIds: string[];
  // STEP-MENTOR-MENTEE-MATCHING — 연관 일지 계산용 (부모가 전체 배정 fetch해서 전달)
  allAssignments?: MentoringAssignment[];
}

export default function MentoringLogCard({ assignmentId, menteeIds, allAssignments = [] }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [myRole, setMyRole] = useState<string | null>(null);
  const [mentees, setMentees] = useState<MenteeLite[]>([]);
  const [logs, setLogs] = useState<MentoringLog[]>([]);
  const [relatedLogs, setRelatedLogs] = useState<RelatedLogRow[]>([]);
  const [loading, setLoading] = useState(true);
  // STEP-MENTORING-P2-PDF — PDF 생성 중 상태
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // STEP-MENTORING-P3-APPROVE — 승인/반려 진행 상태
  const [actingId, setActingId] = useState<string | null>(null);
  const [rejectTargetId, setRejectTargetId] = useState<string | null>(null);
  const isPmOrAdmin = hasRole(myRole, 'pm') || hasRole(myRole, 'admin');

  // 본인 role 1회 fetch
  useEffect(() => {
    if (!user?.id) return;
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('profiles').select('role').eq('id', user.id).maybeSingle();
      if (!cancelled) setMyRole((data?.role as string | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, [user?.id]);

  async function reloadLogs() {
    if (!assignmentId) return;
    const { data } = await supabase.from('mentoring_logs')
      .select('*').eq('assignment_id', assignmentId).order('log_date', { ascending: false }).limit(3);
    setLogs((data ?? []) as MentoringLog[]);
  }

  async function handleApprove(logId: string) {
    if (!user?.id) return;
    setActingId(logId);
    const r = await approveMentoringLog(logId, user.id);
    setActingId(null);
    if (r.error) { toast.error(r.error); return; }
    toast.success('일지를 승인했어요.');
    void reloadLogs();
  }

  async function handleReject(reason: string) {
    if (!user?.id || !rejectTargetId) return;
    setActingId(rejectTargetId);
    const r = await rejectMentoringLog(rejectTargetId, user.id, reason);
    setActingId(null);
    if (r.error) { toast.error(r.error); return; }
    toast.success('일지를 반려했어요.');
    setRejectTargetId(null);
    void reloadLogs();
  }

  async function handleDownloadPdf(logId: string) {
    setDownloadingId(logId);
    try {
      const data = await fetchLogForPdf(logId);
      if (!data) { toast.error('일지 정보를 불러오지 못했어요.'); return; }
      // 박경수님 2026-05-29 — html2canvas v1~v5 모두 박경수님 환경에서 백지.
      // 새 창 + 브라우저 인쇄 fallback 으로 교체. 사용자가 "PDF 로 저장" 선택.
      try {
        printMentoringLogViaNewWindow(data);
        toast.success('인쇄창에서 "PDF 로 저장" 을 선택해 주세요.');
      } catch (printErr) {
        const raw = printErr instanceof Error ? printErr.message : '';
        console.error('[mentoring-log-card] 인쇄창 호출 실패:', raw);
        // 팝업 차단 시 기존 html2pdf 시도 (v5)
        await downloadMentoringLogPdf(data);
        toast.success('PDF 다운로드가 시작됐어요.');
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[mentoring-log-card] PDF 생성 실패:', raw);
      toast.error(raw || 'PDF 생성 중 오류가 발생했어요.');
    } finally {
      setDownloadingId(null);
    }
  }

  // 공통 멘티를 가진 다른 멘토 배정 (현재 멘토 제외, 멘티 교집합이 있는 것만)
  const relatedAssignments = useMemo(() => {
    if (menteeIds.length === 0) return [];
    const mySet = new Set(menteeIds);
    return allAssignments
      .filter((a) => a.id !== assignmentId)
      .map((a) => {
        const shared = (a.mentee_ids ?? []).filter((id) => mySet.has(id));
        return { assignment: a, shared };
      })
      .filter((x) => x.shared.length > 0);
  }, [allAssignments, assignmentId, menteeIds]);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      // 1) 본인 멘티 + 최근 일지 3건 (병렬)
      const [mRes, lRes] = await Promise.all([
        menteeIds.length > 0
          ? supabase.from('program_participants').select('id, name, organization').in('id', menteeIds)
          : Promise.resolve({ data: [] as MenteeLite[], error: null }),
        supabase.from('mentoring_logs').select('*')
          .eq('assignment_id', assignmentId).order('log_date', { ascending: false }).limit(3),
      ]);
      if (cancelled) return;
      if (mRes.error) console.warn('[mentoring-log-card] 멘티 조회 경고:', mRes.error.message);
      const menteeList = (mRes.data ?? []) as MenteeLite[];
      setMentees(menteeList);
      if (lRes.error) {
        const m = (lRes.error.message ?? '').toLowerCase();
        if (!m.includes('does not exist') && !m.includes('pgrst205')) {
          console.warn('[mentoring-log-card] 일지 조회 경고:', lRes.error.message);
        }
        setLogs([]);
      } else {
        setLogs((lRes.data ?? []) as MentoringLog[]);
      }

      // 2) 연관 일지 (다른 멘토 → 공통 멘티 관련 일지만)
      if (relatedAssignments.length > 0) {
        const otherIds = relatedAssignments.map((r) => r.assignment.id);
        const { data: rData, error: rErr } = await supabase.from('mentoring_logs')
          .select('*').in('assignment_id', otherIds)
          .order('log_date', { ascending: false }).limit(20);
        if (cancelled) return;
        if (rErr) {
          const m = (rErr.message ?? '').toLowerCase();
          if (!m.includes('does not exist') && !m.includes('pgrst205')) {
            console.warn('[mentoring-log-card] 연관 일지 조회 경고:', rErr.message);
          }
          setRelatedLogs([]);
        } else {
          const rLogs = (rData ?? []) as MentoringLog[];
          const mySet = new Set(menteeIds);
          // 멘티 ID → 이름 매핑 (본인 멘티 명단 + 추가 fetch)
          const localMap = new Map(menteeList.map((m) => [m.id, m.name]));
          const rows: RelatedLogRow[] = [];
          for (const log of rLogs) {
            const logMenteeIds = (log.mentee_ids ?? []);
            const shared = logMenteeIds.filter((id) => mySet.has(id));
            if (shared.length === 0) continue;   // 공통 멘티 없는 일지는 제외
            const ra = relatedAssignments.find((r) => r.assignment.id === log.assignment_id);
            if (!ra) continue;
            rows.push({
              log,
              mentorName: getMentorName(ra.assignment),
              sharedMenteeNames: shared.map((id) => localMap.get(id) ?? '...'),
            });
          }
          setRelatedLogs(rows.slice(0, 10));
        }
      } else {
        setRelatedLogs([]);
      }
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [assignmentId, menteeIds, relatedAssignments]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-3 text-xs text-slate-400">
        <Loader2 size={12} className="animate-spin mr-1.5" /> 불러오는 중…
      </div>
    );
  }

  return (
    <div className="border-t border-violet-100/70 pt-2 mt-2 space-y-3">
      {/* 담당 멘티 목록 */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
          <Users2 size={10} aria-hidden="true" /> 담당 멘티 ({mentees.length}명)
        </p>
        {mentees.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">배정된 멘티가 없어요.</p>
        ) : (
          <ul className="space-y-0.5">
            {mentees.map((m) => (
              <li key={m.id} className="text-[11px] text-slate-700">
                · {m.name}{m.organization ? <span className="text-slate-400"> ({m.organization})</span> : null}
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* 최근 멘토링 일지 3건 */}
      <div>
        <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
          <BookOpen size={10} aria-hidden="true" /> 최근 멘토링 일지 ({logs.length}건)
        </p>
        {logs.length === 0 ? (
          <p className="text-[11px] text-slate-400 italic">아직 작성된 일지가 없어요.</p>
        ) : (
          <ul className="space-y-1.5">
            {logs.map((log) => (
              <li key={log.id} className="rounded-lg border border-slate-100 bg-white px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                  <span className="font-bold text-slate-700 tabular-nums">{formatDateKo(log.log_date)}</span>
                  <span className="px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">{log.session_no ?? 1}회차</span>
                  <span className={`px-1 py-0.5 rounded font-semibold ${MENTORING_LOG_STATUS_STYLE[log.status ?? 'draft']}`}>
                    {MENTORING_LOG_STATUS_LABEL[log.status ?? 'draft']}
                  </span>
                  {log.subject && <span className="text-slate-500 truncate max-w-[35%]">· {log.subject}</span>}
                  <div className="ml-auto inline-flex items-center gap-1">
                    {/* STEP-MENTORING-P3-APPROVE — PM 승인/반려 (submitted 상태만) */}
                    {isPmOrAdmin && log.status === 'submitted' && (
                      <>
                        <button type="button" onClick={() => void handleApprove(log.id)} disabled={actingId === log.id}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-emerald-600 text-white text-[10px] font-bold hover:bg-emerald-700 disabled:opacity-50">
                          <CheckCircle2 size={9} aria-hidden="true" /> 승인
                        </button>
                        <button type="button" onClick={() => setRejectTargetId(log.id)} disabled={actingId === log.id}
                          className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-rose-500 text-white text-[10px] font-bold hover:bg-rose-600 disabled:opacity-50">
                          <XCircle size={9} aria-hidden="true" /> 반려
                        </button>
                      </>
                    )}
                    {/* PDF 다운로드 */}
                    <button type="button" onClick={() => void handleDownloadPdf(log.id)} disabled={downloadingId === log.id}
                      className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded border border-violet-200 text-violet-700 hover:bg-violet-50 disabled:opacity-50">
                      {downloadingId === log.id ? <Loader2 size={9} className="animate-spin" /> : <FileDown size={9} aria-hidden="true" />}
                      PDF
                    </button>
                  </div>
                </div>
                <p className="mt-1 text-[11px] text-slate-700 line-clamp-2">{log.content}</p>
                {/* 반려 사유 표시 */}
                {log.status === 'rejected' && log.approval_note && (
                  <p className="mt-1 text-[10px] text-rose-700 bg-rose-50 border border-rose-100 px-2 py-1 rounded">
                    <span className="font-bold">반려 사유:</span> {log.approval_note}
                  </p>
                )}
                {/* 박경수님 2026-05-26 PART G — PM 댓글 입력 (강사 포털에서 즉시 표시) */}
                <PortalCommentSection targetType="mentoring_log" targetId={log.id} />
              </li>
            ))}
          </ul>
        )}
      </div>

      {/* STEP-MENTOR-MENTEE-MATCHING — 연관 멘토 일지 (공통 멘티 기준) */}
      {relatedLogs.length > 0 && (
        <div className="border-t border-dashed border-slate-200 pt-2">
          <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1 mb-1">
            <Link2 size={10} aria-hidden="true" /> 연관 멘토 일지 ({relatedLogs.length}건)
          </p>
          <ul className="space-y-1.5">
            {relatedLogs.map(({ log, mentorName, sharedMenteeNames }) => (
              <li key={`rel-${log.id}`} className="rounded-lg border border-slate-100 bg-slate-50 px-2.5 py-1.5">
                <div className="flex items-center gap-1.5 text-[10px] flex-wrap">
                  <span className="font-bold text-slate-700">{mentorName}</span>
                  <span className="text-slate-400">→ {sharedMenteeNames.join(', ')}</span>
                  <span className="text-slate-400 tabular-nums ml-auto">{formatDateKo(log.log_date)}</span>
                </div>
                <p className="mt-1 text-[11px] text-slate-500 line-clamp-2">{log.content}</p>
              </li>
            ))}
          </ul>
        </div>
      )}

      {/* STEP-MENTORING-P3-APPROVE — 반려 사유 입력 모달 */}
      <MentoringRejectModal
        isOpen={rejectTargetId !== null}
        onClose={() => setRejectTargetId(null)}
        onConfirm={(reason) => void handleReject(reason)}
        isLoading={actingId === rejectTargetId} />
    </div>
  );
}
