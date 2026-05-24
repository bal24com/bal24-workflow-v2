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
  // 헤더의 total_amount 도 합계로 갱신
  const total = items.reduce((s, it) => s + (it.unit_price * it.quantity), 0);
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

  // 2. payroll_expenses 일괄 insert
  const payloads = rows.map((it) => {
    const subtotal = it.unit_price * it.quantity;
    const { taxAmount, netAmount } = calcTax(subtotal, it.tax_rate_type as PayrollTaxRateType);
    return {
      expense_type: it.category,
      description: it.description,
      payee_name: it.payee_name ?? '미정',
      unit_price: it.unit_price,
      quantity: it.quantity,
      tax_rate_type: it.tax_rate_type,
      tax_amount: taxAmount,
      net_amount: netAmount,
      payment_status: '대기',
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

/** 자주 쓰이는 견적 카테고리 (datalist 후보) */
export const ESTIMATE_CATEGORY_SUGGESTIONS = [
  '강사료', '강사료-OT', '강사료-메인', '특강료',
  '운영비', '운영인건비', '교통비', '숙박비', '식대',
  '인쇄·제작', '시설·장비', '기타외주',
];
