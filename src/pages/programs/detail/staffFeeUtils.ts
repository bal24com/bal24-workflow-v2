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
