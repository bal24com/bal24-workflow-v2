// bal24 v2 — 컨소시엄 상태/역할 → Badge variant 매핑
// 박경수님 사양: 구성중→default / 진행→primary / 완료→accent / 해산→secondary

import type { ConsortiumRole, ConsortiumStatus } from '../../types/database';
import type { BadgeProps } from '../../components/ui';

export const CONSORTIUM_STATUS_VALUES: ConsortiumStatus[] = ['구성중', '진행', '완료', '해산'];
export const CONSORTIUM_ROLE_VALUES: ConsortiumRole[] = ['주관', '공동', '위탁'];

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
    case '주관': return 'primary';
    case '공동': return 'accent';
    case '위탁': return 'secondary';
    default:     return 'default';
  }
}
