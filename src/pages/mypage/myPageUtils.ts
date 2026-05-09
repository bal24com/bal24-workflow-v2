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
    .select('id, name, role, my_token')
    .eq('my_token', token)
    .maybeSingle();
  if (error) {
    console.error('[mypage] 프로필 조회 실패:', error.message);
    return null;
  }
  return (data as ProfileRow | null) ?? null;
}

/**
 * 사용자가 참여하는 프로그램 (현재는 멘토링 배정 기반).
 * 추후 participant_applications 등 다른 참여 경로 추가 가능.
 */
export async function fetchMyPrograms(profileId: string): Promise<MyPageProgram[]> {
  // 멘토 배정
  const { data: mentorRows, error: mentorError } = await supabase
    .from('mentoring_assignments')
    .select(`
      program:programs!program_id(
        id, name, program_type, type, status, start_date, end_date, venue, entry_code
      )
    `)
    .eq('mentor_profile_id', profileId);
  if (mentorError) {
    console.error('[mypage] 참여 프로그램(멘토) 조회 실패:', mentorError.message);
  }

  // 멘티 배정 (mentee_ids UUID[])
  const { data: menteeRows, error: menteeError } = await supabase
    .from('mentoring_assignments')
    .select(`
      program:programs!program_id(
        id, name, program_type, type, status, start_date, end_date, venue, entry_code
      )
    `)
    .contains('mentee_ids', [profileId]);
  if (menteeError) {
    console.error('[mypage] 참여 프로그램(멘티) 조회 실패:', menteeError.message);
  }

  type Row = { program: ProgramJoinRow | ProgramJoinRow[] | null };
  const allRows: Row[] = [...((mentorRows ?? []) as Row[]), ...((menteeRows ?? []) as Row[])];

  // 중복 program 제거
  const seen = new Set<string>();
  const result: MyPageProgram[] = [];
  for (const row of allRows) {
    const p = pickOne<ProgramJoinRow>(row.program);
    if (!p || seen.has(p.id)) continue;
    seen.add(p.id);
    result.push({
      id: p.id,
      name: p.name,
      program_type: p.program_type,
      type: p.type,
      status: p.status,
      start_date: p.start_date,
      end_date: p.end_date,
      venue: p.venue,
      entry_code: p.entry_code,
      application_status: '승인',
    });
  }
  return result;
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
