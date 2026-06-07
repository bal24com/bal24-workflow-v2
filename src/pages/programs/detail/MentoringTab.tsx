// bal24 v2 — 멘토링 PM 탭 (STEP-MENTORING)
// 현황 카드 4개 + 보고서 목록 테이블 (멘토 필터 + 보고서/배정 추가).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { FileDown, Loader2, Plus, Users2, UserCheck, UserX, MessageSquare, Download } from 'lucide-react';
import MentorAssignmentCard from './MentorAssignmentCard';
import { Button, Card, CardContent } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { formatDateKo } from '../../../lib/utils';
import {
  fetchMentoringAssignments, downloadSessionAsWord,
} from './mentoringUtils';
import { fetchStaffFees } from './staffFeeUtils';
// 박경수님 2026-05-29 — 일지 일괄·개인 PDF 인쇄 (새 창 패턴, V-1 hook 분리)
import { useMentoringLogBatch } from './useMentoringLogBatch';
import { formatDuration, getMentorName } from '../../../types/mentoring';
import type {
  MentoringAssignment, MentoringSession,
} from '../../../types/mentoring';
import type { StaffFee } from '../../../types/staffFee';
import MentoringAssignModal from './MentoringAssignModal';
import MentoringSessionModal from './MentoringSessionModal';
import MenteeAssignModal from './MenteeAssignModal';
import MentoringStatCard from './MentoringStatCard';
import { buildFeeFormFromStaffFee } from '../../../utils/feeFormPDF';
import { useFeeDownload } from '../../../hooks/useFeeDownload';

interface Props {
  programId: string;
}

export default function MentoringTab({ programId }: Props) {
  const toast = useToast();
  const [assignments, setAssignments] = useState<MentoringAssignment[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterMentor, setFilterMentor] = useState<string>('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [sessionTarget, setSessionTarget] = useState<{
    assignmentId: string;
    mentorName: string;
    session: MentoringSession | null;
  } | null>(null);
  // STEP-MENTOR-PORTAL-FULL — 카드 펼침 상태 (lazy fetch 트리거)
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // STEP-MENTOR-MENTEE-MATCHING — 멘티 배정 모달 대상
  const [menteeTarget, setMenteeTarget] = useState<MentoringAssignment | null>(null);
  // 박경수님 2026-05-26 — 강사료 PDF 다운로드 (공용 훅)
  const { downloadingId: feeDownloadingId, batchProgress: feeBatchProgress, downloadOne, downloadMany } = useFeeDownload();

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await fetchMentoringAssignments(programId);
    setAssignments(list);
    // 피드백 합계
    const sessionIds = list.flatMap((a) => (a.sessions ?? []).map((s) => s.id));
    if (sessionIds.length > 0) {
      const { count, error } = await supabase
        .from('mentoring_feedbacks')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds);
      if (error) console.error('[mentoring] 피드백 카운트 실패:', error.message);
      else setFeedbackCount(count ?? 0);
    } else {
      setFeedbackCount(0);
    }
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const stats = useMemo(() => {
    const total = assignments.length;
    const assigned = assignments.filter((a) => a.status === '진행').length;
    const inactive = assignments.filter((a) => a.status !== '진행').length;
    return { total, assigned, inactive, feedback: feedbackCount };
  }, [assignments, feedbackCount]);

  const sessionRows = useMemo(() => {
    const rows: Array<{ a: MentoringAssignment; s: MentoringSession }> = [];
    for (const a of assignments) {
      if (filterMentor !== 'all' && a.id !== filterMentor) continue;
      for (const s of a.sessions ?? []) {
        rows.push({ a, s });
      }
    }
    return rows.sort((x, y) => y.s.session_date.localeCompare(x.s.session_date));
  }, [assignments, filterMentor]);

  async function handleCopyMentorLink(token: string, name: string) {
    const url = `${window.location.origin}/mentoring-mentor/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${name}님 멘토 링크 복사 완료`);
    else toast.error('링크 복사에 실패했어요.');
  }

  // 박경수님 2026-05-26 — 멘토에 매칭되는 program_staff_fees row 찾기
  function findFeeForMentor(a: MentoringAssignment, fees: StaffFee[]): StaffFee | null {
    return fees.find((f) =>
      (a.mentor_pool_id && f.expert_id === a.mentor_pool_id)
      || (a.mentor_profile_id && f.profile_id === a.mentor_profile_id),
    ) ?? null;
  }

  async function handleDownloadMentorFee(a: MentoringAssignment) {
    const fees = await fetchStaffFees(programId);
    const fee = findFeeForMentor(a, fees);
    if (!fee) {
      toast.error(`${getMentorName(a)}님 강사료 기준이 [강사료 탭]에 등록돼 있지 않아요.`);
      return;
    }
    await downloadOne(a.id, () => buildFeeFormFromStaffFee(fee, programId));
  }

  // 박경수님 2026-05-29 — 일지 일괄·개인 PDF (hook 으로 분리)
  const { loading: logBatchLoading, downloadMentor: handleDownloadMentorLogs, downloadAll: handleDownloadAllLogsRaw } = useMentoringLogBatch(toast);
  const handleDownloadAllLogs = () => void handleDownloadAllLogsRaw(assignments);

  async function handleDownloadAllMentorFees() {
    if (assignments.length === 0) { toast.error('멘토가 없어요.'); return; }
    if (!window.confirm(`멘토 ${assignments.length}명의 강사료 확인서를 순차 다운로드할까요?`)) return;
    const fees = await fetchStaffFees(programId);
    const matched = assignments
      .map((a) => ({ a, fee: findFeeForMentor(a, fees) }))
      .filter((x): x is { a: MentoringAssignment; fee: StaffFee } => !!x.fee);
    if (matched.length === 0) {
      toast.error('매칭되는 강사료 기준이 [강사료 탭]에 없어요.');
      return;
    }
    if (matched.length < assignments.length) {
      toast.error(`${assignments.length - matched.length}명은 강사료 기준 미등록 — 등록된 ${matched.length}명만 다운로드해요.`);
    }
    await downloadMany(matched.map((x) => ({
      id: x.a.id, dataBuilder: () => buildFeeFormFromStaffFee(x.fee, programId),
    })));
  }

  return (
    <div className="space-y-4">
      {/* 현황 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <MentoringStatCard icon={<Users2 size={16} />} label="총 멘토 수" value={`${stats.total}명`} color="violet" />
        <MentoringStatCard icon={<UserCheck size={16} />} label="배정 멘토" value={`${stats.assigned}명`} color="emerald" />
        <MentoringStatCard icon={<UserX size={16} />} label="비활성 멘토" value={`${stats.inactive}명`} color="slate" />
        <MentoringStatCard icon={<MessageSquare size={16} />} label="총 피드백" value={`${stats.feedback}건`} color="orange" />
      </div>

      {/* 보고서 목록 헤더 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">🤝</span>
          <h3 className="text-sm font-bold text-[#1E1B4B]">멘토링 보고서</h3>
          <span className="text-[11px] text-slate-400">({sessionRows.length}건)</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterMentor}
            onChange={(e) => setFilterMentor(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 outline-none focus:border-primary"
          >
            <option value="all">전체 멘토</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>{getMentorName(a)}</option>
            ))}
          </select>
          {/* 박경수님 2026-05-29 — 일지 일괄 인쇄 (전체 멘토) */}
          {assignments.length > 0 && (
            <Button variant="outline" size="sm"
              leftIcon={logBatchLoading === 'all' ? <Loader2 size={14} className="animate-spin" /> : <FileDown size={14} />}
              disabled={!!logBatchLoading}
              title="전체 멘토의 모든 일지를 한 번에 인쇄 (PDF 로 저장 가능)"
              onClick={() => void handleDownloadAllLogs()}>
              {logBatchLoading === 'all' ? '준비 중…' : `일지 일괄 (${assignments.length}명)`}
            </Button>
          )}
          {/* 박경수님 2026-05-26 — 강사료 확인서 일괄 다운로드 */}
          {assignments.length > 0 && (
            <Button variant="outline" size="sm"
              leftIcon={feeBatchProgress ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
              disabled={!!feeBatchProgress}
              title={`멘토 ${assignments.length}명의 강사료 확인서 PDF 를 1.5초 간격으로 순차 다운로드해요. [확인] 누른 후 다운로드 폴더 확인`}
              onClick={() => void handleDownloadAllMentorFees()}>
              {feeBatchProgress
                ? `다운로드 중 (${feeBatchProgress.current}/${feeBatchProgress.total})`
                : `강사료 일괄 (${assignments.length}명)`}
            </Button>
          )}
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAssignOpen(true)}>
            멘토 배정
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="아직 배정된 멘토가 없어요"
          description="첫 멘토를 배정해 멘토링을 시작해 보세요."
          action={
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAssignOpen(true)}>
              멘토 배정
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {sessionRows.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">
                아직 작성된 보고서가 없어요. 멘토가 보고서를 작성하면 여기에 표시돼요.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-violet-50/40 text-slate-500 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">날짜</th>
                    <th className="text-left px-3 py-2 font-semibold">팀명</th>
                    <th className="text-left px-3 py-2 font-semibold">아이템</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">유형</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">소요</th>
                    <th className="text-left px-3 py-2 font-semibold">제목</th>
                    <th className="text-left px-3 py-2 font-semibold">멘토</th>
                    <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">Word</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionRows.map(({ a, s }) => (
                    <tr key={s.id} className="hover:bg-violet-50/40">
                      <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDateKo(s.session_date)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[120px]">{s.team_name ?? '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[140px]">{s.item_name ?? '-'}</td>
                      <td className="px-3 py-2">
                        {s.meet_type ? (
                          <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            s.meet_type === '대면'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>{s.meet_type}</span>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDuration(s.duration_min)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSessionTarget({ assignmentId: a.id, mentorName: getMentorName(a), session: s })}
                          className="text-xs font-semibold text-violet-700 hover:underline truncate max-w-[200px] text-left"
                        >
                          {s.title}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[100px]">{getMentorName(a)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => downloadSessionAsWord(s, getMentorName(a))}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                          aria-label="Word 다운로드"
                        >
                          <FileDown size={12} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 멘토 카드 (배정 + 토큰 복사 + 보고서 추가) */}
      {assignments.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">배정된 멘토 ({assignments.length})</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {assignments.map((a) => (
                <MentorAssignmentCard
                  key={a.id} a={a} allAssignments={assignments}
                  expanded={expandedId === a.id} setExpanded={setExpandedId}
                  setSessionTarget={setSessionTarget} setMenteeTarget={setMenteeTarget}
                  handleCopyMentorLink={handleCopyMentorLink}
                  handleDownloadMentorFee={handleDownloadMentorFee}
                  handleDownloadMentorLogs={handleDownloadMentorLogs}
                  feeDownloadingId={feeDownloadingId} feeBatchProgress={feeBatchProgress}
                  logBatchLoading={logBatchLoading} toast={toast}
                />
              ))}
            </ul>
          </CardContent>
        </Card>
      )}

      <MentoringAssignModal
        open={assignOpen}
        programId={programId}
        onClose={() => setAssignOpen(false)}
        onSaved={() => void refresh()}
      />

      {sessionTarget && (
        <MentoringSessionModal
          open={!!sessionTarget}
          assignmentId={sessionTarget.assignmentId}
          mentorName={sessionTarget.mentorName}
          session={sessionTarget.session}
          onClose={() => setSessionTarget(null)}
          onSaved={() => void refresh()}
        />
      )}

      {/* STEP-MENTOR-MENTEE-MATCHING — 멘티 배정 모달 */}
      <MenteeAssignModal
        open={!!menteeTarget}
        programId={programId}
        assignment={menteeTarget}
        onClose={() => setMenteeTarget(null)}
        onSaved={() => void refresh()}
      />
    </div>
  );
}

// MentoringStatCard 는 ./MentoringStatCard 로 분리 (V-1).
