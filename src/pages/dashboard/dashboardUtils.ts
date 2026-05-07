// bal24 v2 — 대시보드 KPI 집계 유틸 (단계 3)
// Supabase 실데이터 집계 — KPI 4개 + 최근 프로젝트/지출 5개

import { supabase } from '../../lib/supabase';
import type { ProjectStatus, ProgramStatus } from '../../types/database';

export interface DashboardKpis {
  /** 진행 중 프로젝트 수 */
  activeProjectCount: number;
  /** 이번달 수입 합계 (원) */
  thisMonthIncome: number;
  /** 전월 수입 합계 (원) — 변화율 계산용 */
  prevMonthIncome: number;
  /** 미정산(대기) 지출 합계 (원) */
  pendingExpenseTotal: number;
  /** 미정산 지출 건수 */
  pendingExpenseCount: number;
  /** 진행 중 프로그램 수 */
  activeProgramCount: number;
}

export interface RecentProject {
  id: string;
  name: string;
  status: ProjectStatus;
  start_date: string | null;
  end_date: string | null;
  client_name: string | null;
}

export interface RecentExpense {
  id: string;
  description: string | null;
  gross_amount: number;
  expense_date: string;
  account_code: string;
  payee_name: string | null;
}

function pad(n: number): string {
  return String(n).padStart(2, '0');
}

function monthBounds(year: number, month: number): { start: string; end: string } {
  const start = `${year}-${pad(month)}-01`;
  const lastDay = new Date(year, month, 0).getDate();
  const end = `${year}-${pad(month)}-${pad(lastDay)}`;
  return { start, end };
}

export async function fetchDashboardKpis(): Promise<DashboardKpis> {
  const now = new Date();
  const thisYear = now.getFullYear();
  const thisMonth = now.getMonth() + 1;
  const prevYear = thisMonth === 1 ? thisYear - 1 : thisYear;
  const prevMonth = thisMonth === 1 ? 12 : thisMonth - 1;
  const thisRange = monthBounds(thisYear, thisMonth);
  const prevRange = monthBounds(prevYear, prevMonth);

  const ACTIVE_PROJECT_STATUS: ProjectStatus[] = ['진행', '정산'];
  const ACTIVE_PROGRAM_STATUS: ProgramStatus[] = ['진행'];

  const [projRes, thisIncomeRes, prevIncomeRes, pendingRes, programRes] = await Promise.all([
    supabase
      .from('projects')
      .select('id', { count: 'exact', head: true })
      .in('status', ACTIVE_PROJECT_STATUS),
    supabase
      .from('income')
      .select('amount')
      .is('deleted_at', null)
      .gte('received_at', thisRange.start)
      .lte('received_at', thisRange.end),
    supabase
      .from('income')
      .select('amount')
      .is('deleted_at', null)
      .gte('received_at', prevRange.start)
      .lte('received_at', prevRange.end),
    supabase
      .from('expenses')
      .select('gross_amount', { count: 'exact' })
      .eq('status', '대기')
      .is('deleted_at', null),
    supabase
      .from('programs')
      .select('id', { count: 'exact', head: true })
      .in('status', ACTIVE_PROGRAM_STATUS),
  ]);

  if (projRes.error) console.error('[dashboard] 프로젝트 카운트 실패:', projRes.error.message);
  if (thisIncomeRes.error) console.error('[dashboard] 이번달 수입 실패:', thisIncomeRes.error.message);
  if (prevIncomeRes.error) console.error('[dashboard] 전월 수입 실패:', prevIncomeRes.error.message);
  if (pendingRes.error) console.error('[dashboard] 미정산 지출 실패:', pendingRes.error.message);
  if (programRes.error) console.error('[dashboard] 프로그램 카운트 실패:', programRes.error.message);

  const sumAmount = (rows: Array<{ amount: number | string | null }> | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.amount ?? 0), 0);
  const sumGross = (rows: Array<{ gross_amount: number | string | null }> | null) =>
    (rows ?? []).reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);

  return {
    activeProjectCount: projRes.count ?? 0,
    thisMonthIncome: sumAmount(thisIncomeRes.data as Array<{ amount: number | string | null }> | null),
    prevMonthIncome: sumAmount(prevIncomeRes.data as Array<{ amount: number | string | null }> | null),
    pendingExpenseTotal: sumGross(pendingRes.data as Array<{ gross_amount: number | string | null }> | null),
    pendingExpenseCount: pendingRes.count ?? 0,
    activeProgramCount: programRes.count ?? 0,
  };
}

export async function fetchRecentProjects(limit = 5): Promise<RecentProject[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name, status, start_date, end_date, client:clients(id, name)')
    .order('created_at', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[dashboard] 최근 프로젝트 조회 실패:', error.message);
    return [];
  }

  return ((data as Array<{
    id: string;
    name: string;
    status: ProjectStatus;
    start_date: string | null;
    end_date: string | null;
    client: { id: string; name: string } | { id: string; name: string }[] | null;
  }> | null) ?? []).map((p) => {
    const client = Array.isArray(p.client) ? p.client[0] : p.client;
    return {
      id: p.id,
      name: p.name,
      status: p.status,
      start_date: p.start_date,
      end_date: p.end_date,
      client_name: client?.name ?? null,
    };
  });
}

export async function fetchRecentExpenses(limit = 5): Promise<RecentExpense[]> {
  const { data, error } = await supabase
    .from('expenses')
    .select('id, description, gross_amount, expense_date, account_code, payee:clients(id, name)')
    .is('deleted_at', null)
    .order('expense_date', { ascending: false })
    .limit(limit);

  if (error) {
    console.error('[dashboard] 최근 지출 조회 실패:', error.message);
    return [];
  }

  return ((data as Array<{
    id: string;
    description: string | null;
    gross_amount: number | string;
    expense_date: string;
    account_code: string;
    payee: { id: string; name: string } | { id: string; name: string }[] | null;
  }> | null) ?? []).map((e) => {
    const payee = Array.isArray(e.payee) ? e.payee[0] : e.payee;
    return {
      id: e.id,
      description: e.description,
      gross_amount: Number(e.gross_amount ?? 0),
      expense_date: e.expense_date,
      account_code: e.account_code,
      payee_name: payee?.name ?? null,
    };
  });
}

/** 변화율 계산 (전월 대비) — 0 분모 처리 */
export function computeChangeRate(current: number, previous: number): {
  rate: number;
  trend: 'up' | 'down' | 'flat';
} {
  if (previous === 0) {
    if (current === 0) return { rate: 0, trend: 'flat' };
    return { rate: 100, trend: 'up' };
  }
  const rate = Math.round(((current - previous) / previous) * 100);
  if (rate > 0) return { rate, trend: 'up' };
  if (rate < 0) return { rate: Math.abs(rate), trend: 'down' };
  return { rate: 0, trend: 'flat' };
}
