// bal24 v2 — 컨소시엄 폼 저장 유틸 (STEP-CON-B/C)
// 신규: consortiums INSERT + 주관사·참여사 INSERT
// 수정: consortiums UPDATE + 참여사 일괄 DELETE + INSERT (Q4=A)
// Supabase JS Client는 트랜잭션 미지원 → 순차 처리 + 오류 시 호출자 toast 안내.

import { supabase } from '../../lib/supabase';
import { makeMember, type MemberDraft } from './ConsortiumMembersField';
import type { ConsortiumStatus } from '../../types/database';

export type ErrorContext = 'insert' | 'update' | 'member';

export function translateConsortiumError(raw: string, ctx: ErrorContext): string {
  const m = raw.toLowerCase();
  if (m.includes('column') && m.includes('does not exist')) {
    return '컨소시엄 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return '저장 권한이 없어요. 관리자에게 문의해 주세요.';
  }
  if (ctx === 'member') return '참여사 저장 중 오류가 발생했어요. (컨소시엄은 등록되었어요)';
  if (ctx === 'update') return '컨소시엄 수정 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
  return '컨소시엄 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

interface MemberRow {
  client_id: string | null;
  org_name: string | null;
  role: string | null;
  budget_ratio: number | null;
  responsibilities: string | null;
  contact_name: string | null;
  contact_phone: string | null;
  contact_email: string | null;
  is_self: boolean | null;
}

/** 기존 참여사 행을 MemberDraft 형식으로 fetch — 박경수님 2026-05-27: 운영사(is_self=true) 제외, contact 필드 포함 */
export async function fetchMemberDrafts(consortiumId: string): Promise<{
  drafts: MemberDraft[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from('consortium_members')
    .select('client_id, org_name, role, budget_ratio, responsibilities, contact_name, contact_phone, contact_email, is_self')
    .eq('consortium_id', consortiumId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[consortium-members] fetch 실패:', error.message);
    return { drafts: [], error: error.message };
  }

  // 박경수님 2026-05-27 — 운영사(is_self=true) 행은 별도 섹션에서 관리하므로 참여사 목록에선 제외
  const rows = ((data as MemberRow[] | null) ?? []).filter((r) => !r.is_self);
  const drafts: MemberDraft[] = rows.map((r) => ({
    ...makeMember(),
    clientId: r.client_id ?? '',
    role: (r.role as MemberDraft['role']) ?? '',
    shareRatio: r.budget_ratio != null ? String(r.budget_ratio) : '',
    responsibilities: r.responsibilities ?? '',
    contactName: r.contact_name ?? '',
    contactPhone: r.contact_phone ?? '',
    contactEmail: r.contact_email ?? '',
  }));
  // fetch 결과가 0건이면 빈 행 1개로 시작
  return { drafts: drafts.length > 0 ? drafts : [makeMember()] };
}

// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 운영사(밸런스닷·총괄) 정보.
export interface OperatorDraft {
  clientId: string;            // clients.id (자사 또는 직접 선택)
  contactName: string;
  contactPhone: string;
  contactEmail: string;
}

export function makeEmptyOperator(): OperatorDraft {
  return { clientId: '', contactName: '', contactPhone: '', contactEmail: '' };
}

/** 운영사 행 (is_self=true·role='총괄') 1건을 별도 fetch */
export async function fetchOperatorDraft(consortiumId: string): Promise<OperatorDraft> {
  const { data, error } = await supabase
    .from('consortium_members')
    .select('client_id, contact_name, contact_phone, contact_email')
    .eq('consortium_id', consortiumId)
    .eq('is_self', true)
    .maybeSingle();
  if (error) {
    console.error('[consortium-members] operator fetch 실패:', error.message);
    return makeEmptyOperator();
  }
  if (!data) return makeEmptyOperator();
  return {
    clientId: data.client_id ?? '',
    contactName: data.contact_name ?? '',
    contactPhone: data.contact_phone ?? '',
    contactEmail: data.contact_email ?? '',
  };
}

// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 운영사 행 빌더 (is_self=true·role='총괄').
function buildOperatorRow(
  consortiumId: string,
  operator: OperatorDraft,
  clientNameById: Map<string, string>,
): Record<string, unknown> | null {
  if (!operator.clientId) return null;
  return {
    consortium_id: consortiumId,
    client_id: operator.clientId,
    org_name: clientNameById.get(operator.clientId) ?? '밸런스닷',
    role: '총괄',
    is_self: true,
    contact_name: operator.contactName.trim() || null,
    contact_phone: operator.contactPhone.trim() || null,
    contact_email: operator.contactEmail.trim() || null,
  };
}

function buildMemberRow(
  consortiumId: string,
  m: MemberDraft,
  clientNameById: Map<string, string>,
): Record<string, unknown> {
  return {
    consortium_id: consortiumId,
    client_id: m.clientId,
    org_name: clientNameById.get(m.clientId) ?? '참여사',
    role: m.role || null,
    budget_ratio: m.shareRatio.trim() ? Number(m.shareRatio) : null,
    responsibilities: m.responsibilities.trim() || null,
    contact_name: m.contactName.trim() || null,
    contact_phone: m.contactPhone.trim() || null,
    contact_email: m.contactEmail.trim() || null,
    is_self: false,
  };
}

interface ReplaceArgs {
  consortiumId: string;
  operator: OperatorDraft;
  drafts: MemberDraft[];
  clientNameById: Map<string, string>;
}

/** 기존 행 일괄 DELETE → 운영사 + 참여사 INSERT (의뢰기관 자동 추가 제거) */
export async function replaceMembers({
  consortiumId, operator, drafts, clientNameById,
}: ReplaceArgs): Promise<{ error?: string; stage?: 'delete' | 'insert' }> {
  const { error: dErr } = await supabase
    .from('consortium_members')
    .delete()
    .eq('consortium_id', consortiumId);
  if (dErr) {
    console.error('[consortium-members] DELETE 실패:', dErr.message);
    return { error: dErr.message, stage: 'delete' };
  }

  const rows: Array<Record<string, unknown>> = [];
  const op = buildOperatorRow(consortiumId, operator, clientNameById);
  if (op) rows.push(op);
  for (const m of drafts) {
    if (!m.clientId) continue;
    rows.push(buildMemberRow(consortiumId, m, clientNameById));
  }
  if (rows.length === 0) return {};

  const { error: iErr } = await supabase.from('consortium_members').insert(rows);
  if (iErr) {
    console.error('[consortium-members] INSERT 실패:', iErr.message);
    return { error: iErr.message, stage: 'insert' };
  }
  return {};
}

interface CreateArgs {
  payload: {
    name: string;
    project_id: string | null;
    status: ConsortiumStatus;
    lead_client_id: string | null;
    description: string | null;
    start_date: string | null;
    end_date: string | null;
    total_budget: number | null;
  };
  operator: OperatorDraft;
  drafts: MemberDraft[];
  clientNameById: Map<string, string>;
}

/** 신규 등록 — consortiums INSERT + 운영사·참여사 INSERT (의뢰기관 자동 추가 제거) */
export async function createConsortiumWithMembers({
  payload, operator, drafts, clientNameById,
}: CreateArgs): Promise<{ id?: string; error?: string; ctx?: ErrorContext }> {
  const { data, error: cErr } = await supabase
    .from('consortiums')
    .insert(payload)
    .select('id')
    .single();
  if (cErr || !data) {
    console.error('[consortium] 등록 실패:', cErr?.message);
    return { error: cErr?.message ?? '등록 실패', ctx: 'insert' };
  }

  const memberRows: Array<Record<string, unknown>> = [];
  const op = buildOperatorRow(data.id, operator, clientNameById);
  if (op) memberRows.push(op);
  for (const m of drafts) {
    if (!m.clientId) continue;
    memberRows.push(buildMemberRow(data.id, m, clientNameById));
  }

  if (memberRows.length === 0) return { id: data.id };

  const { error: mErr } = await supabase.from('consortium_members').insert(memberRows);
  if (mErr) {
    console.error('[consortium] 참여사 저장 실패:', mErr.message);
    return { id: data.id, error: mErr.message, ctx: 'member' };
  }
  return { id: data.id };
}
