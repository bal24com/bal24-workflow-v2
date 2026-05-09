// bal24 v2 — STEP-MEMBER-INVITE 공용 유틸 (라벨·배지·URL)

import type { MemberInvitationStatus } from '../../types/database';

/** 역할 한글 라벨 (소문자 role 값 → 한글 라벨) */
export const ROLE_LABELS: Record<string, string> = {
  admin:   '관리자',
  pm:      'PM',
  staff:   '직원',
  finance: '재무',
  partner: '파트너',
  member:  '멤버',
};

export const ROLE_OPTIONS_FOR_INVITE: { value: string; label: string }[] = [
  { value: 'staff',   label: '직원' },
  { value: 'pm',      label: 'PM' },
  { value: 'finance', label: '재무' },
  { value: 'partner', label: '파트너' },
  { value: 'member',  label: '멤버' },
  { value: 'admin',   label: '관리자' },
];

export const INVITATION_STATUS_BADGE: Record<MemberInvitationStatus, { label: string; className: string }> = {
  pending:  { label: '대기중', className: 'bg-yellow-100 text-yellow-700 border-yellow-200' },
  accepted: { label: '수락됨', className: 'bg-emerald-100 text-emerald-700 border-emerald-200' },
  expired:  { label: '만료됨', className: 'bg-slate-100 text-slate-500 border-slate-200' },
};

/** 초대 URL 생성 (상대 → 절대) */
export function buildInviteUrl(token: string): string {
  if (typeof window === 'undefined') return `/invite/member/${token}`;
  return `${window.location.origin}/invite/member/${token}`;
}

/**
 * 만료 여부 계산 — DB 의 expires_at 과 현재 시간 비교.
 * status 가 이미 'expired' 면 그대로 true.
 */
export function isInvitationExpired(expiresAt: string, status: MemberInvitationStatus): boolean {
  if (status === 'expired') return true;
  if (status === 'accepted') return false;
  return new Date(expiresAt).getTime() < Date.now();
}
