// 학교 담당자 포털 데이터 훅 — program_portals.portal_token 으로 진입.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL.

import { useCallback, useEffect, useState } from 'react';
import { supabase } from '../../lib/supabase';
import type { ProgramPortal, SchoolPortalContext } from '../../types/schoolPortal';

interface SchoolPortalState {
  loading: boolean;
  error: string | null;
  context: SchoolPortalContext | null;
}

interface ProgramRow {
  id: string;
  name: string | null;
  start_date: string | null;
  end_date: string | null;
  school_client_id: string | null;
  school: { name: string } | { name: string }[] | null;
}

interface PortalRow extends Omit<ProgramPortal, 'participant_ids'> {
  participant_ids: unknown;        // jsonb — 안전 변환
  programs: ProgramRow | ProgramRow[] | null;
}

function pickOne<T>(v: T | T[] | null): T | null {
  if (!v) return null;
  return Array.isArray(v) ? v[0] ?? null : v;
}

function toStringArray(jsonb: unknown): string[] {
  if (!jsonb) return [];
  if (Array.isArray(jsonb)) return jsonb.filter((x): x is string => typeof x === 'string');
  return [];
}

/** 토큰으로 program_portals + programs + clients(school) 조회 */
export function useSchoolPortal(token: string | undefined) {
  const [state, setState] = useState<SchoolPortalState>({
    loading: true, error: null, context: null,
  });

  const fetchContext = useCallback(async () => {
    if (!token) {
      setState({ loading: false, error: '잘못된 링크예요.', context: null });
      return;
    }
    setState((p) => ({ ...p, loading: true, error: null }));
    const { data, error } = await supabase
      .from('program_portals')
      .select(`
        id, program_id, client_id, portal_token, access_scope, team_label,
        participant_ids, is_active, created_at,
        programs!program_portals_program_id_fkey(
          id, name, start_date, end_date, school_client_id,
          school:clients!programs_school_client_id_fkey(name)
        )
      `)
      .eq('portal_token', token)
      .eq('is_active', true)
      .maybeSingle<PortalRow>();

    if (error) {
      console.error('[useSchoolPortal] 조회 실패:', error.message);
      setState({ loading: false, error: '포털 정보를 불러오지 못했어요.', context: null });
      return;
    }
    if (!data) {
      setState({ loading: false, error: '유효하지 않은 링크예요.', context: null });
      return;
    }
    const program = pickOne(data.programs);
    if (!program) {
      setState({ loading: false, error: '연결된 프로그램을 찾을 수 없어요.', context: null });
      return;
    }
    const school = pickOne(program.school);
    const portal: ProgramPortal = {
      id: data.id,
      program_id: data.program_id,
      client_id: data.client_id,
      portal_token: data.portal_token,
      access_scope: data.access_scope,
      team_label: data.team_label,
      participant_ids: toStringArray(data.participant_ids),
      is_active: data.is_active,
      created_at: data.created_at,
    };
    setState({
      loading: false,
      error: null,
      context: {
        portal,
        programId: program.id,
        programTitle: program.name ?? '제목 없음',
        programStartDate: program.start_date,
        programEndDate: program.end_date,
        schoolClientId: program.school_client_id,
        schoolName: school?.name ?? null,
      },
    });
  }, [token]);

  useEffect(() => { void fetchContext(); }, [fetchContext]);

  return { ...state, refetch: fetchContext };
}

/** 팀 링크 발급 — program_portals 신규 INSERT (access_scope='team') */
export async function createTeamPortal(args: {
  programId: string;
  clientId: string | null;
  teamLabel: string;
  participantIds: string[];
}): Promise<{ portalToken?: string; error?: string }> {
  const { data, error } = await supabase
    .from('program_portals')
    .insert({
      program_id: args.programId,
      client_id: args.clientId,
      access_scope: 'team',
      team_label: args.teamLabel.trim() || '팀',
      participant_ids: args.participantIds,
      is_active: true,
    })
    .select('portal_token')
    .single();
  if (error || !data) {
    console.error('[createTeamPortal] 실패:', error?.message);
    return { error: '팀 링크 발급에 실패했어요.' };
  }
  return { portalToken: data.portal_token };
}

/** 기존 팀 링크 목록 (해당 프로그램·access_scope=team) */
export async function listTeamPortals(programId: string): Promise<ProgramPortal[]> {
  const { data, error } = await supabase
    .from('program_portals')
    .select('id, program_id, client_id, portal_token, access_scope, team_label, participant_ids, is_active, created_at')
    .eq('program_id', programId)
    .eq('access_scope', 'team')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[listTeamPortals] 실패:', error.message);
    return [];
  }
  return (data ?? []).map((r) => ({
    ...(r as ProgramPortal),
    participant_ids: toStringArray((r as { participant_ids: unknown }).participant_ids),
  }));
}
