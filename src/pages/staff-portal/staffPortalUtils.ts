// bal24 v2 — STEP-STAFF-PORTAL-P1P2
// 강사 통합 포털 fetch 유틸 — 토큰 검증 + 담당 프로그램 + D-7 일정.
// 박경수님 지시문 컬럼명 보정 적용 (organization·name·curriculum_staff 2단 join).

import { supabase } from '../../lib/supabase';

export type StaffSource = 'staff_pool' | 'profile';

export interface StaffPortalIdentity {
  id: string;
  name: string;
  affiliation: string | null;   // staff_pool.organization 또는 profile.department
  sourceType: StaffSource;
  portalToken: string;
  /** STEP-STAFF-PORTAL-PIN — staff_pool만 PIN 사용. null이면 최초 설정 화면 */
  portalPin: string | null;
}

export interface StaffPortalProgram {
  id: string;
  name: string;
  status: string;
  start_date: string | null;
  end_date: string | null;
}

export interface StaffUpcomingSession {
  id: string;
  title: string;
  session_date: string;
  start_time: string | null;
  program_id: string;
}

/** 토큰 → 강사 식별 (staff_pool 우선, profiles 차순) */
export async function resolveStaffByToken(token: string): Promise<StaffPortalIdentity | null> {
  // staff_pool은 portal_pin 컬럼이 있을 수도 없을 수도 있어 fallback 처리
  const { data: sp, error: spErr } = await supabase
    .from('staff_pool')
    .select('id, name, organization, staff_portal_token, portal_pin')
    .eq('staff_portal_token', token)
    .maybeSingle();
  if (spErr) {
    const m = (spErr.message ?? '').toLowerCase();
    if (m.includes('portal_pin') || m.includes('does not exist')) {
      // portal_pin 컬럼이 아직 마이그레이션 안 된 경우 — PIN 없이 진행
      console.warn('[staff-portal] portal_pin 컬럼 미적용 — PIN 인증 비활성.');
      const { data: spFallback } = await supabase
        .from('staff_pool')
        .select('id, name, organization, staff_portal_token')
        .eq('staff_portal_token', token)
        .maybeSingle();
      if (spFallback) {
        return {
          id: spFallback.id,
          name: spFallback.name,
          affiliation: spFallback.organization ?? null,
          sourceType: 'staff_pool',
          portalToken: spFallback.staff_portal_token,
          portalPin: null,
        };
      }
    } else {
      console.warn('[staff-portal] staff_pool 조회 경고:', spErr.message);
    }
  }
  if (sp) {
    return {
      id: sp.id,
      name: sp.name,
      affiliation: sp.organization ?? null,
      sourceType: 'staff_pool',
      portalToken: sp.staff_portal_token,
      portalPin: (sp.portal_pin as string | null) ?? null,
    };
  }
  const { data: pr, error: prErr } = await supabase
    .from('profiles')
    .select('id, name, department, staff_portal_token')
    .eq('staff_portal_token', token)
    .maybeSingle();
  if (prErr) console.warn('[staff-portal] profiles 조회 경고:', prErr.message);
  if (pr) {
    return {
      id: pr.id,
      name: pr.name ?? '이름 없음',
      affiliation: (pr.department as string | null) ?? null,
      sourceType: 'profile',
      portalToken: pr.staff_portal_token,
      portalPin: null,  // 내부 직원은 PIN 미사용 (사이트 로그인으로 인증)
    };
  }
  return null;
}

/** 해당 강사의 담당 프로그램 목록 (curriculum_staff + mentoring_assignments + instructor_invitations 합집합) */
export async function fetchStaffPrograms(
  staffId: string,
  sourceType: StaffSource,
): Promise<StaffPortalProgram[]> {
  const programIds = new Set<string>();
  const staffCol = sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';
  const mentorCol = sourceType === 'staff_pool' ? 'mentor_pool_id' : 'mentor_profile_id';

  // 1) curriculum_staff → curriculum_id 수집
  const { data: cs, error: csErr } = await supabase
    .from('curriculum_staff')
    .select('curriculum_id')
    .eq(staffCol, staffId);
  if (csErr) console.warn('[staff-portal] curriculum_staff 조회 경고:', csErr.message);
  const curriculumIds = ((cs ?? []) as Array<{ curriculum_id: string }>).map((r) => r.curriculum_id);

  if (curriculumIds.length > 0) {
    // 2) program_curriculum → program_id 수집
    const { data: pc, error: pcErr } = await supabase
      .from('program_curriculum')
      .select('program_id')
      .in('id', curriculumIds);
    if (pcErr) console.warn('[staff-portal] program_curriculum 조회 경고:', pcErr.message);
    ((pc ?? []) as Array<{ program_id: string }>).forEach((r) => programIds.add(r.program_id));
  }

  // 3) mentoring_assignments → program_id 직접
  const { data: ma, error: maErr } = await supabase
    .from('mentoring_assignments')
    .select('program_id')
    .eq(mentorCol, staffId);
  if (maErr) console.warn('[staff-portal] mentoring_assignments 조회 경고:', maErr.message);
  ((ma ?? []) as Array<{ program_id: string }>).forEach((r) => r.program_id && programIds.add(r.program_id));

  // 4) STEP-INSTRUCTOR-MATCH-FIX — instructor_invitations 추가
  //    초빙 받았으나 아직 커리큘럼 배정 안 된 강사도 프로그램 보이도록.
  const { data: inv, error: invErr } = await supabase
    .from('instructor_invitations')
    .select('program_id')
    .eq(staffCol, staffId)
    .not('program_id', 'is', null);
  if (invErr) console.warn('[staff-portal] instructor_invitations 조회 경고:', invErr.message);
  ((inv ?? []) as Array<{ program_id: string | null }>).forEach((r) => {
    if (r.program_id) programIds.add(r.program_id);
  });

  if (programIds.size === 0) return [];

  // 5) programs 조회 (name 컬럼)
  const { data: programs, error: pErr } = await supabase
    .from('programs')
    .select('id, name, status, start_date, end_date')
    .in('id', Array.from(programIds))
    .order('start_date', { ascending: false });
  if (pErr) {
    console.error('[staff-portal] programs 조회 실패:', pErr.message);
    return [];
  }
  return (programs ?? []) as StaffPortalProgram[];
}

/** D-7 이내 다가오는 차시 일정 (curriculum_staff → program_curriculum 2단 join) */
export async function fetchUpcomingSchedule(
  staffId: string,
  sourceType: StaffSource,
): Promise<StaffUpcomingSession[]> {
  const today = new Date().toISOString().slice(0, 10);
  const d7Date = new Date(Date.now() + 7 * 86400000).toISOString().slice(0, 10);
  const staffCol = sourceType === 'staff_pool' ? 'staff_pool_id' : 'profile_id';

  // 1) 본인 curriculum_id 수집
  const { data: cs, error: csErr } = await supabase
    .from('curriculum_staff')
    .select('curriculum_id')
    .eq(staffCol, staffId);
  if (csErr) {
    console.warn('[staff-portal] 일정 curriculum_staff 조회 경고:', csErr.message);
    return [];
  }
  const ids = ((cs ?? []) as Array<{ curriculum_id: string }>).map((r) => r.curriculum_id);
  if (ids.length === 0) return [];

  // 2) D-7 이내 차시
  const { data: pc, error: pcErr } = await supabase
    .from('program_curriculum')
    .select('id, title, session_date, start_time, program_id')
    .in('id', ids)
    .gte('session_date', today)
    .lte('session_date', d7Date)
    .order('session_date', { ascending: true });
  if (pcErr) {
    console.warn('[staff-portal] 일정 program_curriculum 조회 경고:', pcErr.message);
    return [];
  }
  return ((pc ?? []) as StaffUpcomingSession[]);
}
