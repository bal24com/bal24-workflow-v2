// bal24 v2 — Claude API 클라이언트 (명함 인식)
//
// ⚠ 보안 주의: 이 파일은 VITE_CLAUDE_API_KEY를 브라우저 번들에 노출시켜요.
// 프로덕션 배포 전 반드시 Supabase Edge Function으로 옮길 것.
// (.env.example의 가이드: "Claude API 키는 Edge Function 환경변수로만 사용")
// 현재는 사내 개발/테스트 단계용.

const API_URL = 'https://api.anthropic.com/v1/messages';
const MODEL = 'claude-haiku-4-5-20251001'; // 빠르고 저렴 — OCR에 충분

const ALLOWED_MIME = ['image/jpeg', 'image/png', 'image/webp', 'image/gif'] as const;
type AllowedMime = typeof ALLOWED_MIME[number];

export type BusinessCardInfo = {
  name: string | null;
  organization: string | null;
  position: string | null;
  phone_mobile: string | null;
  phone_office: string | null;
  email: string | null;
};

export class ClaudeApiKeyMissingError extends Error {
  constructor() {
    super('AI 기능을 사용하려면 CLAUDE_API_KEY 설정이 필요해요.');
    this.name = 'ClaudeApiKeyMissingError';
  }
}

export class ClaudeApiError extends Error {
  friendlyMessage: string;
  raw?: string;
  constructor(friendlyMessage: string, raw?: string) {
    super(friendlyMessage);
    this.name = 'ClaudeApiError';
    this.friendlyMessage = friendlyMessage;
    this.raw = raw;
  }
}

function getApiKey(): string {
  const key = import.meta.env.VITE_CLAUDE_API_KEY as string | undefined;
  if (!key) throw new ClaudeApiKeyMissingError();
  return key;
}

function fileToBase64(file: File): Promise<string> {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => {
      const result = reader.result;
      if (typeof result !== 'string') {
        reject(new Error('파일 읽기 결과가 올바르지 않아요.'));
        return;
      }
      const comma = result.indexOf(',');
      resolve(comma >= 0 ? result.slice(comma + 1) : result);
    };
    reader.onerror = () => reject(new Error('파일을 읽지 못했어요.'));
    reader.readAsDataURL(file);
  });
}

function ensureAllowedMime(file: File): AllowedMime {
  const mime = file.type as AllowedMime;
  if (!ALLOWED_MIME.includes(mime)) {
    throw new ClaudeApiError(
      '지원하지 않는 이미지 형식이에요. JPG / PNG / WebP / GIF만 가능해요.',
      `mime=${file.type}`,
    );
  }
  return mime;
}

const PROMPT = `이 명함 이미지에서 다음 정보를 추출해 주세요.
값이 보이지 않거나 불확실하면 null로 채우세요.
한국어 명함이면 한국어로, 영문이면 그대로 유지하세요.
전화번호는 가능하면 010-1234-5678 또는 02-123-4567 형태로 하이픈을 넣어 정규화해 주세요.

JSON으로만 응답해 주세요. 추가 설명·마크다운·코드펜스 없이 JSON 객체만:

{
  "name": string | null,
  "organization": string | null,
  "position": string | null,
  "phone_mobile": string | null,
  "phone_office": string | null,
  "email": string | null
}`;

type ClaudeResponse = {
  content?: Array<{ type: string; text?: string }>;
  error?: { message?: string; type?: string };
};

function parseJsonFromText(text: string): BusinessCardInfo {
  // 모델이 코드펜스로 감쌀 수도 있어 robust하게 추출
  const trimmed = text.trim();
  const fenceMatch = trimmed.match(/```(?:json)?\s*([\s\S]*?)```/);
  const candidate = fenceMatch ? fenceMatch[1].trim() : trimmed;

  let parsed: unknown;
  try {
    parsed = JSON.parse(candidate);
  } catch {
    // 첫 { 부터 마지막 } 까지 추출 시도
    const start = candidate.indexOf('{');
    const end = candidate.lastIndexOf('}');
    if (start < 0 || end <= start) {
      throw new ClaudeApiError('명함 인식 결과를 해석하지 못했어요.', candidate.slice(0, 200));
    }
    parsed = JSON.parse(candidate.slice(start, end + 1));
  }

  const get = (k: keyof BusinessCardInfo): string | null => {
    if (!parsed || typeof parsed !== 'object') return null;
    const v = (parsed as Record<string, unknown>)[k];
    return typeof v === 'string' && v.trim() ? v.trim() : null;
  };

  return {
    name: get('name'),
    organization: get('organization'),
    position: get('position'),
    phone_mobile: get('phone_mobile'),
    phone_office: get('phone_office'),
    email: get('email'),
  };
}

export async function extractBusinessCardInfo(file: File): Promise<BusinessCardInfo> {
  const apiKey = getApiKey();
  const mime = ensureAllowedMime(file);

  if (file.size > 5 * 1024 * 1024) {
    throw new ClaudeApiError('이미지는 5MB 이하만 인식할 수 있어요.');
  }

  const base64 = await fileToBase64(file);

  let response: Response;
  try {
    response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01',
        'content-type': 'application/json',
        // 브라우저 직접 호출용 (CORS) — 프로덕션은 Edge Function 권장
        'anthropic-dangerous-direct-browser-access': 'true',
      },
      body: JSON.stringify({
        model: MODEL,
        max_tokens: 512,
        messages: [
          {
            role: 'user',
            content: [
              { type: 'image', source: { type: 'base64', media_type: mime, data: base64 } },
              { type: 'text', text: PROMPT },
            ],
          },
        ],
      }),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[claude] 네트워크 오류:', raw);
    throw new ClaudeApiError('Claude API에 연결하지 못했어요. 네트워크를 확인해 주세요.', raw);
  }

  if (!response.ok) {
    const errText = await response.text();
    console.error('[claude] HTTP', response.status, errText);
    if (response.status === 401 || response.status === 403) {
      throw new ClaudeApiError('Claude API 키가 잘못됐어요. 환경변수를 확인해 주세요.', errText);
    }
    if (response.status === 429) {
      throw new ClaudeApiError('Claude API 요청 한도를 초과했어요. 잠시 후 다시 시도해 주세요.', errText);
    }
    throw new ClaudeApiError('Claude API 호출 중 오류가 발생했어요.', errText);
  }

  const json = (await response.json()) as ClaudeResponse;
  const textBlock = json.content?.find((b) => b.type === 'text');
  if (!textBlock?.text) {
    throw new ClaudeApiError('명함 인식 응답이 비어 있어요.');
  }

  return parseJsonFromText(textBlock.text);
}

export function isClaudeApiConfigured(): boolean {
  return Boolean(import.meta.env.VITE_CLAUDE_API_KEY);
}
