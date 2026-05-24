// bal24 v2 — STEP-MENTORING-P3-APPROVE
// 멘토링 일지 승인·반려·제출 Supabase 호출 유틸.

import { supabase } from '../../../lib/supabase';

export interface ApprovalResult { error: string | null }

/** PM 이 일지를 승인 (submitted → approved). */
export async function approveMentoringLog(logId: string, approverId: string): Promise<ApprovalResult> {
  const { error } = await supabase.from('mentoring_logs').update({
    status: 'approved',
    approved_by: approverId,
    approved_at: new Date().toISOString(),
  }).eq('id', logId).eq('status', 'submitted');
  if (error) {
    console.error('[mentoring-approval] 승인 실패:', error.message);
    return { error: '승인 처리 중 오류가 발생했어요.' };
  }
  return { error: null };
}

/** PM 이 일지를 반려 (submitted → rejected). */
export async function rejectMentoringLog(logId: string, approverId: string, reason: string): Promise<ApprovalResult> {
  if (!reason.trim()) return { error: '반려 사유를 입력해 주세요.' };
  const { error } = await supabase.from('mentoring_logs').update({
    status: 'rejected',
    approved_by: approverId,
    approved_at: new Date().toISOString(),
    approval_note: reason.trim(),
  }).eq('id', logId).eq('status', 'submitted');
  if (error) {
    console.error('[mentoring-approval] 반려 실패:', error.message);
    return { error: '반려 처리 중 오류가 발생했어요.' };
  }
  return { error: null };
}

/** 강사가 일지를 제출 (draft|rejected → submitted). */
export async function submitMentoringLog(logId: string): Promise<ApprovalResult> {
  const { error } = await supabase.from('mentoring_logs').update({
    status: 'submitted',
    submitted_at: new Date().toISOString(),
    // 재제출 시 이전 반려 사유는 그대로 보존 (PM이 다시 검토 시 참고용)
  }).eq('id', logId).in('status', ['draft', 'rejected']);
  if (error) {
    console.error('[mentoring-approval] 제출 실패:', error.message);
    return { error: '제출 중 오류가 발생했어요.' };
  }
  return { error: null };
}
