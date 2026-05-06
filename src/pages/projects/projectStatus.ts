// bal24 v2 — 프로젝트 상태 → Badge variant 매핑
// CLAUDE.md 디자인 시스템: 제안-회색 / 진행-바이올렛 / 정산-주황 / 종료-민트

import type { ProjectStatus } from '../../types/database';
import type { BadgeProps } from '../../components/ui';

export const PROJECT_STATUS_VALUES: ProjectStatus[] = ['제안', '진행', '정산', '종료'];

export function statusToBadgeVariant(status: ProjectStatus): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case '제안':
      return 'default';
    case '진행':
      return 'primary';
    case '정산':
      return 'secondary';
    case '종료':
      return 'accent';
  }
}
