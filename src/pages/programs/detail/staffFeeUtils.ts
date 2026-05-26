// bal24 v2 — STEP-STAFF-FEE-TAX fetch + 계산 헬퍼
// V-2 보정: 명세의 (row: any) → 정식 인터페이스 + pickOne<T> 헬퍼.

import { supabase } from '../../../lib/supabase';
import type {
  StaffFee, FeeCalculation, FeeType, TaxType, PaymentStatus,
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

// ── 에러 메시지 번역 (raw 포함 — 박경수님 진단용) ────────
export function translateStaffFeeError(raw: string): string {
  const m = (raw ?? '').toLowerCase();
  if (m.includes('duplicate')) return '동일 강사·활동유형 조합이 이미 등록되어 있어요.';
  if (m.includes('column') && m.includes('does not exist')) return `강사료 테이블 컬럼이 적용되지 않았어요. Supabase 마이그레이션 실행 필요.\n(${raw})`;
  if (m.includes('row-level security') || m.includes('permission denied')) return `저장 권한이 없어요. 관리자에게 문의해 주세요.\n(${raw})`;
  if (m.includes('foreign key')) return `선택한 강사 또는 프로그램이 유효하지 않아요. 휴지통 상태일 수 있어요.\n(${raw})`;
  if (m.includes('check') && m.includes('constraint')) return `입력 형식이 허용되지 않아요.\n(${raw})`;
  if (m.includes('null value') || m.includes('not-null')) return `필수 항목이 비어 있어요.\n(${raw})`;
  if (m.includes('could not find the table') || m.includes('pgrst205')) return 'program_staff_fees 테이블이 적용되지 않았어요. 마이그레이션 실행이 필요해요.';
  return `저장에 실패했어요: ${raw || '원인 미상'}`;
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
 * ✅ STEP-STAFF-FEE-DB-TRIGGER (2026-05-10) 적용:
 *    DB 트리거 `trg_sync_staff_fee_expense_id` 가 expenses INSERT 후
 *    해당 staff_fee.expense_id 를 자동 연결하므로 아래 ④ UPDATE 가
 *    실패해도 정합성은 트리거가 보장한다 (expense_id 는 동기화됨).
 *    UPDATE 는 payment_status='지급완료'·paid_at 만 갱신하면 됨.
 *    expenses soft delete 시에도 트리거(`trg_clear_staff_fee_expense_id`)가
 *    expense_id 를 null 로 자동 해제한다.
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

// ── STEP-ACCOUNTING-FOLLOWUP7-Phase2.5 ────────────────────
// program_staff_fees → payroll_expenses 일괄 변환
// 박경수님 새 회계 시스템 도입에 따른 흐름 연결.
// 기존 markStaffFeeAsPaid (expenses) 와는 독립 — 두 흐름 공존 OK.

// fee_type → payroll expense_type 매핑 (자유 카테고리 prefix 패턴 활용)
const FEE_TYPE_TO_PAYROLL: Record<FeeType, string> = {
  education:    '강사료',
  mentoring:    '강사료-멘토링',
  consulting:   '기타외주-컨설팅',
  facilitation: '강사료-진행',
  etc:          '기타외주',
};

// staffFee.tax_type ('3.3'|'8.8'|'면세') → payroll.tax_rate_type ('3.3'|'8.8'|'10'|'면세'|'없음')
function mapTaxRate(taxType: TaxType): '3.3' | '8.8' | '면세' | '없음' {
  if (taxType === '3.3') return '3.3';
  if (taxType === '8.8') return '8.8';
  return '면세';
}

export async function convertStaffFeesToPayroll(
  fees: StaffFee[],
  programId: string,
): Promise<{ inserted: number; error: string | null }> {
  if (fees.length === 0) return { inserted: 0, error: '변환할 항목이 없어요.' };
  // 부모 프로젝트 id 자동 조회 (staff_fee 페이지에서 별도 fetch 안 시키도록)
  const { data: prog } = await supabase
    .from('programs').select('project_id').eq('id', programId).maybeSingle();
  const projectId = (prog as { project_id: string | null } | null)?.project_id ?? null;

  const payloads = fees.map((f) => ({
    expense_type: FEE_TYPE_TO_PAYROLL[f.fee_type] ?? '강사료',
    description: f.description ?? null,
    payee_name: f.expert_name ?? f.profile_name ?? '미정',
    unit_price: f.unit_price,
    quantity: f.quantity,
    tax_rate_type: mapTaxRate(f.tax_type),
    tax_amount: f.tax_amount,
    net_amount: f.net_amount,
    payment_status: 'draft', // STEP-PAYROLL-STATUS-FLOW — staff fee → payroll 변환 = PM 초안
    paid_at: f.paid_at,
    program_id: programId,
    project_id: projectId,
  }));

  const { data, error } = await supabase
    .from('payroll_expenses')
    .insert(payloads)
    .select('id');
  if (error) {
    console.error('[staff-fee→payroll] 변환 실패:', error.message);
    return { inserted: 0, error: '변환 중 오류가 발생했어요.' };
  }
  return { inserted: (data?.length ?? 0), error: null };
}
