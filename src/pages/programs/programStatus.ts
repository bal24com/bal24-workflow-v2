// bal24 v2 — 프로그램 상태/유형 → Badge variant 매핑
// 박경수님 사양: 준비→default / 진행→primary / 완료→accent / 취소→secondary

import type { ProgramStatus, ProgramType } from '../../types/database';
import type { BadgeProps } from '../../components/ui';

export const PROGRAM_STATUS_VALUES: ProgramStatus[] = ['준비', '진행', '완료', '취소'];
export const PROGRAM_TYPE_VALUES: ProgramType[] = ['교육', '캠프', '행사', '기타'];

export function programStatusToBadgeVariant(
  status: ProgramStatus,
): NonNullable<BadgeProps['variant']> {
  switch (status) {
    case '준비':
      return 'default';
    case '진행':
      return 'primary';
    case '완료':
      return 'accent';
    case '취소':
      return 'secondary';
  }
}
