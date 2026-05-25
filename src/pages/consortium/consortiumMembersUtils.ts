// bal24 v2 — 컨소시엄 폼 저장 유틸 (STEP-CON-B/C)
// 신규: consortiums INSERT + 주관사·참여사 INSERT
// 수정: consortiums UPDATE + 참여사 일괄 DELETE + INSERT (Q4=A)
// Supabase JS Client는 트랜잭션 미지원 → 순차 처리 + 오류 시 호출자 toast 안내.

import { supabase } from '../../lib/supabase';
import { makeMember, type MemberDraft } from './ConsortiumMembersField';
import type { ConsortiumRole, ConsortiumStatus } from '../../types/database';

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
}

/** 기존 참여사 행을 MemberDraft 형식으로 fetch */
export async function fetchMemberDrafts(consortiumId: string): Promise<{
  drafts: MemberDraft[];
  error?: string;
}> {
  const { data, error } = await supabase
    .from('consortium_members')
    .select('client_id, org_name, role, budget_ratio, responsibilities')
    .eq('consortium_id', consortiumId)
    .order('created_at', { ascending: true });

  if (error) {
    console.error('[consortium-members] fetch 실패:', error.message);
    return { drafts: [], error: error.message };
  }

  const rows = (data as MemberRow[] | null) ?? [];
  const drafts: MemberDraft[] = rows.map((r) => ({
    ...makeMember(),
    clientId: r.client_id ?? '',
    role: (r.role as MemberDraft['role']) ?? '',
    shareRatio: r.budget_ratio != null ? String(r.budget_ratio) : '',
    responsibilities: r.responsibilities ?? '',
  }));
  // fetch 결과가 0건이면 빈 행 1개로 시작
  return { drafts: drafts.length > 0 ? drafts : [makeMember()] };
}

interface ReplaceArgs {
  consortiumId: string;
  drafts: MemberDraft[];
  clientNameById: Map<string, string>;
}

/** 기존 행 일괄 DELETE → 빈 행 제외 INSERT (Q4=A 결정) */
export async function replaceMembers({
  consortiumId, drafts, clientNameById,
}: ReplaceArgs): Promise<{ error?: string; stage?: 'delete' | 'insert' }> {
  const { error: dErr } = await supabase
    .from('consortium_members')
    .delete()
    .eq('consortium_id', consortiumId);
  if (dErr) {
    console.error('[consortium-members] DELETE 실패:', dErr.message);
    return { error: dErr.message, stage: 'delete' };
  }

  const valid = drafts.filter((m) => m.clientId);
  if (valid.length === 0) return {};

  const rows = valid.map((m) => ({
    consortium_id: consortiumId,
    client_id: m.clientId,
    org_name: clientNameById.get(m.clientId) ?? '참여사',
    role: m.role || null,
    budget_ratio: m.shareRatio.trim() ? Number(m.shareRatio) : null,
    responsibilities: m.responsibilities.trim() || null,
  }));

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
  leadRole: ConsortiumRole;
  drafts: MemberDraft[];
  clientNameById: Map<string, string>;
}

/** 신규 등록 — consortiums INSERT + 주관사 자동 추가 + 참여사 INSERT */
export async function createConsortiumWithMembers({
  payload, leadRole, drafts, clientNameById,
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
  if (payload.lead_client_id) {
    memberRows.push({
      consortium_id: data.id,
      client_id: payload.lead_client_id,
      org_name: clientNameById.get(payload.lead_client_id) ?? '주관사',
      role: leadRole,
    });
  }
  for (const m of drafts) {
    if (!m.clientId) continue;
    memberRows.push({
      consortium_id: data.id,
      client_id: m.clientId,
      org_name: clientNameById.get(m.clientId) ?? '참여사',
      role: m.role || null,
      budget_ratio: m.shareRatio.trim() ? Number(m.shareRatio) : null,
      responsibilities: m.responsibilities.trim() || null,
    });
  }

  if (memberRows.length === 0) return { id: data.id };

  const { error: mErr } = await supabase.from('consortium_members').insert(memberRows);
  if (mErr) {
    console.error('[consortium] 참여사 저장 실패:', mErr.message);
    return { id: data.id, error: mErr.message, ctx: 'member' };
  }
  return { id: data.id };
}
