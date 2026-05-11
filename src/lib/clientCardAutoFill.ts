// bal24 v2 — STEP-AUTOFILL-CARD-FULL
// 고객사 명함 이미지 → AI 멀티모달 추출 (callAiWithFile + 고객사 전용 프롬프트)

import { callAiWithFile } from './aiClient';

export interface ClientCardExtracted {
  name: string | null;           // 회사명/상호명
  department: string | null;     // 부서명
  contact_name: string | null;   // 담당자 이름
  contact_title: string | null;  // 직책
  phone: string | null;          // 전화번호 (숫자·하이픈만)
  email: string | null;          // 이메일
  address: string | null;        // 주소
}

const EMPTY_CARD: ClientCardExtracted = {
  name: null, department: null, contact_name: null, contact_title: null,
  phone: null, email: null, address: null,
};

const SYSTEM_PROMPT = `이 명함 이미지에서 고객사 정보를 추출하여 JSON으로만 반환하세요.

추출 항목.
- name: 회사명/상호명 (개인사업자명·법인명 우선)
- department: 부서명 (예: 영업본부, 기획팀)
- contact_name: 담당자 이름 (사람 이름)
- contact_title: 직책 (예: 팀장, 대리, 대표이사)
- phone: 전화번호 (숫자와 하이픈만, 휴대폰 우선)
- email: 이메일 주소
- address: 주소 (회사 주소)

반드시 유효한 JSON만 반환. 마크다운·다른 텍스트 금지.
인식 불가 항목은 null. 추측 금지.

응답 형식.
{
  "name": "...",
  "department": "...",
  "contact_name": "...",
  "contact_title": "...",
  "phone": "010-1234-5678",
  "email": "...",
  "address": "..."
}`;

function safeParse(raw: string): ClientCardExtracted {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const tryParse = (s: string): ClientCardExtracted | null => {
    try {
      const r = JSON.parse(s) as Partial<ClientCardExtracted>;
      return {
        name: r.name ? String(r.name).trim() : null,
        department: r.department ? String(r.department).trim() : null,
        contact_name: r.contact_name ? String(r.contact_name).trim() : null,
        contact_title: r.contact_title ? String(r.contact_title).trim() : null,
        phone: r.phone ? String(r.phone).trim() : null,
        email: r.email ? String(r.email).trim() : null,
        address: r.address ? String(r.address).trim() : null,
      };
    } catch { return null; }
  };
  return tryParse(cleaned) ?? tryParse(cleaned.slice(cleaned.indexOf('{'))) ?? EMPTY_CARD;
}

export async function extractFromBusinessCard(file: File): Promise<ClientCardExtracted> {
  try {
    const res = await callAiWithFile(
      file,
      '명함 이미지를 분석해 고객사 정보를 JSON으로 추출해 주세요.',
      'chat',
      { systemOverride: SYSTEM_PROMPT, maxTokens: 1024 },
    );
    if (!res.ok || !res.text) return EMPTY_CARD;
    return safeParse(res.text);
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[client-card-autofill] 추출 실패:', raw);
    return EMPTY_CARD;
  }
}

export function countFilledCardFields(c: ClientCardExtracted): number {
  return Object.values(c).filter(Boolean).length;
}
