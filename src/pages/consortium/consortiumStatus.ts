// bal24 v2 — 컨소시엄 상태/역할 → Badge variant 매핑
// 박경수님 사양: 구성중→default / 진행→primary / 완료→accent / 해산→secondary

import type { ConsortiumRole, ConsortiumStatus } from '../../types/database';
import type { BadgeProps } from '../../components/ui';

export const CONSORTIUM_STATUS_VALUES: ConsortiumStatus[] = ['구성중', '진행', '완료', '해산'];
// STEP-CONSORTIUM-REDESIGN A안 (박경수님 2026-05-27) — '주관/공동/위탁' → '총괄/참여' 2종.
export const CONSORTIUM_ROLE_VALUES: ConsortiumRole[] = ['총괄', '참여'];

// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 의뢰기관(주관기관) 검수 역할.
// 의뢰기관은 컨소시엄 멤버 아님 (발주처/감수자) → 별도 enum.
export const CONSORTIUM_LEAD_ROLE_VALUES = ['감수', '검수'] as const;
export type ConsortiumLeadRole = typeof CONSORTIUM_LEAD_ROLE_VALUES[number];

export function consortiumStatusToBadgeVariant(
  status: ConsortiumStatus,
): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case '구성중': return 'default';
    case '진행':   return 'primary';
    case '완료':   return 'accent';
    case '해산':   return 'secondary';
  }
}

export function roleToBadgeVariant(
  role?: ConsortiumRole | null,
): NonNullable<BadgeProps['variant']> {
  switch (role) {
    case '총괄': return 'primary';
    case '참여': return 'accent';
    default:     return 'default';
  }
}
