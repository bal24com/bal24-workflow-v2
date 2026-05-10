// bal24 v2 — STEP-APPLICATION-MGMT 신청자 관리 헬퍼 (PM)
// fetch / 단건 상태 변경 / 일괄 상태 변경.

import { supabase } from '../../../lib/supabase';
import type { ParticipantApplication, ParticipantStatus } from '../../../types/application';

export const PARTICIPANT_STATUS_VALUES: ParticipantStatus[] = [
  'applied', 'reviewing', 'accepted', 'rejected', 'withdrawn', 'completed',
];

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  applied:   '신청',
  reviewing: '검토중',
  accepted:  '합격',
  rejected:  '탈락',
  withdrawn: '취소',
  completed: '수료',
};

export const PARTICIPANT_STATUS_TONE: Record<ParticipantStatus, string> = {
  applied:   'bg-slate-100 text-slate-700 border-slate-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-rose-50 text-rose-700 border-rose-200',
  withdrawn: 'bg-slate-50 text-slate-500 border-slate-200',
  completed: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

export async function fetchApplications(programId: string): Promise<ParticipantApplication[]> {
  const { data, error } = await supabase
    .from('participant_applications')
    .select('*')
    .eq('program_id', programId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[applications] 조회 실패:', error.message);
    return [];
  }
  return ((data ?? []) as ParticipantApplication[]);
}

export async function updateApplicationStatus(
  id: string,
  status: ParticipantStatus,
  reviewedBy: string | null,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('participant_applications')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('[applications] 상태 변경 실패:', error.message);
    const m = error.message.toLowerCase();
    if (m.includes('check') && m.includes('status')) {
      return { success: false, error: '허용되지 않은 상태 값이에요.' };
    }
    return { success: false, error: '상태 변경에 실패했어요.' };
  }
  return { success: true };
}

export async function bulkUpdateStatus(
  ids: string[],
  status: ParticipantStatus,
  reviewedBy: string | null,
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (ids.length === 0) return { success: true, updatedCount: 0 };
  const { error, count } = await supabase
    .from('participant_applications')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { count: 'exact' })
    .in('id', ids);
  if (error) {
    console.error('[applications] 일괄 상태 변경 실패:', error.message);
    return { success: false, updatedCount: 0, error: '일괄 상태 변경에 실패했어요.' };
  }
  return { success: true, updatedCount: count ?? ids.length };
}

/**
 * 신청자별 평균 평가 점수 (application_type='evaluation' 일 때만 의미).
 * applicationIds 가 비어 있으면 빈 Map 반환.
 */
export async function fetchAvgScores(
  applicationIds: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const result = new Map<string, { avg: number; count: number }>();
  if (applicationIds.length === 0) return result;

  const { data, error } = await supabase
    .from('evaluation_scores')
    .select('application_id, score, program_evaluator_id')
    .in('application_id', applicationIds);
  if (error) {
    console.error('[applications] 점수 조회 실패:', error.message);
    return result;
  }

  type Row = { application_id: string; score: number; program_evaluator_id: string };
  const grouped = new Map<string, { sum: number; evaluatorSet: Set<string> }>();
  ((data ?? []) as Row[]).forEach((r) => {
    const cur = grouped.get(r.application_id) ?? { sum: 0, evaluatorSet: new Set<string>() };
    cur.sum += Number(r.score);
    cur.evaluatorSet.add(r.program_evaluator_id);
    grouped.set(r.application_id, cur);
  });

  grouped.forEach((v, key) => {
    const count = v.evaluatorSet.size;
    const avg = count > 0 ? v.sum / count : 0;
    result.set(key, { avg: Math.round(avg * 10) / 10, count });
  });
  return result;
}
