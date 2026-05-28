// PM 포털 발급·관리 훅 — program_portals / project_portals / programs.portal_intro CRUD.
// 박경수님 2026-05-28 STEP-PM-PORTAL-ADMIN.

import { supabase } from '../../lib/supabase';
import type { ProgramPortal, ProjectPortal } from '../../types/schoolPortal';

export interface PortalIntro {
  operator?: string;
  purpose?: string;
  schedule?: string;
  pm_contact?: string;
  inquiry?: string;
}

interface ProgramPortalListRow extends Omit<ProgramPortal, 'participant_ids'> {
  participant_ids: unknown;
  school?: { name: string } | { name: string }[] | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function toStringArray(v: unknown): string[] {
  if (!Array.isArray(v)) return [];
  return v.filter((x): x is string => typeof x === 'string');
}

/** 프로그램별 포털 목록 (학교명 join) */
export async function listProgramPortals(programId: string): Promise<Array<ProgramPortal & { school_name: string | null }>> {
  const { data, error } = await supabase
    .from('program_portals')
    .select(`
      id, program_id, client_id, portal_token, access_scope, team_label,
      participant_ids, is_active, created_at,
      school:clients!program_portals_client_id_fkey(name)
    `)
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[listProgramPortals] 실패:', error.message);
    return [];
  }
  return ((data ?? []) as ProgramPortalListRow[]).map((r) => ({
    id: r.id,
    program_id: r.program_id,
    client_id: r.client_id,
    portal_token: r.portal_token,
    access_scope: r.access_scope,
    team_label: r.team_label,
    participant_ids: toStringArray(r.participant_ids),
    is_active: r.is_active,
    created_at: r.created_at,
    school_name: pickOne(r.school)?.name ?? null,
  }));
}

/** 프로젝트 포털 목록 (supervisor) */
export async function listProjectPortals(projectId: string): Promise<ProjectPortal[]> {
  const { data, error } = await supabase
    .from('project_portals')
    .select('id, project_id, portal_token, access_scope, is_active, created_at')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[listProjectPortals] 실패:', error.message);
    return [];
  }
  return (data ?? []) as ProjectPortal[];
}

interface IssueProgramPortalArgs {
  programId: string;
  scope: 'school' | 'team';
  clientId: string | null;
  teamLabel: string | null;
}

/** 프로그램 포털 신규 발급 */
export async function issueProgramPortal(args: IssueProgramPortalArgs): Promise<{ portalToken?: string; error?: string }> {
  const { data, error } = await supabase
    .from('program_portals')
    .insert({
      program_id: args.programId,
      client_id: args.clientId,
      access_scope: args.scope,
      team_label: args.teamLabel?.trim() || null,
      is_active: true,
    })
    .select('portal_token')
    .single();
  if (error || !data) {
    console.error('[issueProgramPortal] 실패:', error?.message);
    return { error: '포털 발급에 실패했어요. 잠시 후 다시 시도해 주세요.' };
  }
  return { portalToken: data.portal_token };
}

/** 프로젝트(교육지원청) 포털 신규 발급 — title 필수 (STEP15 잔재) */
export async function issueProjectPortal(args: {
  projectId: string;
  title: string;
}): Promise<{ portalToken?: string; error?: string }> {
  const { data, error } = await supabase
    .from('project_portals')
    .insert({
      project_id: args.projectId,
      title: args.title.trim() || '교육지원청 포털',
      access_scope: 'supervisor',
      is_active: true,
    })
    .select('portal_token')
    .single();
  if (error || !data) {
    console.error('[issueProjectPortal] 실패:', error?.message);
    return { error: '교육지원청 포털 발급에 실패했어요.' };
  }
  return { portalToken: data.portal_token };
}

/** 포털 활성/비활성 토글 */
export async function toggleProgramPortal(portalId: string, isActive: boolean): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('program_portals')
    .update({ is_active: isActive })
    .eq('id', portalId);
  if (error) {
    console.error('[toggleProgramPortal] 실패:', error.message);
    return { error: '포털 상태 변경에 실패했어요.' };
  }
  return {};
}

/** 학교 clients 목록 — type='학교' 필터 (NULL 도 포함) */
export async function listSchoolClients(): Promise<Array<{ id: string; name: string }>> {
  const { data, error } = await supabase
    .from('clients')
    .select('id, name')
    .is('deleted_at', null)
    .order('name', { ascending: true });
  if (error) {
    console.error('[listSchoolClients] 실패:', error.message);
    return [];
  }
  return (data ?? []) as Array<{ id: string; name: string }>;
}

/** 학교 신규 등록 */
export async function createSchoolClient(name: string): Promise<{ id?: string; error?: string }> {
  if (!name.trim()) return { error: '학교명을 입력해 주세요.' };
  const { data, error } = await supabase
    .from('clients')
    .insert({ name: name.trim() })
    .select('id')
    .single();
  if (error || !data) {
    console.error('[createSchoolClient] 실패:', error?.message);
    return { error: '학교 등록에 실패했어요.' };
  }
  return { id: data.id };
}

/** 프로그램 portal_intro fetch */
export async function getPortalIntro(programId: string): Promise<{ intro: PortalIntro; programTitle: string }> {
  const { data, error } = await supabase
    .from('programs')
    .select('name, portal_intro')
    .eq('id', programId)
    .maybeSingle();
  if (error || !data) {
    console.error('[getPortalIntro] 실패:', error?.message);
    return { intro: {}, programTitle: '' };
  }
  const intro = (data.portal_intro as PortalIntro | null) ?? {};
  return { intro, programTitle: data.name ?? '' };
}

/** 프로그램 portal_intro 저장 */
export async function savePortalIntro(programId: string, intro: PortalIntro): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('programs')
    .update({ portal_intro: intro })
    .eq('id', programId);
  if (error) {
    console.error('[savePortalIntro] 실패:', error.message);
    return { error: '저장에 실패했어요. 잠시 후 다시 시도해 주세요.' };
  }
  return {};
}
