// bal24 v2 — STEP-FEE-FORM-DOWNLOAD (박경수님 2026-05-26)
// 강사료 지급확인서 PDF 생성·다운로드 + Supabase fetch 헬퍼.
// HTML 양식 빌더는 feeFormHTML.ts 로 분리.

import { supabase } from '../lib/supabase';
import type { StaffFee, TaxType } from '../types/staffFee';
import { buildFeeFormHTML, type FeeFormData } from './feeFormHTML';

// 외부 노출 타입 (기존 import 경로 호환)
export type { FeeFormData, FeeFormSession } from './feeFormHTML';
export { buildFeeFormHTML, maskResidentNumber } from './feeFormHTML';

/** 파일명 안전 변환 (PDF 다운로드 시 OS 제약 회피). */
function safeFileName(s: string): string {
  return s.replace(/[\\/:*?"<>|]+/g, '_').slice(0, 80);
}

/** 이미지 로드 대기 (PDF 백지 방지). */
function waitForImages(root: HTMLElement, timeoutMs = 6000): Promise<void> {
  const imgs = Array.from(root.querySelectorAll('img'));
  if (imgs.length === 0) return Promise.resolve();
  const waits = imgs.map((img) => {
    if (img.complete && img.naturalWidth > 0) return Promise.resolve();
    return new Promise<void>((resolve) => {
      img.addEventListener('load', () => resolve(), { once: true });
      img.addEventListener('error', () => resolve(), { once: true });
    });
  });
  const timeout = new Promise<void>((resolve) => setTimeout(() => resolve(), timeoutMs));
  return Promise.race([Promise.all(waits).then(() => undefined), timeout]);
}

/** 강사료 확인서 PDF 1건 생성 + 즉시 다운로드. */
export async function downloadFeeFormPDF(data: FeeFormData): Promise<void> {
  const fullHtml = buildFeeFormHTML(data);
  const styleMatch = fullHtml.match(/<style[\s\S]*?<\/style>/);
  const bodyMatch = fullHtml.match(/<body[^>]*>([\s\S]*?)<\/body>/);
  const styleHtml = styleMatch?.[0] ?? '';
  const bodyInner = bodyMatch?.[1] ?? fullHtml;

  const mod = await import('html2pdf.js');
  const html2pdf = mod.default;

  const container = document.createElement('div');
  container.style.position = 'fixed';
  container.style.top = '0';
  container.style.left = '0';
  container.style.width = '794px';
  container.style.opacity = '0';
  container.style.pointerEvents = 'none';
  container.style.zIndex = '-1';
  container.style.background = '#fff';
  container.innerHTML = styleHtml + bodyInner;
  document.body.appendChild(container);

  const shortTitle = safeFileName(data.programTitle.slice(0, 24));
  const fileName = `강사료확인서_${safeFileName(data.staffName)}_${shortTitle}.pdf`;

  try {
    await waitForImages(container);
    await html2pdf()
      .set({
        margin: [10, 10, 10, 10],
        filename: fileName,
        image: { type: 'jpeg', quality: 0.98 },
        html2canvas: { scale: 2, useCORS: true, allowTaint: true, backgroundColor: '#ffffff', logging: false },
        jsPDF: { unit: 'mm', format: 'a4', orientation: 'portrait' },
      })
      .from(container)
      .save();
  } finally {
    if (container.parentElement) document.body.removeChild(container);
  }
}

/** 여러 명 순차 다운로드 (500ms 간격). */
export async function downloadAllFeeFormPDFs(
  dataList: FeeFormData[],
  onProgress?: (current: number, total: number) => void,
): Promise<void> {
  for (let i = 0; i < dataList.length; i++) {
    onProgress?.(i + 1, dataList.length);
    await downloadFeeFormPDF(dataList[i]);
    if (i < dataList.length - 1) {
      await new Promise((r) => setTimeout(r, 500));
    }
  }
}

// ─────────────────────────────────────────────────────────────
// Fetch 헬퍼 — StaffFee · payroll_expenses → FeeFormData 변환
// ─────────────────────────────────────────────────────────────

interface ProgramBasic {
  name: string;
  start_date: string | null;
  end_date: string | null;
  venue: string | null;
}

interface StaffBasic {
  name: string;
  organization: string | null;
  position: string | null;
  id_number: string | null;
  bank_name: string | null;
  bank_account: string | null;
}

interface ProfileBasic {
  name: string;
  department: string | null;
  position: string | null;
}

const TAX_LABEL_MAP: Record<TaxType, string> = {
  '3.3': '3.3%',
  '8.8': '8.8%',
  '면세': '면세',
};

const TAX_RATE_MAP: Record<TaxType, number> = {
  '3.3': 0.033,
  '8.8': 0.088,
  '면세': 0,
};

async function fetchProgram(programId: string): Promise<ProgramBasic | null> {
  const { data, error } = await supabase
    .from('programs')
    .select('name, start_date, end_date, venue')
    .eq('id', programId)
    .maybeSingle();
  if (error) {
    console.warn('[feeFormPDF] 프로그램 조회 경고:', error.message);
    return null;
  }
  return data as ProgramBasic | null;
}

async function fetchStaffPool(staffPoolId: string): Promise<StaffBasic | null> {
  const { data, error } = await supabase
    .from('staff_pool')
    .select('name, organization, position, id_number, bank_name, bank_account')
    .eq('id', staffPoolId)
    .maybeSingle();
  if (error) {
    console.warn('[feeFormPDF] staff_pool 조회 경고:', error.message);
    return null;
  }
  return data as StaffBasic | null;
}

async function fetchProfile(profileId: string): Promise<ProfileBasic | null> {
  const { data, error } = await supabase
    .from('profiles')
    .select('name, department, position')
    .eq('id', profileId)
    .maybeSingle();
  if (error) {
    console.warn('[feeFormPDF] profiles 조회 경고:', error.message);
    return null;
  }
  return data as ProfileBasic | null;
}

/** StaffFee 1건 → FeeFormData (PM 강사료 탭·멘토링 탭 공용). */
export async function buildFeeFormFromStaffFee(
  fee: StaffFee,
  programId: string,
  programCache?: ProgramBasic | null,
): Promise<FeeFormData> {
  const program = programCache ?? await fetchProgram(programId);
  let affiliation: string | null = null;
  let position: string | null = null;
  let idNumber: string | null = null;
  let bankAccount: string | null = null;
  let staffName = fee.expert_name ?? fee.profile_name ?? '이름 없음';

  if (fee.expert_id) {
    const sp = await fetchStaffPool(fee.expert_id);
    if (sp) {
      staffName = sp.name ?? staffName;
      affiliation = sp.organization;
      position = sp.position;
      idNumber = sp.id_number;
      bankAccount = sp.bank_name && sp.bank_account ? `${sp.bank_name} ${sp.bank_account}` : null;
    }
  } else if (fee.profile_id) {
    const pr = await fetchProfile(fee.profile_id);
    if (pr) {
      staffName = pr.name ?? staffName;
      affiliation = pr.department;
      position = pr.position;
    }
  }

  return {
    staffName,
    affiliation,
    position,
    residentNumber: idNumber,
    bankAccount,
    programTitle: program?.name ?? '프로그램',
    programStartDate: program?.start_date ?? fee.period_start_date ?? null,
    programEndDate: program?.end_date ?? fee.period_end_date ?? null,
    programLocation: program?.venue ?? null,
    amount: fee.gross_amount,
    taxRate: TAX_RATE_MAP[fee.tax_type],
    taxLabel: TAX_LABEL_MAP[fee.tax_type],
    taxAmount: fee.tax_amount,
    netAmount: fee.net_amount,
  };
}

/** payroll_expenses 1건 → FeeFormData (강사 포털 [강사료] 서브탭용). */
export interface PayrollExpenseLite {
  id: string;
  program_id: string | null;
  payee_name: string;
  subtotal: number;
  tax_rate_type: string;
  tax_amount: number;
  net_amount: number;
}

export async function buildFeeFormFromPayrollExpense(
  expense: PayrollExpenseLite,
  staffPoolId: string,
): Promise<FeeFormData> {
  const [program, staff] = await Promise.all([
    expense.program_id ? fetchProgram(expense.program_id) : Promise.resolve(null),
    fetchStaffPool(staffPoolId),
  ]);
  const rate = parseFloat(expense.tax_rate_type);
  const ratio = Number.isFinite(rate) && rate > 0 ? rate / 100 : 0;
  const taxLabel = isNaN(rate) ? expense.tax_rate_type : `${expense.tax_rate_type}%`;

  return {
    staffName: staff?.name ?? expense.payee_name,
    affiliation: staff?.organization ?? null,
    position: staff?.position ?? null,
    residentNumber: staff?.id_number ?? null,
    bankAccount: staff?.bank_name && staff?.bank_account
      ? `${staff.bank_name} ${staff.bank_account}` : null,
    programTitle: program?.name ?? '프로그램',
    programStartDate: program?.start_date ?? null,
    programEndDate: program?.end_date ?? null,
    programLocation: program?.venue ?? null,
    amount: expense.subtotal,
    taxRate: ratio,
    taxLabel,
    taxAmount: expense.tax_amount,
    netAmount: expense.net_amount,
  };
}
