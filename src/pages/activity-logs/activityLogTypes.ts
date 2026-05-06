// bal24 v2 — 통합 일지 공통 상수 / 헬퍼

import type { ActivityLogType } from '../../types/database';

export const LOG_TYPE_VALUES: ActivityLogType[] = [
  'mentoring', 'lecture', 'business_trip', 'ta', 'operation',
];

export const LOG_TYPE_LABELS: Record<ActivityLogType, string> = {
  mentoring: '멘토링',
  lecture: '출강',
  business_trip: '출장',
  ta: 'TA',
  operation: '운영보고서',
};

/** "HH:MM" 두 시각 차이를 시간 단위(소수점 1자리)로 반환. 잘못된 값이면 null. */
export function calcDurationHours(start: string, end: string): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if (Number.isNaN(sh) || Number.isNaN(sm) || Number.isNaN(eh) || Number.isNaN(em)) return null;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return null;
  return Math.round(((endMin - startMin) / 60) * 10) / 10;
}

const STORAGE_BUCKET = 'activity-files';
const PATH_MARKER = `/${STORAGE_BUCKET}/`;

/** publicUrl에서 storage path 추출 (Private 버킷 → 다운로드 시 signed URL 생성용) */
export function extractStoragePath(url: string): string | null {
  const idx = url.indexOf(PATH_MARKER);
  if (idx < 0) return null;
  return url.slice(idx + PATH_MARKER.length).split('?')[0];
}

export { STORAGE_BUCKET as ACTIVITY_FILES_BUCKET };
