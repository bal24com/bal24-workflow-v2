// bal24 v2 — 프로젝트 상세 개요 탭 집계 유틸 (V7 → V2 이식)
// 재무 합계 / 이벤트 통합 / 활동 로그 / 참여자 미리보기

import { supabase } from '../../../lib/supabase';
import type {
  ActivityLog,
  ActivityLogType,
  Program,
  ScheduleEvent,
} from '../../../types/database';

export interface ProjectFinance {
  budget: number;
  incomeTotal: number;
  expenseTotal: number;
  pendingExpenseTotal: number;
  remaining: number;
  settledPct: number;
}

export interface ProjectMembersPreview {
  totalCount: number;
  recentNames: string[];
}

export interface ProjectEventsBundle {
  programs: Pick<Program, 'id' | 'name' | 'type' | 'status' | 'start_date' | 'end_date' | 'venue'>[];
  schedules: Pick<ScheduleEvent, 'id' | 'title' | 'event_date' | 'start_time' | 'all_day' | 'category'>[];
}

export type ActivityRow = Pick<
  ActivityLog,
  'id' | 'log_type' | 'title' | 'activity_date' | 'duration_hours' | 'attendee_count'
>;

const ACTIVITY_LOG_TYPE_LABEL: Record<ActivityLogType, string> = {
  mentoring: '멘토링',
  lecture: '강의',
  business_trip: '출장',
  ta: 'TA',
  operation: '운영',
  dispatch: '파견',
};

export function activityLogTypeLabel(t: ActivityLogType): string {
  return ACTIVITY_LOG_TYPE_LABEL[t] ?? t;
}

/** 재무 요약 — projects.budget + income(입금완료) 합 + expenses(지출 전체·대기 분리) */
export async function fetchProjectFinance(projectId: string): Promise<ProjectFinance> {
  const [projRes, incomeRes, expenseRes] = await Promise.all([
    supabase
      .from('projects')
      .select('budget')
      .eq('id', projectId)
      .maybeSingle(),
    supabase
      .from('income')
      .select('amount, status')
      .eq('project_id', projectId)
      .is('deleted_at', null),
    supabase
      .from('expenses')
      .select('gross_amount, status')
      .eq('project_id', projectId)
      .is('deleted_at', null),
  ]);

  if (projRes.error) console.error('[project-detail] 예산 조회 실패:', projRes.error.message);
  if (incomeRes.error) console.error('[project-detail] 수입 조회 실패:', incomeRes.error.message);
  if (expenseRes.error) console.error('[project-detail] 지출 조회 실패:', expenseRes.error.message);

  const budget = Number(projRes.data?.budget ?? 0);

  const incomeRows = (incomeRes.data ?? []) as Array<{ amount: number | string | null; status: string }>;
  const incomeTotal = incomeRows
    .filter((r) => r.status === '입금완료')
    .reduce((s, r) => s + Number(r.amount ?? 0), 0);

  const expenseRows = (expenseRes.data ?? []) as Array<{ gross_amount: number | string | null; status: string }>;
  const expenseTotal = expenseRows.reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);
  const pendingExpenseTotal = expenseRows
    .filter((r) => r.status === '대기')
    .reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);

  const remaining = budget - expenseTotal;
  const settledPct = budget > 0 ? Math.min(100, Math.round((incomeTotal / budget) * 100)) : 0;

  return { budget, incomeTotal, expenseTotal, pendingExpenseTotal, remaining, settledPct };
}

/** 참여자 미리보기 — project_members 카운트 + 최근 등록 N명 이름 */
export async function fetchProjectMembersPreview(
  projectId: string,
  limit = 4,
): Promise<ProjectMembersPreview> {
  const { data, error, count } = await supabase
    .from('project_members')
    .select('id, profile:profiles(id,name)', { count: 'exact' })
    .eq('project_id', projectId)
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[project-detail] 참여자 조회 실패:', error.message);
    return { totalCount: 0, recentNames: [] };
  }

  type Row = { id: string; profile: { id: string; name: string } | { id: string; name: string }[] | null };
  const rows = (data as Row[] | null) ?? [];
  const recentNames = rows
    .map((r) => (Array.isArray(r.profile) ? r.profile[0]?.name : r.profile?.name))
    .filter((n): n is string => typeof n === 'string' && n.length > 0);

  return { totalCount: count ?? rows.length, recentNames };
}

/** 이벤트 통합 — 이 프로젝트에 묶인 programs + schedule_events */
export async function fetchProjectEvents(projectId: string): Promise<ProjectEventsBundle> {
  const [programsRes, schedulesRes] = await Promise.all([
    supabase
      .from('programs')
      .select('id, name, type, status, start_date, end_date, venue')
      .eq('project_id', projectId)
      .order('start_date', { ascending: true }),
    supabase
      .from('schedule_events')
      .select('id, title, event_date, start_time, all_day, category')
      .eq('project_id', projectId)
      .order('event_date', { ascending: true }),
  ]);

  if (programsRes.error) console.error('[project-detail] 프로그램 조회 실패:', programsRes.error.message);
  if (schedulesRes.error) console.error('[project-detail] 일정 조회 실패:', schedulesRes.error.message);

  return {
    programs: (programsRes.data as ProjectEventsBundle['programs'] | null) ?? [],
    schedules: (schedulesRes.data as ProjectEventsBundle['schedules'] | null) ?? [],
  };
}

/** 활동 로그 — activity_logs.project_id 최근 N개 */
export async function fetchProjectActivities(projectId: string, limit = 8): Promise<ActivityRow[]> {
  const { data, error } = await supabase
    .from('activity_logs')
    .select('id, log_type, title, activity_date, duration_hours, attendee_count')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('activity_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[project-detail] 활동 로그 조회 실패:', error.message);
    return [];
  }

  return (data as ActivityRow[] | null) ?? [];
}
