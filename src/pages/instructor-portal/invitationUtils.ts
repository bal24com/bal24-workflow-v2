// bal24 v2 — 강사 초대 유틸

import type { InvitationRole, InvitationStatus } from '../../types/database';

const PUBLIC_BASE = 'https://bal24-workflow-v2.netlify.app';
export const INSTRUCTOR_FILES_BUCKET = 'instructor-files';

export function getInvitationUrl(token: string): string {
  return `${PUBLIC_BASE}/invitation/${token}`;
}

export function formatRole(role?: InvitationRole | null): string {
  switch (role) {
    case 'instructor':  return '강사';
    case 'ta':          return 'TA';
    case 'mentor':      return '멘토';
    case 'facilitator': return '진행자';
    default:             return '미지정';
  }
}

export const ROLE_VALUES: InvitationRole[] = ['instructor', 'ta', 'mentor', 'facilitator'];

export const STATUS_LABEL: Record<InvitationStatus, string> = {
  '대기': '대기중', '제출': '승인 대기', '수락': '수락', '거절': '거절', '교체됨': '교체됨',
};

export function fileSizeLabel(bytes?: number | null): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export function extractStoragePath(url: string): string | null {
  const marker = `/${INSTRUCTOR_FILES_BUCKET}/`;
  const idx = url.indexOf(marker);
  if (idx < 0) return null;
  return url.slice(idx + marker.length).split('?')[0];
}
