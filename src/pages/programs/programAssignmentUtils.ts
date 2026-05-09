// bal24 v2 — 프로그램 담당사 배정 유틸 (STEP-PROGRAM-ASSIGNMENT)
// 라벨 / 컬러 / lead 중복 검증 / Supabase nested join pickOne.

import type { AssignmentRole, ProgramAssignment } from '../../types/database';

export const ASSIGNMENT_ROLE_LABEL: Record<AssignmentRole, string> = {
  lead:    '주담당',
  support: '협력',
};

export const ASSIGNMENT_ROLE_BADGE: Record<AssignmentRole, string> = {
  lead:    'bg-violet-100 text-violet-700 border-violet-200',
  support: 'bg-slate-100 text-slate-600 border-slate-300',
};

export interface AssignmentRow extends ProgramAssignment {
  /** Supabase nested join 결과 — clients(name) */
  clients?: { id: string; name: string } | { id: string; name: string }[] | null;
}

export interface AssignmentDisplay extends ProgramAssignment {
  client_name: string;
}

/** Supabase nested join 결과를 단일 객체로 안전 추출 */
export function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

/** 배정 행 + clients(name) join 결과를 화면용 단일 객체로 변환 */
export function flattenAssignment(row: AssignmentRow): AssignmentDisplay {
  const client = pickOne(row.clients);
  return {
    ...row,
    client_name: client?.name ?? '미지정',
  };
}

/**
 * lead 중복 방지 검증 — UI 레이어에서 INSERT 전 호출.
 * @returns true 면 추가 가능, false 면 lead 중복 (기존 lead 자동 demote 또는 거부)
 */
export function isLeadAvailable(
  assignments: ProgramAssignment[],
  newRole: AssignmentRole,
  excludeAssignmentId?: string,
): boolean {
  if (newRole !== 'lead') return true;
  return !assignments.some(
    (a) => a.role === 'lead' && a.id !== excludeAssignmentId,
  );
}
