// bal24 v2 — 태스크 상태 → Badge variant 매핑
// CLAUDE.md: 인식-회색 / 실행-바이올렛 / 검토-주황 / 완료-초록(success)

import type { TaskStatus } from '../../../types/database';
import type { BadgeProps } from '../../../components/ui';

export const TASK_STATUS_VALUES: TaskStatus[] = ['인식', '실행', '검토', '완료'];

export function taskStatusToBadgeVariant(
  status: TaskStatus,
): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case '인식':
      return 'default';
    case '실행':
      return 'primary';
    case '검토':
      return 'secondary';
    case '완료':
      return 'success';
  }
}
