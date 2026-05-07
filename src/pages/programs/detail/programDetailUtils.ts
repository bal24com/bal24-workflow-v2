// bal24 v2 — 프로그램 상세 집계·fetch 유틸 (V7 → V2 이식 1단계)

import { supabase } from '../../../lib/supabase';
import type {
  ActivityLog,
  ActivityLogType,
  AttendanceSession,
  Curriculum,
  FormType,
  InstructorInvitation,
  InvitationStatus,
  PublicForm,
  Survey,
  SurveyAnswer,
} from '../../../types/database';
import type { ParticipantStatus, RecruitForm } from '../../../types/application';

export interface ProgramKpis {
  applicationCount: number;
  acceptedApplicationCount: number;
  attendanceSessionCount: number;
  attendanceCheckedInCount: number;
  activityLogCount: number;
  surveyCount: number;
  surveyAvgRating: number | null;
}

export type CurriculumRow = Pick<
  Curriculum,
  'id' | 'day_num' | 'session_num' | 'title' | 'start_time' | 'end_time' | 'venue'
>;

export type ApplicationRow = {
  id: string;
  name: string;
  phone: string;
  status: ParticipantStatus;
  created_at: string;
};

export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  applied: '신청',
  reviewing: '검토중',
  accepted: '승인',
  rejected: '반려',
  withdrawn: '철회',
  completed: '완료',
};

export type RecruitRow = Pick<
  RecruitForm,
  'id' | 'recruit_type' | 'title' | 'deadline' | 'is_active' | 'form_token'
>;

export type SessionRow = Pick<
  AttendanceSession,
  'id' | 'title' | 'session_date' | 'start_time' | 'end_time' | 'session_token' | 'check_in_open'
> & { record_count: number };

export type ActivityRow = Pick<
  ActivityLog,
  'id' | 'log_type' | 'title' | 'activity_date' | 'duration_hours' | 'attendee_count'
>;

export type FormRow = Pick<
  PublicForm,
  'id' | 'title' | 'form_type' | 'form_token' | 'is_active' | 'open_at' | 'close_at'
> & { application_count: number };

export type InvitationRow = Pick<
  InstructorInvitation,
  'id' | 'name' | 'role' | 'status' | 'phone' | 'email' | 'lecture_fee' | 'portal_token'
>;

const ACTIVITY_LOG_TYPE_LABEL: Record<ActivityLogType, string> = {
  mentoring: '멘토링',
  lecture: '강의',
  business_trip: '출장',
  ta: 'TA',
  operation: '운영',
};
export function activityLogTypeLabel(t: ActivityLogType): string {
  return ACTIVITY_LOG_TYPE_LABEL[t] ?? t;
}

const FORM_TYPE_LABEL: Record<FormType, string> = {
  application: '신청',
  survey: '설문',
  feedback: '피드백',
};
export function formTypeLabel(t: FormType): string {
  return FORM_TYPE_LABEL[t] ?? t;
}

const INVITATION_STATUS_LABEL: Record<InvitationStatus, string> = {
  대기: '대기',
  수락: '수락',
  거절: '거절',
  완료: '완료',
};
export function invitationStatusLabel(s: InvitationStatus): string {
  return INVITATION_STATUS_LABEL[s] ?? s;
}

/** 프로그램 단건 + 프로젝트 join */
export async function fetchProgramOne(programId: string) {
  const { data, error } = await supabase
    .from('programs')
    .select('*, project:projects(id,name,status)')
    .eq('id', programId)
    .maybeSingle();
  if (error) {
    console.error('[program-detail] 프로그램 조회 실패:', error.message);
    return null;
  }
  return data;
}

/** 통계 KPI — 1회 fetch (session id 목록은 records 카운트에 사용) */
export async function fetchProgramKpis(programId: string): Promise<ProgramKpis> {
  const [applicationsRes, acceptedRes, sessionsRes, logsRes, surveysRes] = await Promise.all([
    supabase
      .from('participant_applications')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', programId),
    supabase
      .from('participant_applications')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', programId)
      .eq('status', 'accepted'),
    supabase
      .from('attendance_sessions')
      .select('id')
      .eq('program_id', programId),
    supabase
      .from('activity_logs')
      .select('id', { count: 'exact', head: true })
      .eq('program_id', programId)
      .is('deleted_at', null),
    supabase
      .from('surveys')
      .select('answers')
      .eq('program_id', programId),
  ]);

  if (applicationsRes.error) console.error('[program-detail] 신청 카운트 실패:', applicationsRes.error.message);
  if (acceptedRes.error) console.error('[program-detail] 승인 카운트 실패:', acceptedRes.error.message);
  if (sessionsRes.error) console.error('[program-detail] 출석세션 카운트 실패:', sessionsRes.error.message);
  if (logsRes.error) console.error('[program-detail] 일지 카운트 실패:', logsRes.error.message);
  if (surveysRes.error) console.error('[program-detail] 설문 응답 조회 실패:', surveysRes.error.message);

  const sessionIds = ((sessionsRes.data as Array<{ id: string }> | null) ?? []).map((s) => s.id);
  let attendanceCheckedInCount = 0;
  if (sessionIds.length > 0) {
    const recordsRes = await supabase
      .from('attendance_records')
      .select('id', { count: 'exact', head: true })
      .in('session_id', sessionIds);
    if (recordsRes.error) {
      console.error('[program-detail] 출석 기록 카운트 실패:', recordsRes.error.message);
    } else {
      attendanceCheckedInCount = recordsRes.count ?? 0;
    }
  }

  const surveyRows = (surveysRes.data as Array<{ answers: SurveyAnswer[] | null }> | null) ?? [];
  let totalRating = 0;
  let ratingCount = 0;
  surveyRows.forEach((row) => {
    (row.answers ?? []).forEach((a) => {
      if (typeof a.rating === 'number') {
        totalRating += a.rating;
        ratingCount += 1;
      }
    });
  });

  return {
    applicationCount: applicationsRes.count ?? 0,
    acceptedApplicationCount: acceptedRes.count ?? 0,
    attendanceSessionCount: sessionIds.length,
    attendanceCheckedInCount,
    activityLogCount: logsRes.count ?? 0,
    surveyCount: surveyRows.length,
    surveyAvgRating: ratingCount > 0 ? Math.round((totalRating / ratingCount) * 10) / 10 : null,
  };
}

/** 커리큘럼 차시 (program_id 기준) */
export async function fetchProgramCurriculum(programId: string, limit = 5): Promise<CurriculumRow[]> {
  const { data, error } = await supabase
    .from('curriculum')
    .select('id, day_num, session_num, title, start_time, end_time, venue')
    .eq('program_id', programId)
    .order('day_num', { ascending: true })
    .order('session_num', { ascending: true })
    .limit(limit);
  if (error) {
    console.error('[program-detail] 커리큘럼 조회 실패:', error.message);
    return [];
  }
  return (data as CurriculumRow[] | null) ?? [];
}

/** 강사 초빙 (program_id 기준) */
export async function fetchProgramInvitations(programId: string): Promise<InvitationRow[]> {
  const { data, error } = await supabase
    .from('instructor_invitations')
    .select('id, name, role, status, phone, email, lecture_fee, portal_token')
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[program-detail] 강사 초빙 조회 실패:', error.message);
    return [];
  }
  return (data as InvitationRow[] | null) ?? [];
}

/** 교육생 신청 (program_id 기준) */
export async function fetchProgramApplications(programId: string, limit = 20): Promise<ApplicationRow[]> {
  const { data, error } = await supabase
    .from('participant_applications')
    .select('id, name, phone, status, created_at')
    .eq('program_id', programId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[program-detail] 교육생 신청 조회 실패:', error.message);
    return [];
  }
  return (data as ApplicationRow[] | null) ?? [];
}

/** 모집 공고 (program_id 기준) */
export async function fetchProgramRecruits(programId: string): Promise<RecruitRow[]> {
  const { data, error } = await supabase
    .from('recruit_forms')
    .select('id, recruit_type, title, deadline, is_active, form_token')
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[program-detail] 모집 공고 조회 실패:', error.message);
    return [];
  }
  return (data as RecruitRow[] | null) ?? [];
}

/** 출석 세션 + 체크인 수 */
export async function fetchProgramSessions(programId: string): Promise<SessionRow[]> {
  const { data, error } = await supabase
    .from('attendance_sessions')
    .select(
      'id, title, session_date, start_time, end_time, session_token, check_in_open, records:attendance_records(id)',
    )
    .eq('program_id', programId)
    .order('session_date', { ascending: true });
  if (error) {
    console.error('[program-detail] 출석 세션 조회 실패:', error.message);
    return [];
  }
  type Row = Omit<SessionRow, 'record_count'> & { records: { id: string }[] };
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    session_date: r.session_date,
    start_time: r.start_time,
    end_time: r.end_time,
    session_token: r.session_token,
    check_in_open: r.check_in_open,
    record_count: r.records?.length ?? 0,
  }));
}

/** 활동 일지 (최근 N건) */
export async function fetchProgramActivities(programId: string, limit = 8): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, log_type, title, activity_date, duration_hours, attendee_count')
    .eq('program_id', programId)
    .is('deleted_at', null)
    .order('activity_date', { ascending: false })
    .limit(limit);
  if (error) {
    console.error('[program-detail] 활동 일지 조회 실패:', error.message);
    return [];
  }
  return (data as ActivityRow[] | null) ?? [];
}

/** 외부 폼 (설문·피드백·신청) + 응답 수 */
export async function fetchProgramForms(programId: string): Promise<FormRow[]> {
  const { data, error } = await supabase
    .from('public_forms')
    .select(
      'id, title, form_type, form_token, is_active, open_at, close_at, applications:form_applications(id)',
    )
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[program-detail] 외부 폼 조회 실패:', error.message);
    return [];
  }
  type Row = Omit<FormRow, 'application_count'> & { applications: { id: string }[] };
  return ((data as Row[] | null) ?? []).map((r) => ({
    id: r.id,
    title: r.title,
    form_type: r.form_type,
    form_token: r.form_token,
    is_active: r.is_active,
    open_at: r.open_at,
    close_at: r.close_at,
    application_count: r.applications?.length ?? 0,
  }));
}

/** 만족도 응답 (program_id 기준, type 별 평균) */
export interface SurveySummary {
  total: number;
  byType: Record<string, { count: number; avgRating: number | null }>;
}
export async function fetchProgramSurveySummary(programId: string): Promise<SurveySummary> {
  const { data, error } = await supabase
    .from('surveys')
    .select('type, answers')
    .eq('program_id', programId);
  if (error) {
    console.error('[program-detail] 만족도 응답 조회 실패:', error.message);
    return { total: 0, byType: {} };
  }
  const rows = (data as Array<Pick<Survey, 'type' | 'answers'>> | null) ?? [];
  const byType: SurveySummary['byType'] = {};
  rows.forEach((row) => {
    if (!byType[row.type]) byType[row.type] = { count: 0, avgRating: null };
    const bucket = byType[row.type];
    bucket.count += 1;
    let total = 0;
    let n = 0;
    (row.answers ?? []).forEach((a) => {
      if (typeof a.rating === 'number') {
        total += a.rating;
        n += 1;
      }
    });
    if (n > 0) {
      const prevAvg = bucket.avgRating ?? 0;
      const prevCount = bucket.count - 1;
      const newAvg = total / n;
      bucket.avgRating =
        prevCount === 0 ? newAvg : (prevAvg * prevCount + newAvg) / bucket.count;
      bucket.avgRating = Math.round(bucket.avgRating * 10) / 10;
    }
  });
  return { total: rows.length, byType };
}
