// 회계사무소 검토 세션 fetch 유틸 — STEP-ACCOUNTING-ALL P4

import { supabase } from '../../lib/supabase';
import type {
  AccountingReview, AccountingReviewItem, AccountingReviewStatus,
} from '../../types/database';

export type ReviewRow = AccountingReview & {
  itemsCount?: number;
  approvedCount?: number;
  revisionCount?: number;
};

export const REVIEW_STATUS_LABEL: Record<AccountingReviewStatus, string> = {
  pending: '검토 대기',
  reviewing: '검토 중',
  completed: '검토 완료',
};

export const REVIEW_STATUS_STYLE: Record<AccountingReviewStatus, string> = {
  pending:   'bg-slate-50 text-slate-600 border-slate-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  completed: 'bg-emerald-50 text-emerald-700 border-emerald-200',
};

/** PM 측 — 전체 세션 목록 */
export async function fetchReviews(): Promise<ReviewRow[]> {
  const { data, error } = await supabase
    .from('accounting_reviews')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[accounting-reviews] 목록 조회 실패:', error.message);
    throw new Error('검토 세션 목록을 불러오지 못했어요.');
  }
  return ((data ?? []) as ReviewRow[]);
}

/** 외부 포털 — token 으로 세션 + 항목 조회 (anon RLS 통과) */
export async function fetchReviewByToken(token: string): Promise<{
  review: AccountingReview;
  items: AccountingReviewItem[];
} | null> {
  const { data: review, error: rErr } = await supabase
    .from('accounting_reviews')
    .select('*')
    .eq('token', token)
    .gt('expires_at', new Date().toISOString())
    .maybeSingle();
  if (rErr) {
    console.error('[accounting-reviews] token 조회 실패:', rErr.message);
    return null;
  }
  if (!review) return null;

  const { data: items, error: iErr } = await supabase
    .from('accounting_review_items')
    .select('*')
    .eq('review_id', (review as AccountingReview).id);
  if (iErr) console.error('[accounting-reviews] items 조회 실패:', iErr.message);

  return {
    review: review as AccountingReview,
    items: (items as AccountingReviewItem[] | null) ?? [],
  };
}

/** 외부 포털 — 항목 검토 결과 upsert */
export async function upsertReviewItem(
  reviewId: string,
  payrollExpenseId: string,
  status: 'approved' | 'revision',
  note: string | null,
): Promise<string | null> {
  const { error } = await supabase
    .from('accounting_review_items')
    .upsert({
      review_id: reviewId,
      payroll_expense_id: payrollExpenseId,
      review_status: status,
      revision_note: note,
      reviewed_at: new Date().toISOString(),
    }, { onConflict: 'review_id,payroll_expense_id' });
  if (error) {
    console.error('[accounting-reviews] item upsert 실패:', error.message);
    return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  }
  return null;
}

/** 외부 포털 — 세션 상태 변경 (reviewing / completed) */
export async function updateReviewStatus(
  reviewId: string,
  status: AccountingReviewStatus,
): Promise<string | null> {
  const patch: Partial<AccountingReview> = { status };
  if (status === 'completed') patch.completed_at = new Date().toISOString();
  const { error } = await supabase
    .from('accounting_reviews')
    .update(patch)
    .eq('id', reviewId);
  if (error) {
    console.error('[accounting-reviews] 상태 변경 실패:', error.message);
    return '상태 변경에 실패했어요.';
  }
  return null;
}
