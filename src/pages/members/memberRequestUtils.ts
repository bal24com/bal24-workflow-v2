// 회원 가입신청 fetch / approve / reject 유틸

import { supabase } from '../../lib/supabase';
import type { MemberRequest, MemberRequestStatus } from '../../types/database';

export interface ApproveResult { success: boolean; error?: string; emailFailed?: boolean }
export interface RejectResult { success: boolean; error?: string }

export const REQUEST_STATUS_LABEL: Record<MemberRequestStatus, string> = {
  pending: '대기중',
  approved: '승인',
  rejected: '거절',
};

export const REQUEST_STATUS_TONE: Record<MemberRequestStatus, string> = {
  pending:  'bg-slate-100 text-slate-700 border-slate-200',
  approved: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  rejected: 'bg-orange-50 text-orange-700 border-orange-200',
};

export async function fetchMemberRequests(): Promise<MemberRequest[]> {
  const { data, error } = await supabase
    .from('member_requests')
    .select('*')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[member-requests] 조회 실패:', error.message);
    return [];
  }
  return (data ?? []) as MemberRequest[];
}

/**
 * 가입신청 승인 — member_invitations INSERT + send-invite Edge Function 호출 후
 * member_requests.status='approved'.
 * 기본 role 은 'staff'. 향후 모달에서 선택 가능하도록 확장할 수 있음.
 */
export async function approveMemberRequest(
  req: MemberRequest,
  reviewerUserId: string | null,
): Promise<ApproveResult> {
  const email = req.email.trim().toLowerCase();
  if (!email) return { success: false, error: '이메일이 비어 있어 초대할 수 없어요.' };

  // 1) 중복 초대 확인
  const { data: existing, error: existErr } = await supabase
    .from('member_invitations')
    .select('id, status')
    .eq('email', email)
    .is('deleted_at', null)
    .maybeSingle();
  if (existErr) {
    console.error('[member-requests] 중복 확인 실패:', existErr.message);
    return { success: false, error: '초대 확인 중 오류가 발생했어요.' };
  }

  let invitationId: string | null = (existing as { id?: string } | null)?.id ?? null;

  // 2) 신규면 INSERT
  if (!invitationId) {
    const { data: inv, error: invErr } = await supabase
      .from('member_invitations')
      .insert({
        email,
        role: 'staff',
        department: req.department ?? null,
        position: req.position ?? null,
        invited_by: reviewerUserId,
      })
      .select('id')
      .single();
    if (invErr || !inv) {
      const m = invErr?.message?.toLowerCase() ?? '';
      console.error('[member-requests] 초대 INSERT 실패:', invErr?.message);
      if (m.includes('row-level security') || m.includes('permission')) {
        return { success: false, error: '초대 권한이 없어요. ADMIN 만 승인할 수 있어요.' };
      }
      return { success: false, error: '초대 생성 중 오류가 발생했어요.' };
    }
    invitationId = (inv as { id: string }).id;
  }

  // 3) member_requests 상태 업데이트
  const { error: updErr } = await supabase
    .from('member_requests')
    .update({
      status: 'approved',
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', req.id);
  if (updErr) {
    console.error('[member-requests] 상태 업데이트 실패:', updErr.message);
    return { success: false, error: '신청 상태 업데이트에 실패했어요.' };
  }

  // 4) 초대 이메일 발송 (실패해도 승인은 완료)
  const { error: fnErr } = await supabase.functions.invoke('send-invite', {
    body: { invitation_id: invitationId },
  });
  if (fnErr) {
    console.error('[member-requests] 초대 메일 발송 실패:', fnErr.message);
    return { success: true, emailFailed: true };
  }
  return { success: true };
}

export async function rejectMemberRequest(
  reqId: string,
  reason: string,
  reviewerUserId: string | null,
): Promise<RejectResult> {
  if (!reason.trim()) return { success: false, error: '거절 사유를 입력해 주세요.' };
  const { error } = await supabase
    .from('member_requests')
    .update({
      status: 'rejected',
      reject_reason: reason.trim(),
      reviewed_by: reviewerUserId,
      reviewed_at: new Date().toISOString(),
    })
    .eq('id', reqId);
  if (error) {
    console.error('[member-requests] 거절 처리 실패:', error.message);
    return { success: false, error: '거절 처리 중 오류가 발생했어요.' };
  }
  return { success: true };
}
