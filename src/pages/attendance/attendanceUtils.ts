// bal24 v2 — 출석 유틸 (QR URL, 통계, 라벨)

import type { AttendanceRecord, AttendeeRole, CheckInMethod } from '../../types/database';

const PUBLIC_BASE = 'https://bal24-workflow-v2.netlify.app';

export function getCheckInUrl(sessionToken: string): string {
  return `${PUBLIC_BASE}/checkin/${sessionToken}`;
}

export type AttendanceSummary = {
  student: number;
  instructor: number;
  ta: number;
  total: number;
};

export function calcAttendanceSummary(records: Pick<AttendanceRecord, 'attendee_role'>[]): AttendanceSummary {
  return {
    student:    records.filter((r) => r.attendee_role === 'student').length,
    instructor: records.filter((r) => r.attendee_role === 'instructor').length,
    ta:         records.filter((r) => r.attendee_role === 'ta').length,
    total:      records.length,
  };
}

export const ROLE_LABELS: Record<AttendeeRole, string> = {
  student: '교육생',
  instructor: '강사',
  ta: 'TA',
};

export const METHOD_LABELS: Record<CheckInMethod, string> = {
  qr: 'QR',
  link: '링크',
  manual: '수동',
};

export function isSessionExpired(tokenExpiresAt?: string | null): boolean {
  if (!tokenExpiresAt) return false;
  return new Date(tokenExpiresAt).getTime() < Date.now();
}

export function formatTime(t?: string | null): string {
  if (!t) return '';
  // PostgreSQL time → "HH:MM:SS" 형태일 수 있음
  return t.slice(0, 5);
}
