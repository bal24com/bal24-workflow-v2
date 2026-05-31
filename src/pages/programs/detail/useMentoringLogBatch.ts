// 박경수님 2026-05-29 — 멘토링 일지 일괄·개인 인쇄 hook (MentoringTab V-1 슬림화용).

import { useState } from 'react';
import type { useToast } from '../../../contexts/ToastContext';
import type { MentoringAssignment } from '../../../types/mentoring';
import { getMentorName } from '../../../types/mentoring';
import {
  fetchAllLogsForPdfByAssignment,
  fetchAllLogsForPdfByAssignments,
} from './mentoringLogPdfFetch';
import { printMultipleMentoringLogs } from './mentoringLogPdf';

export type LogBatchLoading = string | 'all' | null;

export function useMentoringLogBatch(toast: ReturnType<typeof useToast>) {
  const [loading, setLoading] = useState<LogBatchLoading>(null);

  async function downloadMentor(a: MentoringAssignment): Promise<void> {
    setLoading(a.id);
    try {
      const logs = await fetchAllLogsForPdfByAssignment(a.id);
      if (logs.length === 0) {
        toast.error(`${getMentorName(a)}님 작성한 일지가 아직 없어요.`);
        return;
      }
      printMultipleMentoringLogs(logs);
      toast.success(`${getMentorName(a)}님 일지 ${logs.length}건 — 인쇄창에서 "PDF 로 저장" 을 선택해 주세요.`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[useMentoringLogBatch] 멘토 일지 일괄 인쇄 실패:', raw);
      toast.error(raw || '일지 인쇄 중 오류가 발생했어요.');
    } finally {
      setLoading(null);
    }
  }

  async function downloadAll(assignments: MentoringAssignment[]): Promise<void> {
    if (assignments.length === 0) { toast.error('멘토가 없어요.'); return; }
    if (!window.confirm(`멘토 ${assignments.length}명의 모든 일지를 한 번에 인쇄할까요?`)) return;
    setLoading('all');
    try {
      const logs = await fetchAllLogsForPdfByAssignments(assignments.map((a) => a.id));
      if (logs.length === 0) {
        toast.error('작성된 일지가 없어요.');
        return;
      }
      printMultipleMentoringLogs(logs);
      toast.success(`전체 일지 ${logs.length}건 — 인쇄창에서 "PDF 로 저장" 을 선택해 주세요.`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[useMentoringLogBatch] 일지 일괄 인쇄 실패:', raw);
      toast.error(raw || '일지 인쇄 중 오류가 발생했어요.');
    } finally {
      setLoading(null);
    }
  }

  return { loading, downloadMentor, downloadAll };
}
