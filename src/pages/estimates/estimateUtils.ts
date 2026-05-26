// 견적서 fetch · CRUD · 외주/급여 변환 유틸
// STEP-ACCOUNTING-FOLLOWUP7-Phase2

import { supabase } from '../../lib/supabase';
import { calcTax } from '../../utils/taxUtils';
import type {
  EstimateItem, PayrollTaxRateType, ProjectEstimate,
} from '../../types/database';

export type EstimateRow = ProjectEstimate & {
  items?: EstimateItem[];
};

/** 프로젝트의 견적서 1건 + 항목 조회 (가장 최근 견적 1건 사용) */
export async function fetchEstimateByProject(projectId: string): Promise<EstimateRow | null> {
  const { data, error } = await supabase
    .from('project_estimates')
    .select('*, items:estimate_items(*)')
    .eq('project_id', projectId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false })
    .limit(1)
    .maybeSingle();
  if (error) {
    console.error('[estimates] 조회 실패:', error.message);
    throw new Error('견적서를 불러오지 못했어요.');
  }
  if (!data) return null;
  return data as unknown as EstimateRow;
}

/** 견적서 생성 (project_id 기반) — 빈 헤더만 만들고 항목은 후속 insert */
export async function createEstimate(input: {
  project_id?: string | null;
  program_id?: string | null;
  contract_id?: string | null;
  title: string;
  memo?: string | null;
}): Promise<EstimateRow> {
  const { data, error } = await supabase
    .from('project_estimates')
    .insert({
      project_id: input.project_id ?? null,
      program_id: input.program_id ?? null,
      contract_id: input.contract_id ?? null,
      title: input.title,
      memo: input.memo ?? null,
    })
    .select('*, items:estimate_items(*)')
    .single();
  if (error) {
    console.error('[estimates] 생성 실패:', error.message);
    throw new Error('견적서 생성에 실패했어요.');
  }
  return data as unknown as EstimateRow;
}

/** 견적 항목 일괄 저장 (전체 교체 — 기존 item 삭제 후 새로 insert) */
export async function saveEstimateItems(
  estimateId: string,
  items: Omit<EstimateItem, 'id' | 'estimate_id' | 'subtotal' | 'created_at' | 'payroll_expense_id'>[],
): Promise<string | null> {
  // 기존 (변환 안 된) 항목만 교체. payroll_expense_id 가 있는 row 는 보존.
  const delRes = await supabase
    .from('estimate_items')
    .delete()
    .eq('estimate_id', estimateId)
    .is('payroll_expense_id', null);
  if (delRes.error) {
    console.error('[estimates] 기존 항목 삭제 실패:', delRes.error.message);
    return '기존 항목 정리에 실패했어요.';
  }
  if (items.length === 0) return null;
  const payload = items.map((it) => ({ ...it, estimate_id: estimateId }));
  const { error } = await supabase.from('estimate_items').insert(payload);
  if (error) {
    console.error('[estimates] 항목 저장 실패:', error.message);
    return '항목 저장 중 오류가 발생했어요.';
  }
  // 헤더의 total_amount 도 합계로 갱신 — 박경수님 요청 3중 곱 (단가 × 회수 × 수량)
  const total = items.reduce((s, it) => s + (it.unit_price * it.quantity * (it.headcount ?? 1)), 0);
  await supabase.from('project_estimates').update({ total_amount: total, updated_at: new Date().toISOString() }).eq('id', estimateId);
  return null;
}

/** 견적 항목 → 외주/급여 일괄 변환
 *  변환되지 않은 항목(payroll_expense_id IS NULL)만 처리 + payroll insert + 매핑.
 */
export async function convertEstimateToPayroll(
  estimateId: string,
  parent: { project_id?: string | null; program_id?: string | null; contract_id?: string | null },
): Promise<{ inserted: number; error: string | null }> {
  // 1. 변환 대상 항목 조회
  const { data: items, error: iErr } = await supabase
    .from('estimate_items')
    .select('*')
    .eq('estimate_id', estimateId)
    .is('payroll_expense_id', null);
  if (iErr) {
    console.error('[estimates] 변환 대상 조회 실패:', iErr.message);
    return { inserted: 0, error: '변환 대상 조회에 실패했어요.' };
  }
  const rows = (items as EstimateItem[] | null) ?? [];
  if (rows.length === 0) return { inserted: 0, error: '변환할 항목이 없어요. (이미 모두 변환됨)' };

  // 2. payroll_expenses 일괄 insert — 박경수님 요청 (단가 × 회수 × 수량) 반영.
  // payroll_expenses 에는 headcount 컬럼이 없으므로 quantity 에 합쳐서 저장: q_payroll = quantity × headcount
  const payloads = rows.map((it) => {
    const effectiveQty = Number(it.quantity ?? 1) * Number(it.headcount ?? 1);
    const subtotal = it.unit_price * effectiveQty;
    const { taxAmount, netAmount } = calcTax(subtotal, it.tax_rate_type as PayrollTaxRateType);
    return {
      expense_type: it.category,
      description: it.description,
      payee_name: it.payee_name ?? '미정',
      unit_price: it.unit_price,
      quantity: effectiveQty,
      tax_rate_type: it.tax_rate_type,
      tax_amount: taxAmount,
      net_amount: netAmount,
      payment_status: 'draft', // STEP-PAYROLL-STATUS-FLOW — 견적 변환 = PM 초안
      project_id: parent.project_id ?? null,
      program_id: parent.program_id ?? null,
      contract_id: parent.contract_id ?? null,
    };
  });
  const { data: inserted, error: insErr } = await supabase
    .from('payroll_expenses')
    .insert(payloads)
    .select('id');
  if (insErr) {
    console.error('[estimates] payroll insert 실패:', insErr.message);
    return { inserted: 0, error: '외주/급여 변환 중 오류가 발생했어요.' };
  }
  const insertedRows = (inserted as { id: string }[] | null) ?? [];

  // 3. 매핑 — 각 estimate_item.payroll_expense_id 갱신
  for (let i = 0; i < rows.length && i < insertedRows.length; i += 1) {
    const updRes = await supabase
      .from('estimate_items')
      .update({ payroll_expense_id: insertedRows[i].id })
      .eq('id', rows[i].id);
    if (updRes.error) console.warn('[estimates] item 매핑 실패:', updRes.error.message);
  }
  return { inserted: insertedRows.length, error: null };
}

/** 박경수님 요청 — 견적 항목 → 매핑된 payroll_expense 의 지급상태 일괄 조회 (Map) */
export async function fetchEstimatePaymentMap(
  payrollExpenseIds: string[],
): Promise<Map<string, string>> {
  const ids = payrollExpenseIds.filter(Boolean);
  if (ids.length === 0) return new Map();
  const { data, error } = await supabase
    .from('payroll_expenses')
    .select('id, payment_status')
    .in('id', ids).is('deleted_at', null);
  if (error) {
    console.error('[estimates] payroll 매핑 조회 실패:', error.message);
    return new Map();
  }
  const m = new Map<string, string>();
  for (const r of (data ?? []) as Array<{ id: string; payment_status: string }>) {
    m.set(r.id, r.payment_status);
  }
  return m;
}

/** 박경수님 요청 — 견적 항목 상태 라벨 (4단계) */
export function estimateItemStatusLabel(
  converted: boolean, paymentStatus: string | null | undefined,
): { label: string; tone: 'slate' | 'amber' | 'emerald' | 'rose' } {
  if (!converted) return { label: '미연결', tone: 'slate' };
  if (paymentStatus === '완료') return { label: '지급완료', tone: 'emerald' };
  if (paymentStatus === '취소') return { label: '취소', tone: 'rose' };
  return { label: '집행 대기', tone: 'amber' };
}

/** 자주 쓰이는 견적 카테고리 (datalist 후보) */
export const ESTIMATE_CATEGORY_SUGGESTIONS = [
  '강사료', '강사료-OT', '강사료-메인', '특강료',
  '운영비', '운영인건비', '교통비', '숙박비', '식대',
  '인쇄·제작', '시설·장비', '기타외주',
];
