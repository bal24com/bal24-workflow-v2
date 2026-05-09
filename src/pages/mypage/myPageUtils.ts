// bal24 v2 — STEP-MYPAGE fetch 헬퍼
// V-2 보정: 명세의 (row: any) 무분별 사용 → 정식 인터페이스 + pickOne 헬퍼.

import { supabase } from '../../lib/supabase';
import type {
  MyPageProfile, MyPageProgram, MyPageMentoring,
} from '../../types/mypage';

/** Supabase nested select 가 단일/배열 둘 다 반환할 수 있음 — 단일로 정규화 */
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

interface ProfileRow {
  id: string;
  name: string;
  role: string | null;
  my_token: string;
  email: string | null;
  consortium_member_id: string | null;
}

interface ProgramJoinRow {
  id: string;
  name: string;
  program_type: string | null;
  type: string | null;
  status: string | null;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
  entry_code: string | null;
}

interface SessionStub { id: string; submitted_at: string | null }
interface MentorProfileStub { name: string | null }

interface MentoringMenteeRow {
  id: string;
  program_id: string;
  meet_type: string | null;
  session_count: number | null;
  mentee_access_token: string | null;
  mentor_profile: MentorProfileStub | MentorProfileStub[] | null;
  sessions: SessionStub[] | null;
  program: { name: string | null } | { name: string | null }[] | null;
}

interface MentoringMentorRow {
  id: string;
  program_id: string;
  meet_type: string | null;
  session_count: number | null;
  mentor_access_token: string | null;
  sessions: SessionStub[] | null;
  program: { name: string | null } | { name: string | null }[] | null;
}

export async function fetchMyProfile(token: string): Promise<MyPageProfile | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('id, name, role, my_token, email, consortium_member_id')
    .eq('my_token', token)
    .maybeSingle();
  if (error) {
    console.error('[mypage] 프로필 조회 실패:', error.message);
    return null;
  }
  return (data as ProfileRow | null) ?? null;
}

/**
 * STEP-MYPAGE-EXPAND — 사용자 참여 프로그램 3출처 통합.
 * 우선순위: pm > mentor > applicant (이미 등록된 program_id 는 덮어쓰지 않음).
 *
 * @param profileId          profiles.id
 * @param profileEmail       profiles.email (participant_applications 매칭용)
 * @param consortiumMemberId profiles.consortium_member_id (PM 배정 출처용)
 *
 * V2 보정: program_assignments 는 profile_id 가 아니라 consortium_member_id FK.
 *          profiles.consortium_member_id 가 NULL 이면 PM 출처는 빈 결과.
 */
export async function fetchMyPrograms(
  profileId: string,
  profileEmail: string | null,
  consortiumMemberId: string | null,
): Promise<MyPageProgram[]> {
  const programMap = new Map<string, MyPageProgram>();

  // ── 출처 1: program_assignments (PM 배정) ──────────────────
  // V2 실측: program_assignments 는 consortium_member_id FK.
  // profiles.consortium_member_id → consortium_members.id ← program_assignments.consortium_member_id
  if (consortiumMemberId) {
    const { data: assignData, error: assignError } = await supabase
      .from('program_assignments')
      .select(`
        program:programs!program_id(
          id, name, program_type, type, status, start_date, end_date, venue, entry_code
        )
      `)
      .eq('consortium_member_id', consortiumMemberId);
    if (assignError) {
      console.error('[mypage] PM 배정 프로그램 조회 실패:', assignError.message);
    }
    type Row = { program: ProgramJoinRow | ProgramJoinRow[] | null };
    ((assignData ?? []) as Row[]).forEach((row) => {
      const p = pickOne<ProgramJoinRow>(row.program);
      if (!p?.id || programMap.has(p.id)) return;
      programMap.set(p.id, {
        id: p.id, name: p.name,
        program_type: p.program_type, type: p.type,
        status: p.status, start_date: p.start_date, end_date: p.end_date,
        venue: p.venue, entry_code: p.entry_code,
        application_status: null,
        participation_role: 'pm',
      });
    });
  }

  // ── 출처 2: mentoring_assignments (멘토 배정 + 멘티) ───────
  // mentor_profile_id 일치 OR mentee_ids 배열 포함
  const [mentorRes, menteeRes] = await Promise.all([
    supabase
      .from('mentoring_assignments')
      .select(`
        program:programs!program_id(
          id, name, program_type, type, status, start_date, end_date, venue, entry_code
        )
      `)
      .eq('mentor_profile_id', profileId),
    supabase
      .from('mentoring_assignments')
      .select(`
        program:programs!program_id(
          id, name, program_type, type, status, start_date, end_date, venue, entry_code
        )
      `)
      .contains('mentee_ids', [profileId]),
  ]);
  if (mentorRes.error) {
    console.error('[mypage] 멘토 배정 프로그램 조회 실패:', mentorRes.error.message);
  }
  if (menteeRes.error) {
    console.error('[mypage] 멘티 배정 프로그램 조회 실패:', menteeRes.error.message);
  }

  type MentRow = { program: ProgramJoinRow | ProgramJoinRow[] | null };
  const mentoringRows: MentRow[] = [
    ...((mentorRes.data ?? []) as MentRow[]),
    ...((menteeRes.data ?? []) as MentRow[]),
  ];
  mentoringRows.forEach((row) => {
    const p = pickOne<ProgramJoinRow>(row.program);
    if (!p?.id || programMap.has(p.id)) return; // pm 우선
    programMap.set(p.id, {
      id: p.id, name: p.name,
      program_type: p.program_type, type: p.type,
      status: p.status, start_date: p.start_date, end_date: p.end_date,
      venue: p.venue, entry_code: p.entry_code,
      application_status: '승인',
      participation_role: 'mentor',
    });
  });

  // ── 출처 3: participant_applications (모집 신청) ──────────
  if (profileEmail) {
    interface AppRow {
      status: string | null;
      program: ProgramJoinRow | ProgramJoinRow[] | null;
    }
    const { data: appData, error: appError } = await supabase
      .from('participant_applications')
      .select(`
        status,
        program:programs!program_id(
          id, name, program_type, type, status, start_date, end_date, venue, entry_code
        )
      `)
      .eq('email', profileEmail);
    if (appError) {
      console.error('[mypage] 모집 신청 프로그램 조회 실패:', appError.message);
    }
    ((appData ?? []) as AppRow[]).forEach((row) => {
      const p = pickOne<ProgramJoinRow>(row.program);
      if (!p?.id || programMap.has(p.id)) return; // pm/mentor 우선
      programMap.set(p.id, {
        id: p.id, name: p.name,
        program_type: p.program_type, type: p.type,
        status: p.status, start_date: p.start_date, end_date: p.end_date,
        venue: p.venue, entry_code: p.entry_code,
        application_status: row.status ?? null,
        participation_role: 'applicant',
      });
    });
  }

  // ── start_date 내림차순 정렬 ──────────────────────────────
  return Array.from(programMap.values()).sort((a, b) => {
    if (!a.start_date && !b.start_date) return 0;
    if (!a.start_date) return 1;
    if (!b.start_date) return -1;
    return b.start_date.localeCompare(a.start_date);
  });
}

export async function fetchMyMentorings(profileId: string): Promise<MyPageMentoring[]> {
  // 멘티로 배정된 것
  const { data: menteeData, error: menteeError } = await supabase
    .from('mentoring_assignments')
    .select(`
      id, program_id, meet_type, session_count, mentee_access_token,
      mentor_profile:profiles!mentor_profile_id(name),
      sessions:mentoring_sessions(id, submitted_at),
      program:programs!program_id(name)
    `)
    .contains('mentee_ids', [profileId]);
  if (menteeError) {
    console.error('[mypage] 멘티 배정 조회 실패:', menteeError.message);
  }

  // 멘토로 배정된 것
  const { data: mentorData, error: mentorError } = await supabase
    .from('mentoring_assignments')
    .select(`
      id, program_id, meet_type, session_count, mentor_access_token,
      sessions:mentoring_sessions(id, submitted_at),
      program:programs!program_id(name)
    `)
    .eq('mentor_profile_id', profileId);
  if (mentorError) {
    console.error('[mypage] 멘토 배정 조회 실패:', mentorError.message);
  }

  const result: MyPageMentoring[] = [];

  ((menteeData ?? []) as MentoringMenteeRow[]).forEach((row) => {
    const program = pickOne<{ name: string | null }>(row.program);
    const mentorProfile = pickOne<MentorProfileStub>(row.mentor_profile);
    const completed = (row.sessions ?? []).filter((s) => !!s.submitted_at).length;
    result.push({
      id: row.id,
      program_id: row.program_id,
      program_name: program?.name ?? null,
      meet_type: row.meet_type,
      session_count: row.session_count,
      completed_count: completed,
      role: 'mentee',
      mentor_name: mentorProfile?.name ?? null,
      mentor_token: null,
      mentee_token: row.mentee_access_token,
    });
  });

  ((mentorData ?? []) as MentoringMentorRow[]).forEach((row) => {
    const program = pickOne<{ name: string | null }>(row.program);
    const completed = (row.sessions ?? []).filter((s) => !!s.submitted_at).length;
    result.push({
      id: row.id,
      program_id: row.program_id,
      program_name: program?.name ?? null,
      meet_type: row.meet_type,
      session_count: row.session_count,
      completed_count: completed,
      role: 'mentor',
      mentor_name: null,
      mentor_token: row.mentor_access_token,
      mentee_token: null,
    });
  });

  return result;
}

/** 미제출 피드백 카운트 (멘티로서) — 본인이 제출한 mentoring_feedbacks 가 없는 완료 세션 수 */
export async function countPendingFeedback(profileId: string, name: string): Promise<number> {
  const { data, error } = await supabase
    .from('mentoring_assignments')
    .select(`
      sessions:mentoring_sessions(
        id, submitted_at,
        feedbacks:mentoring_feedbacks(id, mentee_name)
      )
    `)
    .contains('mentee_ids', [profileId]);
  if (error) {
    console.error('[mypage] 미제출 피드백 카운트 실패:', error.message);
    return 0;
  }
  type FbRow = { id: string; mentee_name: string | null };
  type SessRow = { id: string; submitted_at: string | null; feedbacks?: FbRow[] | null };
  type AssignRow = { sessions?: SessRow[] | null };
  let pending = 0;
  ((data ?? []) as AssignRow[]).forEach((row) => {
    (row.sessions ?? []).forEach((s) => {
      if (!s.submitted_at) return;
      const submitted = (s.feedbacks ?? []).some((f) => f.mentee_name === name);
      if (!submitted) pending += 1;
    });
  });
  return pending;
}
