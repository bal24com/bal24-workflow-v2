// bal24 v2 — STEP-AUTOFILL-CARD-FIX
// 고객사 명함 이미지 → AI 멀티모달 추출 (callAiWithFile + 고객사 전용 프롬프트)
// 누락 필드 보강. representative·business_no·contact_phone·contact_email 분리.

import { callAiWithFile } from './aiClient';

export interface ClientCardExtracted {
  name: string | null;           // 회사명/상호명
  department: string | null;     // 부서명
  representative: string | null; // 대표자명 (회사 대표)
  business_no: string | null;    // 사업자등록번호 (000-00-00000)
  contact_name: string | null;   // 담당자 이름
  contact_title: string | null;  // 담당자 직책
  contact_phone: string | null;  // 담당자 휴대폰 (010-…)
  contact_email: string | null;  // 담당자 이메일
  phone: string | null;          // 대표 전화 (회사 대표번호)
  email: string | null;          // 대표 이메일 (회사 대표주소)
  address: string | null;        // 회사 주소
}

const EMPTY_CARD: ClientCardExtracted = {
  name: null, department: null, representative: null, business_no: null,
  contact_name: null, contact_title: null, contact_phone: null, contact_email: null,
  phone: null, email: null, address: null,
};

const SYSTEM_PROMPT = `이 명함 이미지에서 고객사 정보를 추출하여 JSON으로만 반환하세요.

추출 항목.
- name: 회사명/상호명 (개인사업자명·법인명 우선)
- department: 부서명 (예: 영업본부, 기획팀)
- representative: 회사 대표자명 (대표이사·CEO 등 회사 대표. 명함 주인공이 대표면 동일 인물)
- business_no: 사업자등록번호 (000-00-00000 형식. 숫자 10자리)
- contact_name: 명함 주인공(담당자) 이름
- contact_title: 명함 주인공 직책 (예: 팀장, 대리, 대표이사)
- contact_phone: 명함 주인공 휴대폰 (010-… 우선)
- contact_email: 명함 주인공 이메일
- phone: 회사 대표 전화 (대표번호·사무실 번호. 휴대폰과 별도)
- email: 회사 대표 이메일 (contact@… info@… 등)
- address: 회사 주소

반드시 유효한 JSON만 반환. 마크다운·다른 텍스트 금지.
인식 불가 항목은 null. 추측 금지.
명함 주인공의 휴대폰만 있고 회사 대표번호가 없으면 phone은 null.

응답 형식.
{
  "name": "...",
  "department": "...",
  "representative": "...",
  "business_no": "000-00-00000",
  "contact_name": "...",
  "contact_title": "...",
  "contact_phone": "010-1234-5678",
  "contact_email": "...",
  "phone": "02-1234-5678",
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
        representative: r.representative ? String(r.representative).trim() : null,
        business_no: r.business_no ? String(r.business_no).trim() : null,
        contact_name: r.contact_name ? String(r.contact_name).trim() : null,
        contact_title: r.contact_title ? String(r.contact_title).trim() : null,
        contact_phone: r.contact_phone ? String(r.contact_phone).trim() : null,
        contact_email: r.contact_email ? String(r.contact_email).trim() : null,
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
