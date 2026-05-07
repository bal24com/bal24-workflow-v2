// bal24 v2 — 커리큘럼 인력 매칭 공용 헬퍼
// 라벨 / 스타일 / 외부 참여의사 URL 빌더.

import type {
  CurriculumStaff,
  CurriculumStaffRole,
  CurriculumStaffStatus,
} from '../types/database';

export const CURRICULUM_STAFF_ROLES: CurriculumStaffRole[] = [
  '강사', 'FT', '멘토', 'TA', '운영진',
];

export const STAFF_ROLE_STYLE: Record<CurriculumStaffRole, string> = {
  강사: 'bg-violet-50 text-violet-700 border-violet-200',
  FT: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  멘토: 'bg-orange-50 text-orange-700 border-orange-200',
  TA: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  운영진: 'bg-slate-100 text-slate-600 border-slate-200',
};

export const STAFF_STATUS_LABEL: Record<CurriculumStaffStatus, string> = {
  pending: '대기',
  accepted: '수락',
  rejected: '거절',
};

export const STAFF_STATUS_STYLE: Record<CurriculumStaffStatus, string> = {
  pending: 'bg-slate-100 text-slate-500 border-slate-300',
  accepted: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  rejected: 'bg-rose-50 text-rose-600 border-rose-200',
};

/** 외부 참여의사 페이지 URL */
export function buildCurriculumInviteUrl(token: string): string {
  const base = typeof window !== 'undefined' ? window.location.origin : '';
  return `${base}/curriculum-invite/${token}`;
}

/** 매칭 소스 — 외부 전문가 vs 내부 직원 */
export function staffSource(s: Pick<CurriculumStaff, 'staff_pool_id' | 'profile_id'>): 'external' | 'internal' {
  return s.staff_pool_id ? 'external' : 'internal';
}
