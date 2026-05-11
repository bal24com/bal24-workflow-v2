// bal24 v2 — STEP-AI-DOC-FEATURES 프로젝트 문서 → 자동채우기 (과업지시서·제안서·공정표)

import { callAi, callAiWithFile } from './aiClient';
import { fileToText, classifyFile } from './fileToText';

export interface ProjectAutoFillMember {
  org_name: string;
  responsibilities: string;
}

export interface ProjectAutoFillResult {
  name: string | null;
  client_name: string | null;
  contract_amount: number | null;
  contract_type: string | null;
  duration_months: number | null;
  start_date: string | null;
  end_date: string | null;
  description: string | null;
  consortium_members: ProjectAutoFillMember[];
}

const EMPTY: ProjectAutoFillResult = {
  name: null, client_name: null, contract_amount: null, contract_type: null,
  duration_months: null, start_date: null, end_date: null, description: null,
  consortium_members: [],
};

const SYSTEM_PROMPT = `당신은 사업 문서(과업지시서·제안서·계약서·공정표 등)에서 프로젝트 등록 정보를 추출하는 전문가입니다.
아래 문서를 분석해 다음 항목을 JSON으로만 추출하세요. 확인되지 않은 값은 반드시 null로 반환하고 절대 추측하지 마세요.

추출 항목.
- name: 과업명/사업명 (문서 표지·제목에서 우선 추출)
- client_name: 발주기관/주관기관명 (지자체·공공기관명)
- contract_amount: 계약금액 (원, 쉼표·통화기호·"원" 제거한 숫자만)
- contract_type: 계약방법 텍스트 (예: 일반경쟁, 수의계약, 협상에 의한 계약)
- duration_months: 사업 기간 (개월 단위 숫자)
- start_date: 시작일 YYYY-MM-DD
- end_date: 종료일 YYYY-MM-DD
- description: 사업 목적 요약 3문장 이내
- consortium_members: 참여기관 배열. 단독 사업이면 빈 배열 []
  · 각 항목: { "org_name": "기관명", "responsibilities": "담당역할" }

반드시 유효한 JSON만 반환. 마크다운 코드블록·다른 텍스트 금지.
추출 불가 항목은 null. 임의 추측 금지.`;

const TEXT_LIMIT = 6000;

function trimText(t: string): string {
  if (t.length <= TEXT_LIMIT) return t;
  return `${t.slice(0, 4000)}\n\n... (중략) ...\n\n${t.slice(t.length - 1000)}`;
}

function safeParse(raw: string): ProjectAutoFillResult {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const r = JSON.parse(cleaned) as Partial<ProjectAutoFillResult>;
    return normalize(r);
  } catch {
    const i = cleaned.indexOf('{');
    if (i < 0) return EMPTY;
    try {
      const r = JSON.parse(cleaned.slice(i)) as Partial<ProjectAutoFillResult>;
      return normalize(r);
    } catch {
      return EMPTY;
    }
  }
}

function toNum(v: unknown): number | null {
  if (v == null) return null;
  if (typeof v === 'number' && Number.isFinite(v)) return v;
  if (typeof v === 'string') {
    const cleaned = v.replace(/[^\d.-]/g, '');
    if (!cleaned) return null;
    const n = Number(cleaned);
    return Number.isFinite(n) ? n : null;
  }
  return null;
}

function normalize(r: Partial<ProjectAutoFillResult>): ProjectAutoFillResult {
  const members = Array.isArray(r.consortium_members)
    ? r.consortium_members
        .filter((m): m is ProjectAutoFillMember => Boolean(m && typeof m === 'object'))
        .map((m) => ({
          org_name: String(m.org_name ?? '').trim(),
          responsibilities: String(m.responsibilities ?? '').trim(),
        }))
        .filter((m) => m.org_name)
    : [];
  return {
    name: r.name ? String(r.name).trim() : null,
    client_name: r.client_name ? String(r.client_name).trim() : null,
    contract_amount: toNum(r.contract_amount),
    contract_type: r.contract_type ? String(r.contract_type).trim() : null,
    duration_months: toNum(r.duration_months),
    start_date: r.start_date ? String(r.start_date).trim() : null,
    end_date: r.end_date ? String(r.end_date).trim() : null,
    description: r.description ? String(r.description).trim() : null,
    consortium_members: members,
  };
}

/** 문서 → 프로젝트 정보 추출 (PDF/이미지 멀티모달, 그 외 fileToText) */
export async function extractProjectFromDoc(file: File): Promise<ProjectAutoFillResult> {
  const kind = classifyFile(file);
  try {
    // STEP-PROJECT-AUTOFILL-FIX — PDF/이미지는 fileToText 처리 불가 → callAiWithFile(멀티모달)로 라우팅
    if (kind !== 'unknown' && kind !== 'pdf' && kind !== 'image') {
      const doc = await fileToText(file);
      if (!doc?.text) return EMPTY;
      const trimmed = trimText(doc.text);
      const res = await callAi({
        preset: 'curriculum-extract',
        systemOverride: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmed }],
        maxTokens: 2048,
      });
      if (!res.ok || !res.text) return EMPTY;
      return safeParse(res.text);
    }
    const res = await callAiWithFile(
      file,
      '문서에서 프로젝트 정보를 JSON으로 추출해 주세요.',
      'curriculum-extract',
      { systemOverride: SYSTEM_PROMPT, maxTokens: 2048 },
    );
    if (!res.ok || !res.text) return EMPTY;
    return safeParse(res.text);
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[project-autofill] 추출 실패:', raw);
    return EMPTY;
  }
}

/** 추출 결과에서 채워진 필드 수 카운트 */
export function countFilledFields(r: ProjectAutoFillResult): number {
  let n = 0;
  if (r.name) n += 1;
  if (r.client_name) n += 1;
  if (r.contract_amount != null) n += 1;
  if (r.contract_type) n += 1;
  if (r.duration_months != null) n += 1;
  if (r.start_date) n += 1;
  if (r.end_date) n += 1;
  if (r.description) n += 1;
  if (r.consortium_members.length > 0) n += r.consortium_members.length;
  return n;
}
