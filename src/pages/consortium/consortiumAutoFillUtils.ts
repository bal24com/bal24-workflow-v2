// bal24 v2 — STEP-CONSORTIUM-FORM-AI-AUTOFILL (박경수님 2026-05-27)
// 컨소시엄 폼 — AI 자동채우기 결과를 폼 상태에 매칭하는 헬퍼.

import type { Client, ConsortiumRole } from '../../types/database';
import { makeMember, type MemberDraft } from './ConsortiumMembersField';
import { makeEmptyOperator, type OperatorDraft } from './consortiumMembersUtils';
import type { AutoFillResult } from './hooks/useConsortiumAutoFill';

type ClientOption = Pick<Client, 'id' | 'name'>;

/** clients 목록에서 이름 부분일치로 ID 찾기 */
export function matchClientId(
  clients: ClientOption[],
  name: string | null | undefined,
): string {
  if (!name) return '';
  const norm = name.trim();
  if (!norm) return '';
  const found = clients.find(
    (c) => c.name === norm || c.name.includes(norm) || norm.includes(c.name),
  );
  return found?.id ?? '';
}

/** AI 가 반환한 role 을 우리 ConsortiumRole 로 정규화 */
export function matchRole(role: string | null | undefined): ConsortiumRole | '' {
  if (role === '총괄' || role === '참여') return role;
  return '';
}

export interface FormPatchInput {
  name: string;
  startDate: string;
  endDate: string;
  totalBudget: string;
  description: string;
  leadClientId: string;
}

/** AI 결과를 폼 상태 patch 로 변환 — 기존 값이 비어 있는 필드만 채움 */
export function buildFormPatch(
  prev: FormPatchInput,
  result: AutoFillResult,
  clients: ClientOption[],
): FormPatchInput {
  return {
    name:         prev.name        || (result.name        ?? ''),
    startDate:    prev.startDate   || (result.start_date  ?? ''),
    endDate:      prev.endDate     || (result.end_date    ?? ''),
    totalBudget:  prev.totalBudget || (result.total_budget != null ? String(result.total_budget) : ''),
    description:  prev.description || (result.description ?? ''),
    leadClientId: prev.leadClientId || matchClientId(clients, result.lead_org_name),
  };
}

/** AI 결과의 members 배열을 MemberDraft[] 로 변환 — operator 는 제외 */
export function buildMemberDrafts(
  result: AutoFillResult,
  clients: ClientOption[],
): MemberDraft[] {
  if (!result.members || result.members.length === 0) return [];
  return result.members
    // 박경수님 2026-05-27 — operator 와 동일한 회사면 참여사에 중복 추가 안 함
    .filter((m) => !result.operator_name || !m.org_name?.includes(result.operator_name))
    .map((m) => ({
      ...makeMember(),
      clientId: matchClientId(clients, m.org_name),
      role: matchRole(m.role),
      shareRatio: m.share_rate != null ? String(m.share_rate) : '',
      responsibilities: m.responsibilities ?? '',
      contactName: m.contact_name ?? '',
      contactPhone: m.contact_phone ?? '',
      contactEmail: m.contact_email ?? '',
    }));
}

/** AI 결과에서 운영사 정보(OperatorDraft) 추출 — operator_name + members 의 총괄 항목에서 contact 매칭 */
export function buildOperatorDraft(
  result: AutoFillResult,
  clients: ClientOption[],
): OperatorDraft {
  const op = makeEmptyOperator();
  if (!result.operator_name) return op;
  op.clientId = matchClientId(clients, result.operator_name);
  // members 배열에 같은 회사가 있으면 contact 정보 복사
  const matched = (result.members ?? []).find(
    (m) => m.org_name?.includes(result.operator_name ?? '__') || result.operator_name?.includes(m.org_name ?? '__'),
  );
  if (matched) {
    op.contactName = matched.contact_name ?? '';
    op.contactPhone = matched.contact_phone ?? '';
    op.contactEmail = matched.contact_email ?? '';
  }
  return op;
}

/** AI 결과로 채워진 항목 개수 계산 (토스트용) */
export function countFilledFields(result: AutoFillResult): number {
  const base = [
    result.name, result.start_date, result.end_date, result.total_budget,
    result.description, result.lead_org_name, result.operator_name,
  ].filter((v) => v != null && v !== '').length;
  return base + (result.members?.length ?? 0);
}

/** members 배열이 "비어 있는 기본 1행만" 상태인지 — AI 결과로 안전하게 덮어쓸 수 있는지 판정 */
export function isOnlyEmptyDefault(members: MemberDraft[]): boolean {
  if (members.length !== 1) return false;
  const m = members[0];
  return !m?.clientId && !m?.role && !m?.shareRatio;
}
