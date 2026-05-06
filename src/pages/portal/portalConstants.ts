// bal24 v2 — 포털 공통 상수

import type {
  PortalAutoDataKey, PortalItemType, PortalStageTag,
} from '../../types/database';

export const PORTAL_ITEM_TYPES: PortalItemType[] = [
  'file_download', 'file_upload', 'feedback', 'approval', 'auto_data', 'tax_invoice',
];

export const ITEM_TYPE_LABELS: Record<PortalItemType, string> = {
  file_download: '파일 다운로드',
  file_upload:   '파일 업로드',
  feedback:      '의견 받기',
  approval:      '동의 받기',
  auto_data:     '자동 데이터',
  tax_invoice:   '세금계산서 요청',
};

export const AUTO_DATA_LABELS: Record<PortalAutoDataKey, string> = {
  applications: '신청자 현황',
  attendance:   '참여자 현황',
  curriculum:   '커리큘럼',
  report:       '결과보고서',
};

export const AUTO_DATA_KEYS: PortalAutoDataKey[] = ['applications', 'attendance', 'curriculum', 'report'];

export const STAGE_LABELS: Record<PortalStageTag, string> = {
  proposal:  '제안',
  contract:  '계약',
  operation: '운영',
  closing:   '마무리',
};

export const STAGE_VALUES: PortalStageTag[] = ['proposal', 'contract', 'operation', 'closing'];

export const PORTAL_FILES_BUCKET = 'portal-files';
const PUBLIC_BASE = 'https://bal24-workflow-v2.netlify.app';

export function getPortalUrl(token: string): string {
  return `${PUBLIC_BASE}/portal/${token}`;
}

export function makeTempUid(): string {
  return typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`;
}
