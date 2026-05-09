// bal24 v2 — STEP-MEMBER-INVITE 공용 유틸 (라벨·배지·URL)
// STEP-INVITE-UTILS-CLEANUP: ROLE_LABELS 는 constants/roles.ts 단일 출처에서 관리.

import type { MemberInvitationStatus } from '../../types/database';
// 기존 import { ROLE_LABELS } from '../members/memberInviteUtils' 호환을 위해
// constants 의 정의를 그대로 re-export (점진적 마이그레이션용 — 추후 직접 import 권장)
export { ROLE_LABELS } from '../../constants/roles';

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
