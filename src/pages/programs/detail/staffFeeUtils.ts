// bal24 v2 — STEP-STAFF-FEE-TAX fetch + 계산 헬퍼
// V-2 보정: 명세의 (row: any) → 정식 인터페이스 + pickOne<T> 헬퍼.

import { supabase } from '../../../lib/supabase';
import type {
  StaffFee, FeeCalculation, TaxType, PaymentStatus,
} from '../../../types/staffFee';

/** Supabase nested select 가 단일/배열 둘 다 반환할 수 있음 — 단일로 정규화 */
function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

interface NameRef { name: string | null }
interface StaffFeeRow extends Omit<StaffFee, 'expert_name' | 'profile_name'> {
  expert: NameRef | NameRef[] | null;
  profile: NameRef | NameRef[] | null;
}

// ── 원천징수 계산 ──────────────────────────────────────────
export function calculateFee(gross: number, taxType: TaxType): FeeCalculation {
  const safeGross = Number.isFinite(gross) && gross > 0 ? gross : 0;
  const taxRate = taxType === '3.3' ? 0.033 : taxType === '8.8' ? 0.088 : 0;
  const taxAmount = Math.floor(safeGross * taxRate); // 원 단위 절사
  return {
    grossAmount: safeGross,
    taxAmount,
    netAmount: safeGross - taxAmount,
    taxRate,
  };
}

// ── 프로그램 지급 기준 목록 조회 ───────────────────────────
export async function fetchStaffFees(programId: string): Promise<StaffFee[]> {
  const { data, error } = await supabase
    .from('program_staff_fees')
    .select(`
      *,
      expert:staff_pool!expert_id(name),
      profile:profiles!profile_id(name)
    `)
    .eq('program_id', programId)
    .order('created_at');
  if (error) {
    console.error('[staff-fee] 지급 기준 조회 실패:', error.message);
    return [];
  }
  return ((data ?? []) as StaffFeeRow[]).map((row) => {
    const expert = pickOne<NameRef>(row.expert);
    const profile = pickOne<NameRef>(row.profile);
    return {
      id: row.id,
      program_id: row.program_id,
      expert_id: row.expert_id,
      profile_id: row.profile_id,
      fee_type: row.fee_type,
      description: row.description,
      input_mode: row.input_mode,
      unit_price: Number(row.unit_price ?? 0),
      quantity: Number(row.quantity ?? 1),
      gross_amount: Number(row.gross_amount ?? 0),
      tax_type: row.tax_type,
      tax_amount: Number(row.tax_amount ?? 0),
      net_amount: Number(row.net_amount ?? 0),
      payment_status: row.payment_status,
      paid_at: row.paid_at,
      note: row.note,
      created_at: row.created_at,
      expert_name: expert?.name ?? null,
      profile_name: profile?.name ?? null,
    } as StaffFee;
  });
}

// ── 지급 상태 업데이트 ──────────────────────────────────────
export async function updatePaymentStatus(
  id: string,
  status: PaymentStatus,
  paidAt?: string,
): Promise<boolean> {
  const { error } = await supabase
    .from('program_staff_fees')
    .update({
      payment_status: status,
      paid_at: status === '지급완료' ? (paidAt ?? new Date().toISOString().slice(0, 10)) : null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('[staff-fee] 지급 상태 변경 실패:', error.message);
    return false;
  }
  return true;
}

// ── 삭제 ──────────────────────────────────────────────────
export async function deleteStaffFee(id: string): Promise<boolean> {
  const { error } = await supabase.from('program_staff_fees').delete().eq('id', id);
  if (error) {
    console.error('[staff-fee] 삭제 실패:', error.message);
    return false;
  }
  return true;
}

// ── STEP-STAFF-FEE-EXPENSES-LINK ──────────────────────────
// staffFee.tax_type → expenses.withholding_type 매핑
const TAX_TO_WITHHOLDING: Record<TaxType, 'none' | 'business_3_3' | 'other_8_8'> = {
  '3.3': 'business_3_3',
  '8.8': 'other_8_8',
  '면세': 'none',
};

interface ProgramRefRow {
  id: string;
  name: string | null;
  project_id: string | null;
  consortium_id: string | null;
}

interface MarkPaidResult {
  success: boolean;
  expenseId?: string;
  error?: string;
}

/**
 * 강사료 지급 완료 처리:
 * 1. 중복 방지 (이미 expense_id 있으면 차단)
 * 2. expenses INSERT — account_code 분기, withholding_type 매핑,
 *    program 의 project_id/consortium_id 자동 채움
 * 3. program_staff_fees: payment_status='지급완료', expense_id 역참조, paid_at
 *
 * ⚠ 원자성 한계: expenses 생성 후 fee 업데이트 실패 시 고아 레코드 발생 가능.
 *    향후 STEP-STAFF-FEE-DB-TRIGGER 로 트랜잭션화 권장.
 */
export async function markStaffFeeAsPaid(
  fee: StaffFee,
  paidByUserId: string | null,
): Promise<MarkPaidResult> {
  // ① 중복 방지
  if (fee.expense_id) {
    return { success: false, error: '이미 지급 처리된 항목이에요.' };
  }
  if (fee.payment_status === '지급완료') {
    return { success: false, error: '이미 지급 완료 상태예요.' };
  }

  // ② program 정보 fetch (project_id / consortium_id 자동 채움)
  const { data: programData, error: programError } = await supabase
    .from('programs')
    .select('id, name, project_id, consortium_id')
    .eq('id', fee.program_id)
    .maybeSingle();
  if (programError) {
    console.error('[staff-fee] 프로그램 조회 실패:', programError.message);
    return { success: false, error: '프로그램 정보를 불러오지 못했어요.' };
  }
  const program = (programData as ProgramRefRow | null) ?? null;

  // ③ expenses 페이로드 구성
  const isInternal = !!fee.profile_id;
  const accountCode = isInternal ? 'EXPENSE_LABOR' : 'EXPENSE_LECTURE';
  const ledgerType = program?.consortium_id ? 'consortium' : 'own';
  const personName = fee.profile_name ?? fee.expert_name ?? '강사';
  const today = new Date().toISOString().slice(0, 10);
  const description = fee.description?.trim()
    ? `${personName} · ${fee.description.trim()}`
    : `${personName} 강사료${program?.name ? ` (${program.name})` : ''}`;

  const { data: created, error: insertError } = await supabase
    .from('expenses')
    .insert({
      ledger_type: ledgerType,
      project_id: program?.project_id ?? null,
      consortium_id: program?.consortium_id ?? null,
      account_code: accountCode,
      description,
      gross_amount: fee.gross_amount,
      withholding_type: TAX_TO_WITHHOLDING[fee.tax_type] ?? 'none',
      expense_date: today,
      paid_at: today,
      paid_by: paidByUserId,
      status: '출금완료',
      memo: fee.note?.trim() || null,
      staff_fee_id: fee.id,
    })
    .select('id')
    .single();

  if (insertError || !created) {
    console.error('[staff-fee] expenses 생성 실패:', insertError?.message);
    return { success: false, error: '지출 내역 생성 중 오류가 발생했어요.' };
  }

  const expenseId = (created as { id: string }).id;

  // ④ fee 상태 업데이트 + expense_id 역참조
  const { error: updateError } = await supabase
    .from('program_staff_fees')
    .update({
      payment_status: '지급완료',
      expense_id: expenseId,
      paid_at: today,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fee.id);

  if (updateError) {
    console.error('[staff-fee] 상태 업데이트 실패:', updateError.message);
    // expenses 는 생성됐지만 fee 업데이트 실패 → 고아 레코드 안내
    return {
      success: false,
      expenseId,
      error: '지출은 생성됐지만 지급 상태 업데이트에 실패했어요. 관리자에게 문의해 주세요.',
    };
  }

  return { success: true, expenseId };
}

/**
 * 강사료 지급 취소:
 * 1. expenses 삭제 (deleted_at = now()로 soft delete)
 * 2. program_staff_fees: payment_status='미지급', expense_id=null, paid_at=null
 */
export async function cancelStaffFeePayment(fee: StaffFee): Promise<{ success: boolean; error?: string }> {
  if (!fee.expense_id) {
    return { success: false, error: '지급 처리되지 않은 항목이에요.' };
  }

  // ① expenses soft delete (deleted_at)
  const { error: deleteError } = await supabase
    .from('expenses')
    .update({ deleted_at: new Date().toISOString() })
    .eq('id', fee.expense_id);
  if (deleteError) {
    console.error('[staff-fee] expenses 삭제 실패:', deleteError.message);
    return { success: false, error: '지출 내역 삭제 중 오류가 발생했어요.' };
  }

  // ② fee 롤백
  const { error: rollbackError } = await supabase
    .from('program_staff_fees')
    .update({
      payment_status: '미지급',
      expense_id: null,
      paid_at: null,
      updated_at: new Date().toISOString(),
    })
    .eq('id', fee.id);
  if (rollbackError) {
    console.error('[staff-fee] 롤백 실패:', rollbackError.message);
    return { success: false, error: '지급 취소 처리 중 오류가 발생했어요.' };
  }

  return { success: true };
}
