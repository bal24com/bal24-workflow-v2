// bal24 v2 — 외부공유 페이지 공용 유틸 (Stage 3-B-2-①)
// 무인증 — token으로 program_share + program 조회.

import { supabase } from '../../lib/supabase';
import type {
  Program, ProgramShare, ShareAudience,
  ProgramCurriculum, CurriculumStaff, ProgramFile,
} from '../../types/database';
import { detectStage } from '../programs/detail/share/shareUtils';
import type { ShareStage } from '../../types/database';

export interface ShareContext {
  share: ProgramShare;
  program: Program;
  stage: ShareStage;
  todayIso: string;
}

/** project_portals 토큰 기반 — 프로그램 없이 프로젝트 레벨 접근 */
export interface ProjectShareContext {
  type: 'project';
  projectId: string;
  projectName: string;
  programs: Program[];
}

const PROJECT_TOKEN_COL: Record<string, string> = {
  supporter:   'supporter_token',
  beneficiary: 'beneficiary_token',
  team:        'participant_token',
  staff:       'operator_token',
};

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

// 박경수님 2026-06-02 — audience 별 토큰 컬럼 매핑 (기존 3종 + 신규 4종)
const TOKEN_COLUMN: Record<ShareAudience, string> = {
  client:      'client_token',
  student:     'student_token',
  expert:      'expert_token',
  supporter:   'supporter_token',
  beneficiary: 'beneficiary_token',
  team:        'team_token',
  staff:       'staff_token',
};

/** token 검증 + program join + 단계 자동 판별 */
export async function fetchShareByToken(
  audience: ShareAudience,
  token: string,
): Promise<ShareContext | null> {
  if (!token) return null;
  const col = TOKEN_COLUMN[audience];

  const shareRes = await supabase
    .from('program_share')
    .select('*')
    .eq(col, token)
    .maybeSingle();
  if (shareRes.error) {
    console.error(`[share-portal/${audience}] program_share 조회 실패:`, shareRes.error.message);
    return null;
  }
  if (!shareRes.data) return null;
  const share = shareRes.data as ProgramShare;

  const programRes = await supabase
    .from('programs')
    .select('*')
    .eq('id', share.program_id)
    .maybeSingle();
  if (programRes.error) {
    console.error(`[share-portal/${audience}] program 조회 실패:`, programRes.error.message);
    return null;
  }
  if (!programRes.data) return null;
  const program = programRes.data as Program;

  const today = todayIso();
  return {
    share,
    program,
    stage: detectStage(today, share),
    todayIso: today,
  };
}

/** project_portals 토큰 기반 프로젝트 레벨 컨텍스트 조회 */
export async function fetchProjectShareByToken(
  audience: Extract<ShareAudience, 'supporter' | 'beneficiary' | 'team' | 'staff'>,
  token: string,
): Promise<ProjectShareContext | null> {
  if (!token) return null;
  const col = PROJECT_TOKEN_COL[audience];
  if (!col) return null;

  const { data: portal, error: pErr } = await supabase
    .from('project_portals')
    .select('id, project_id')
    .eq(col, token)
    .eq('is_active', true)
    .maybeSingle();
  if (pErr) {
    console.error(`[share-portal/${audience}] project_portals 조회 실패:`, pErr.message);
    return null;
  }
  if (!portal) return null;

  const portalRow = portal as { id: string; project_id: string };

  const { data: project, error: prErr } = await supabase
    .from('projects')
    .select('id, name')
    .eq('id', portalRow.project_id)
    .maybeSingle();
  if (prErr || !project) return null;
  const proj = project as { id: string; name: string };

  const { data: programs, error: pgErr } = await supabase
    .from('programs')
    .select('*')
    .eq('project_id', portalRow.project_id)
    .is('deleted_at', null)
    .order('start_date', { ascending: false });
  if (pgErr) {
    console.error(`[share-portal/${audience}] 프로그램 조회 실패:`, pgErr.message);
    return null;
  }

  return {
    type: 'project',
    projectId: proj.id,
    projectName: proj.name,
    programs: (programs ?? []) as ProjectShareContext['programs'],
  };
}

/** 컨소시엄 포털 데이터 (RPC get_consortium_portal 반환 형태) */
export interface ConsortiumPortalData {
  consortium: {
    id: string;
    name: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
    total_budget: number | null;
    description: string | null;
    lead_client_name: string | null;
  } | null;
  members: Array<{
    id: string;
    member_type: string;
    client_name: string | null;
    allocated_budget: number | null;
  }>;
  programs: Array<{
    id: string;
    name: string;
    type: string;
    status: string;
    start_date: string | null;
    end_date: string | null;
  }>;
  tasks: Array<{
    id: string;
    title: string;
    status: string;
    due_date: string | null;
  }>;
}

/** consortium_links 토큰 → 보안 RPC 로 컨소시엄 포털 데이터 조회 (토큰 무효 시 null) */
export async function fetchConsortiumShareByToken(
  roleType: Extract<ShareAudience, 'supporter' | 'beneficiary' | 'team' | 'staff'>,
  token: string,
): Promise<ConsortiumPortalData | null> {
  if (!token) return null;
  const { data, error } = await supabase.rpc('get_consortium_portal', {
    p_token: token,
    p_role: roleType,
  });
  if (error) {
    console.error('[share-portal/consortium] RPC 실패:', error.message);
    return null;
  }
  if (!data || typeof data !== 'object') return null;
  const d = data as ConsortiumPortalData;
  if (!d.consortium) return null;
  return d;
}

/** 커리큘럼 차시 fetch (program_id 기준) */
export async function fetchPublicCurriculum(programId: string): Promise<ProgramCurriculum[]> {
  const { data, error } = await supabase
    .from('program_curriculum')
    .select('id, program_id, session_no, title, content, session_date, duration, start_time, end_time, venue, created_at')
    .eq('program_id', programId)
    .order('session_no', { ascending: true });
  if (error) {
    console.error('[share-portal/client] 커리큘럼 조회 실패:', error.message);
    return [];
  }
  return (data as ProgramCurriculum[] | null) ?? [];
}

export interface PublicInstructor {
  id: string;
  name: string;
  source: 'external' | 'internal';
  career_summary: string | null;
  profile_image_url: string | null;
  /** 매칭된 차시 번호들 */
  session_nos: number[];
}

type StaffJoinRow = CurriculumStaff & {
  staff_pool: { id: string; name: string; career_summary: string | null; profile_image_url: string | null } | { id: string; name: string; career_summary: string | null; profile_image_url: string | null }[] | null;
  profile: { id: string; name: string; avatar_url: string | null; slogan: string | null } | { id: string; name: string; avatar_url: string | null; slogan: string | null }[] | null;
  curriculum: { id: string; session_no: number; program_id: string } | { id: string; session_no: number; program_id: string }[] | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

/**
 * 강사정보 fetch (role IN '강사','FT' 만)
 * ⚠️ 연락처·계좌·주민번호 절대 X — name·career_summary·profile_image_url 만
 */
export async function fetchPublicInstructors(programId: string): Promise<PublicInstructor[]> {
  const curRes = await supabase
    .from('program_curriculum')
    .select('id, session_no, program_id')
    .eq('program_id', programId);
  if (curRes.error) {
    console.error('[share-portal/client] 차시 조회 실패:', curRes.error.message);
    return [];
  }
  const curriculumIds = ((curRes.data as Array<{ id: string }> | null) ?? []).map((c) => c.id);
  if (curriculumIds.length === 0) return [];

  const staffRes = await supabase
    .from('curriculum_staff')
    .select(
      '*, staff_pool:staff_pool(id,name,career_summary,profile_image_url), profile:profiles(id,name,avatar_url,slogan), curriculum:program_curriculum(id,session_no,program_id)',
    )
    .in('curriculum_id', curriculumIds)
    .in('role', ['강사', 'FT']);
  if (staffRes.error) {
    console.error('[share-portal/client] 강사 조회 실패:', staffRes.error.message);
    return [];
  }

  const byPersonKey = new Map<string, PublicInstructor>();
  ((staffRes.data as StaffJoinRow[] | null) ?? []).forEach((s) => {
    const sp = pickOne(s.staff_pool);
    const pf = pickOne(s.profile);
    const cur = pickOne(s.curriculum);
    if (!cur) return;
    const isExternal = !!s.staff_pool_id;
    const key = isExternal ? `ext-${s.staff_pool_id}` : `int-${s.profile_id}`;
    if (!byPersonKey.has(key)) {
      byPersonKey.set(key, {
        id: key,
        name: isExternal ? sp?.name ?? '?' : pf?.name ?? '?',
        source: isExternal ? 'external' : 'internal',
        career_summary: isExternal
          ? sp?.career_summary ?? null
          : pf?.slogan ?? null,
        profile_image_url: isExternal
          ? sp?.profile_image_url ?? null
          : pf?.avatar_url ?? null,
        session_nos: [],
      });
    }
    const inst = byPersonKey.get(key);
    if (inst && !inst.session_nos.includes(cur.session_no)) {
      inst.session_nos.push(cur.session_no);
    }
  });

  return [...byPersonKey.values()].map((i) => ({
    ...i,
    session_nos: i.session_nos.sort((a, b) => a - b),
  }));
}

// 박경수님 2026-06-02 CLUB-15 — 동아리 멘토 (program_clubs.mentor_name) 공개 조회.
//   강사진 섹션에 멘토도 함께 노출. 이름·담당 동아리만 (연락처 X).
export interface PublicMentor {
  name: string;
  /** 담당 동아리 목록 */
  clubs: string[];
}

export async function fetchPublicMentors(programId: string): Promise<PublicMentor[]> {
  const { data, error } = await supabase
    .from('program_clubs')
    .select('mentor_name, club_name')
    .eq('program_id', programId)
    .not('mentor_name', 'is', null);
  if (error) {
    console.error('[share-portal] 멘토 조회 실패:', error.message);
    return [];
  }
  const byName = new Map<string, Set<string>>();
  ((data as Array<{ mentor_name: string | null; club_name: string }> | null) ?? []).forEach((r) => {
    const name = (r.mentor_name ?? '').trim();
    if (!name) return;
    const set = byName.get(name) ?? new Set<string>();
    if (r.club_name) set.add(r.club_name);
    byName.set(name, set);
  });
  return [...byName.entries()].map(([name, clubs]) => ({ name, clubs: [...clubs] }));
}

/** 교재 fetch — programs.notice_files (Stage 1에서 추가) */
export function getPublicMaterials(program: Program): ProgramFile[] {
  return program.notice_files ?? [];
}

/** 만족도 통계 fetch (read-only — 고객 결과 단계) */
export interface SurveySummaryItem {
  type: string;
  count: number;
  avg_rating: number | null;
}

export async function fetchPublicSurveySummary(programId: string): Promise<SurveySummaryItem[]> {
  const { data, error } = await supabase
    .from('surveys')
    .select('type, answers')
    .eq('program_id', programId);
  if (error) {
    console.error('[share-portal/client] 만족도 조회 실패:', error.message);
    return [];
  }

  type Row = { type: string; answers: Array<{ rating?: number }> | null };
  const rows = (data as Row[] | null) ?? [];
  const byType = new Map<string, { count: number; total: number; n: number }>();
  rows.forEach((r) => {
    const b = byType.get(r.type) ?? { count: 0, total: 0, n: 0 };
    b.count += 1;
    (r.answers ?? []).forEach((a) => {
      if (typeof a.rating === 'number') {
        b.total += a.rating;
        b.n += 1;
      }
    });
    byType.set(r.type, b);
  });

  return [...byType.entries()].map(([type, b]) => ({
    type,
    count: b.count,
    avg_rating: b.n > 0 ? Math.round((b.total / b.n) * 10) / 10 : null,
  }));
}

/** 수정요청 INSERT */
export async function submitEditRequest(
  programId: string,
  requesterName: string,
  requesterPhone: string | null,
  content: string,
): Promise<boolean> {
  if (!requesterName.trim() || !content.trim()) return false;
  const { error } = await supabase.from('program_edit_requests').insert({
    program_id: programId,
    requester_name: requesterName.trim(),
    requester_phone: requesterPhone?.trim() || null,
    content: content.trim(),
  });
  if (error) {
    console.error('[share-portal/client] 수정요청 INSERT 실패:', error.message);
    return false;
  }
  return true;
}
