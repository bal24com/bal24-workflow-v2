// 급여 파일 AI 자동매칭 유틸 — 박경수님 + SkyClaw STEP-PAYROLL-IMPORT (2026-05-28)
// 파일 → 텍스트 추출 → AI 분석 → 구조화 데이터. 직원 자동 매칭.
// 박경수님 환경 callAi (단수형, preset + systemOverride) 사용.

import { callAi } from '../../lib/aiClient';
import { fileToText, formatExtractedForPrompt } from '../../lib/fileToText';
import { extractJson } from '../../lib/aiUtils';

export interface ParsedPayrollSlip {
  employeeNo: string;
  employeeName: string;
  baseSalary: number;
  nationalPension: number;
  healthInsurance: number;
  employmentInsurance: number;
  longTermCare: number;
  incomeTax: number;
  localIncomeTax: number;
  healthAdjustment: number;
  careAdjustment: number;
  totalPayment: number;
  totalDeduction: number;
  netPayment: number;
  matchedEmployeeId: string | null;
}

export interface ParsedPayrollRegister {
  year: number;
  month: number;
  paymentDate: string | null;
  slips: ParsedPayrollSlip[];
}

export interface EmployeeOption {
  id: string;
  employee_no: string | null;
  profile: { name: string } | null;
}

const PAYROLL_SYSTEM_PROMPT = `당신은 급여 문서 분석 전문가입니다. 급여대장 또는 급여명세서 텍스트를 분석하여 구조화된 JSON을 반환하세요.

반드시 아래 JSON 형식만 반환하세요 (설명·코드블록 없이 JSON 객체만):
{
  "year": 2026,
  "month": 4,
  "paymentDate": "2026-04-28",
  "slips": [
    {
      "employeeNo": "001",
      "employeeName": "박경수",
      "baseSalary": 2156880,
      "nationalPension": 98080,
      "healthInsurance": 75490,
      "employmentInsurance": 0,
      "longTermCare": 9910,
      "incomeTax": 24340,
      "localIncomeTax": 2430,
      "healthAdjustment": -74460,
      "careAdjustment": -9630,
      "totalPayment": 2156880,
      "totalDeduction": 126160,
      "netPayment": 2030720
    }
  ]
}

규칙:
- 금액은 반드시 정수(원 단위)
- 없는 항목은 0
- 정산 항목(환급)은 음수로 표시
- paymentDate가 없으면 null
- 사원번호가 없으면 "" (빈 문자열)`;

/** 파일 → 텍스트 추출 → AI 분석 → JSON 파싱 */
export async function parsePayrollFile(file: File): Promise<ParsedPayrollRegister> {
  // 1) 텍스트 추출 (xlsx/csv/docx/pdf/image 모두 지원)
  const extracted = await fileToText(file);
  if (!extracted) throw new Error('파일을 읽을 수 없어요. PDF/Excel/CSV 형식을 확인해 주세요.');
  const rawText = formatExtractedForPrompt([extracted]);
  if (!rawText.trim()) throw new Error('파일에서 텍스트를 추출하지 못했어요.');

  // 2) AI 분석 — 박경수님 환경 callAi (preset + systemOverride 패턴)
  const res = await callAi({
    preset: 'curriculum-extract',
    systemOverride: PAYROLL_SYSTEM_PROMPT,
    messages: [{ role: 'user', content: `다음 급여 문서를 분석해 주세요:\n\n${rawText.slice(0, 8000)}` }],
    temperature: 0,
    maxTokens: 4096,
  });
  if (!res.ok || !res.text) throw new Error(res.errorMessage ?? 'AI 분석 실패');

  // 3) JSON 파싱
  const parsed = extractJson<ParsedPayrollRegister>(res.text);
  if (!parsed || !parsed.slips?.length) {
    throw new Error('AI가 급여 데이터를 인식하지 못했어요. 파일 형식을 확인해 주세요.');
  }
  return parsed;
}

/** 직원 자동 매칭 — 1순위 사원번호, 2순위 성명 */
export function matchEmployees(slips: ParsedPayrollSlip[], employees: EmployeeOption[]): ParsedPayrollSlip[] {
  return slips.map((s) => {
    const empNo = (s.employeeNo ?? '').trim();
    let match: EmployeeOption | undefined;
    if (empNo) match = employees.find((e) => (e.employee_no ?? '').trim() === empNo);
    if (!match) match = employees.find((e) => e.profile?.name === s.employeeName);
    return { ...s, matchedEmployeeId: match?.id ?? null };
  });
}
