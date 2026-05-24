// 수입/계약 fetch · 통계 유틸 — ContractsPage·DetailDrawer 공용
// STEP-ACCOUNTING-ALL P2

import { supabase } from '../../lib/supabase';
import type { IncomeContract, ContractStatus, BillingScheduleItem } from '../../types/database';

export type ContractRow = IncomeContract & {
  project?: { id: string; name: string; deleted_at: string | null } | null;
  client?: { id: string; name: string; deleted_at: string | null } | null;
};

const SELECT_COLUMNS =
  '*, project:projects(id, name, deleted_at), client:clients(id, name, deleted_at)';

/** 휴지통 join row 제외 헬퍼 */
function isLiveContract(c: ContractRow): boolean {
  if (c.project?.deleted_at) return false;
  if (c.client?.deleted_at) return false;
  return true;
}

/** 계약 목록 fetch (휴지통 join 자동 제외) */
export async function fetchContracts(filter?: ContractStatus | 'all'): Promise<ContractRow[]> {
  let q = supabase
    .from('income_contracts')
    .select(SELECT_COLUMNS)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (filter && filter !== 'all') q = q.eq('status', filter);
  const { data, error } = await q;
  if (error) {
    console.error('[contracts] 목록 조회 실패:', error.message);
    throw new Error('계약 목록을 불러오지 못했어요.');
  }
  return ((data ?? []) as unknown as ContractRow[]).filter(isLiveContract);
}

/** 단건 fetch (휴지통 자동 차단) */
export async function fetchContract(id: string): Promise<ContractRow | null> {
  const { data, error } = await supabase
    .from('income_contracts')
    .select(SELECT_COLUMNS)
    .eq('id', id)
    .is('deleted_at', null)
    .maybeSingle();
  if (error) {
    console.error('[contracts] 단건 조회 실패:', error.message);
    throw new Error('계약 정보를 불러오지 못했어요.');
  }
  if (!data) return null;
  return data as unknown as ContractRow;
}

/** soft-delete (휴지통 보내기) */
export async function softDeleteContract(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('income_contracts')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', id);
  if (error) {
    console.error('[contracts] 삭제 실패:', error.message);
    return '삭제 중 오류가 발생했어요.';
  }
  return null;
}

/** 입금 확인 처리 — deposited_at + status='완료' */
export async function markContractDeposited(id: string): Promise<string | null> {
  const { error } = await supabase
    .from('income_contracts')
    .update({ deposited_at: new Date().toISOString(), status: '완료' })
    .eq('id', id);
  if (error) {
    console.error('[contracts] 입금 확인 실패:', error.message);
    return '입금 확인 처리에 실패했어요.';
  }
  return null;
}

/** 청구 단계 진행률 표시용 — "1/3차 완료" */
export function billingProgressLabel(schedule: BillingScheduleItem[]): string {
  if (!Array.isArray(schedule) || schedule.length === 0) return '청구 미설정';
  const paidCount = schedule.filter((s) => s.status === 'paid').length;
  return `${paidCount}/${schedule.length}차 완료`;
}

/** KPI 계산 — 진행중 합계·완료 건수·미입금 건수 */
export interface ContractKpis {
  inProgressTotal: number;
  completedCount: number;
  notDepositedCount: number;
}
export function calcContractKpis(rows: ContractRow[]): ContractKpis {
  return rows.reduce<ContractKpis>(
    (acc, r) => {
      if (r.status === '진행중') acc.inProgressTotal += Number(r.contract_amount || 0);
      if (r.status === '완료') acc.completedCount += 1;
      if (!r.deposited_at && r.status !== '취소') acc.notDepositedCount += 1;
      return acc;
    },
    { inProgressTotal: 0, completedCount: 0, notDepositedCount: 0 },
  );
}

export const CONTRACT_STATUS_VALUES: ContractStatus[] = ['진행중', '완료', '취소', '보류'];

export const CONTRACT_STATUS_STYLE: Record<ContractStatus, string> = {
  진행중: 'bg-violet-50 text-violet-700 border-violet-200',
  완료:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  취소:   'bg-rose-50 text-rose-700 border-rose-200',
  보류:   'bg-amber-50 text-amber-700 border-amber-200',
};
