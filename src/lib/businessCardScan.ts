// bal24 v2 — 전문가·고객사 담당자 명함 인식 (Edge Function 경로)
// SECURITY-API-KEY-FIX — 기존 claude.ts(브라우저 직접 호출 + VITE_CLAUDE_API_KEY 노출)를 폐기하고
// callAiWithFile(ai-chat Edge Function, ANTHROPIC_API_KEY는 Supabase Secret) 경로로 통일.

import { callAiWithFile } from './aiClient';

export type BusinessCardInfo = {
  name: string | null;
  organization: string | null;
  position: string | null;
  phone_mobile: string | null;
  phone_office: string | null;
  email: string | null;
};

const EMPTY: BusinessCardInfo = {
  name: null, organization: null, position: null,
  phone_mobile: null, phone_office: null, email: null,
};

/** 기존 claude.ts와 메시지·동작 호환 — ClientContactsSection / ExpertFormModal 무수정으로 교체 가능 */
export class ClaudeApiKeyMissingError extends Error {
  constructor() {
    super('AI 키가 설정되지 않았어요. 관리자에게 문의해 주세요.');
    this.name = 'ClaudeApiKeyMissingError';
  }
}

export class ClaudeApiError extends Error {
  friendlyMessage: string;
  constructor(friendlyMessage: string, detail?: string) {
    super(detail ?? friendlyMessage);
    this.name = 'ClaudeApiError';
    this.friendlyMessage = friendlyMessage;
  }
}

const SYSTEM_PROMPT = `이 명함 이미지에서 다음 정보를 추출해 JSON으로만 응답해 주세요.
값이 보이지 않거나 불확실하면 null로 채우세요.
한국어 명함이면 한국어로, 영문이면 그대로 유지하세요.
전화번호는 가능하면 010-1234-5678 또는 02-123-4567 형태로 하이픈을 넣어 정규화해 주세요.

응답 형식 (마크다운·코드펜스·다른 텍스트 금지).
{
  "name": string | null,
  "organization": string | null,
  "position": string | null,
  "phone_mobile": string | null,
  "phone_office": string | null,
  "email": string | null
}`;

function safeParse(raw: string): BusinessCardInfo {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const tryParse = (s: string): BusinessCardInfo | null => {
    try {
      const r = JSON.parse(s) as Partial<BusinessCardInfo>;
      return {
        name:         r.name         != null ? String(r.name).trim()         : null,
        organization: r.organization != null ? String(r.organization).trim() : null,
        position:     r.position     != null ? String(r.position).trim()     : null,
        phone_mobile: r.phone_mobile != null ? String(r.phone_mobile).trim() : null,
        phone_office: r.phone_office != null ? String(r.phone_office).trim() : null,
        email:        r.email        != null ? String(r.email).trim()        : null,
      };
    } catch { return null; }
  };
  return tryParse(cleaned) ?? tryParse(cleaned.slice(cleaned.indexOf('{'))) ?? EMPTY;
}

export async function extractBusinessCardInfo(file: File): Promise<BusinessCardInfo> {
  if (file.size > 5 * 1024 * 1024) {
    throw new ClaudeApiError('이미지는 5MB 이하만 인식할 수 있어요.');
  }
  let res;
  try {
    res = await callAiWithFile(
      file,
      '명함 이미지를 분석해 JSON으로 추출해 주세요.',
      'chat',
      { systemOverride: SYSTEM_PROMPT, maxTokens: 1024 },
    );
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[business-card-scan] 네트워크 오류:', raw);
    throw new ClaudeApiError('AI 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.', raw);
  }
  if (!res.ok) {
    throw new ClaudeApiError(res.errorMessage ?? 'AI 호출에 실패했어요.', res.errorMessage);
  }
  if (!res.text) {
    throw new ClaudeApiError('명함 인식 응답이 비어 있어요.');
  }
  return safeParse(res.text);
}

export function isClaudeApiConfigured(): boolean {
  // 서버 사이드(Edge Function ANTHROPIC_API_KEY)로 통일됐으므로 클라이언트에선 항상 true로 간주
  return true;
}
