// 견적서 AI 추출 — PDF/이미지/엑셀에서 견적 항목 list 자동 추출
// STEP-ACCOUNTING-FOLLOWUP7-Phase3 (curriculumExtract 패턴 차용)

import { callAi, callAiWithFile } from '../../lib/aiClient';
import { fileToText, classifyFile } from '../../lib/fileToText';
import type { PayrollTaxRateType } from '../../types/database';

export interface ExtractedEstimateItem {
  category: string;       // '강사료', '운영비', '교통비' 등 — AI 가 자유 추출
  description: string | null;
  payee_name: string | null;
  unit_price: number;
  quantity: number;
  tax_rate_type: PayrollTaxRateType;
  memo: string | null;
}

const SYSTEM_PROMPT = `문서에서 견적서·제안서의 비용 항목(지출 내역)을 JSON 배열로만 반환합니다.
각 항목.
- category (필수, 자유 텍스트, 예: "강사료", "강사료-OT", "운영비", "교통비", "숙박비", "인쇄·제작", "기타외주")
- description (강의명·작업명·세부 내용, 200자 이내. 없으면 null)
- payee_name (예상 지급처/강사명, 없으면 null. 추측 금지)
- unit_price (단가, 숫자만. 콤마·원·천원 제거)
- quantity (회수·인원·일수, 숫자만. 기본 1)
- tax_rate_type ("3.3" | "8.8" | "10" | "면세" | "없음" 중 하나. "10"=부가세 10% 포함. 알 수 없으면 "3.3" 기본)
- memo (참고 메모, 없으면 null)
없는 값=null. 추측 금지. JSON 배열만 반환. 최대 100개.`;

const TEXT_LIMIT = 6000;

function trimText(t: string): string {
  if (t.length <= TEXT_LIMIT) return t;
  return `${t.slice(0, 4500)}\n\n... (중략) ...\n\n${t.slice(t.length - 500)}`;
}

const VALID_TAX: PayrollTaxRateType[] = ['3.3', '8.8', '10', '면세', '없음'];

function toNumber(v: unknown): number {
  if (typeof v === 'number') return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^0-9.-]/g, '');
    const n = Number(cleaned);
    return Number.isNaN(n) ? 0 : n;
  }
  return 0;
}

function normalizeItem(raw: unknown): ExtractedEstimateItem | null {
  const r = (raw ?? {}) as Record<string, unknown>;
  const category = typeof r.category === 'string' ? r.category.trim() : '';
  if (!category) return null;
  const tax = typeof r.tax_rate_type === 'string' ? r.tax_rate_type.trim() : '3.3';
  return {
    category,
    description: typeof r.description === 'string' && r.description.trim() ? r.description.trim() : null,
    payee_name:  typeof r.payee_name  === 'string' && r.payee_name.trim()  ? r.payee_name.trim()  : null,
    unit_price:  Math.max(0, Math.floor(toNumber(r.unit_price))),
    quantity:    Math.max(1, Math.floor(toNumber(r.quantity) || 1)),
    tax_rate_type: (VALID_TAX.includes(tax as PayrollTaxRateType) ? tax : '3.3') as PayrollTaxRateType,
    memo:        typeof r.memo === 'string' && r.memo.trim() ? r.memo.trim() : null,
  };
}

function safeParse(raw: string): ExtractedEstimateItem[] {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const tryJson = (s: string): ExtractedEstimateItem[] => {
    try {
      const r = JSON.parse(s);
      if (!Array.isArray(r)) return [];
      return r.map(normalizeItem).filter((x): x is ExtractedEstimateItem => x !== null);
    } catch { return []; }
  };
  const direct = tryJson(cleaned);
  if (direct.length > 0) return direct;
  const i = cleaned.indexOf('[');
  return i >= 0 ? tryJson(cleaned.slice(i)) : [];
}

/** 견적서/제안서 → 견적 항목 배열 (PDF·이미지 멀티모달, 그 외 텍스트) */
export async function extractEstimateFromDocument(file: File): Promise<ExtractedEstimateItem[]> {
  const kind = classifyFile(file);
  const isMultimodal = kind === 'pdf' || kind === 'image' || kind === 'unknown';
  try {
    if (!isMultimodal) {
      const doc = await fileToText(file);
      if (!doc?.text) return [];
      const trimmed = trimText(doc.text);
      const res = await callAi({
        preset: 'curriculum-extract',
        systemOverride: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmed }],
        maxTokens: 4096,
      });
      if (!res.ok || !res.text) return [];
      return safeParse(res.text).slice(0, 100);
    }
    const res = await callAiWithFile(
      file,
      '문서에서 견적서/제안서의 비용 항목을 JSON 배열로 반환해 주세요.',
      'curriculum-extract',
      { systemOverride: SYSTEM_PROMPT, maxTokens: 4096 },
    );
    if (!res.ok || !res.text) return [];
    return safeParse(res.text).slice(0, 100);
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[estimate-extract] 추출 실패:', raw);
    return [];
  }
}
