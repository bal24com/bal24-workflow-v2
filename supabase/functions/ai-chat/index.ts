// bal24 v2 — Supabase Edge Function ai-chat (Stage AI-①)
// V7 aiConfig.ts rate limit 안정화 5종 + Anthropic prompt cache 차용.
// JWT 검증 + ANTHROPIC_API_KEY (Supabase secret) + 4 preset routing.

// @ts-expect-error — Deno 런타임 import
import { serve } from 'https://deno.land/std@0.224.0/http/server.ts';
import type {
  AiChatRequest, AiChatResponse, AiModel,
} from './types.ts';
import { getSystemPrompt } from './prompts.ts';

const ANTHROPIC_URL = 'https://api.anthropic.com/v1/messages';
const ANTHROPIC_VERSION = '2023-06-01';

// 모델 매핑 (호출 시 override 가능)
const MODEL_ID: Record<AiModel, string> = {
  sonnet: 'claude-sonnet-4-7',
  haiku: 'claude-haiku-4-5-20251001',
};

// preset별 default 모델
const PRESET_DEFAULT_MODEL: Record<string, AiModel> = {
  'report-section': 'sonnet',
  'curriculum-extract': 'sonnet',
  'next-action': 'haiku',          // 짧은 작업
  'report-full': 'sonnet',
  'chat': 'sonnet',
};

const MAX_HISTORY_TURNS = 5;
const MAX_RETRIES = 3;
const PREEMPTIVE_RATIO = 0.05;
const RATE_LIMIT_FRIENDLY = '⏳ AI 분당 토큰 한도가 일시적으로 초과되었어요. 잠시 후(약 1분) 다시 시도해 주세요.';

let lastRateLimit: {
  inputRemaining?: number;
  inputLimit?: number;
  inputResetAt?: string;
  retryAfter?: number;
} = {};

function parseRateLimitHeaders(headers: Headers) {
  const num = (k: string): number | undefined => {
    const v = headers.get(k);
    if (v == null) return undefined;
    const n = Number(v);
    return Number.isFinite(n) ? n : undefined;
  };
  return {
    inputRemaining: num('anthropic-ratelimit-input-tokens-remaining'),
    inputLimit: num('anthropic-ratelimit-input-tokens-limit'),
    inputResetAt: headers.get('anthropic-ratelimit-input-tokens-reset') ?? undefined,
    retryAfter: num('retry-after'),
  };
}

function sleep(ms: number): Promise<void> {
  return new Promise((res) => setTimeout(res, ms));
}

async function preemptiveWaitIfLow(): Promise<void> {
  const r = lastRateLimit;
  if (r.inputRemaining == null || r.inputLimit == null || r.inputLimit <= 0) return;
  const ratio = r.inputRemaining / r.inputLimit;
  if (ratio >= PREEMPTIVE_RATIO) return;
  if (!r.inputResetAt) return;
  const resetMs = new Date(r.inputResetAt).getTime();
  if (!Number.isFinite(resetMs) || resetMs <= Date.now()) return;
  const wait = Math.min(resetMs - Date.now(), 60_000);
  if (wait > 0) {
    console.info(`[ai-chat] 잔량 ${Math.round(ratio * 100)}% — 사전 대기 ${wait}ms`);
    await sleep(wait);
  }
}

function compactPrompt(s: string): string {
  return s
    .replace(/[ \t]+\n/g, '\n')
    .replace(/\n{3,}/g, '\n\n')
    .replace(/^\s+|\s+$/g, '');
}

function trimHistory(
  messages: AiChatRequest['messages'],
  maxTurns = MAX_HISTORY_TURNS,
): AiChatRequest['messages'] {
  if (messages.length <= maxTurns) return messages;
  const trimmed = messages.slice(-maxTurns);
  while (trimmed.length > 0 && trimmed[0].role === 'assistant') trimmed.shift();
  return trimmed;
}

async function fetchWithRetry(url: string, init: RequestInit): Promise<Response> {
  let attempt = 0;
  while (true) {
    await preemptiveWaitIfLow();
    const res = await fetch(url, init);
    lastRateLimit = parseRateLimitHeaders(res.headers);

    if (res.status !== 429) return res;
    if (attempt >= MAX_RETRIES) return res;

    const headerWait = (lastRateLimit.retryAfter ?? 0) * 1000;
    const expBackoff = Math.pow(2, attempt) * 1000;
    const wait = Math.max(headerWait, expBackoff);
    console.warn(`[ai-chat] 429 rate limit — ${wait}ms 후 재시도 (${attempt + 1}/${MAX_RETRIES})`);
    await sleep(wait);
    attempt++;
  }
}

const CORS_HEADERS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type',
  'Access-Control-Allow-Methods': 'POST, OPTIONS',
};

function jsonResponse(body: AiChatResponse, status = 200): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { ...CORS_HEADERS, 'Content-Type': 'application/json' },
  });
}

serve(async (req: Request) => {
  if (req.method === 'OPTIONS') {
    return new Response('ok', { headers: CORS_HEADERS });
  }
  if (req.method !== 'POST') {
    return jsonResponse({ ok: false, error: 'POST 만 허용됩니다.' }, 405);
  }

  // @ts-expect-error — Deno
  const apiKey = Deno.env.get('ANTHROPIC_API_KEY');
  if (!apiKey) {
    console.error('[ai-chat] ANTHROPIC_API_KEY secret 미설정');
    return jsonResponse({ ok: false, error: 'AI 서비스가 아직 설정되지 않았어요. 관리자에게 문의해 주세요.' }, 500);
  }

  let body: AiChatRequest;
  try {
    body = (await req.json()) as AiChatRequest;
  } catch {
    return jsonResponse({ ok: false, error: '요청 본문을 읽지 못했어요.' }, 400);
  }

  const { preset, messages, systemOverride, temperature, maxTokens, model } = body;
  if (!preset || !messages || messages.length === 0) {
    return jsonResponse({ ok: false, error: 'preset 또는 messages가 비어 있어요.' }, 400);
  }

  const chosenModel = MODEL_ID[model ?? PRESET_DEFAULT_MODEL[preset] ?? 'sonnet'];
  const systemText = compactPrompt(systemOverride ?? getSystemPrompt(preset));
  const trimmed = trimHistory(messages);

  // Anthropic API 호출 — system은 cache_control 적용
  const payload = {
    model: chosenModel,
    max_tokens: Math.min(Math.max(maxTokens ?? 2048, 256), 4096),
    temperature: typeof temperature === 'number' ? temperature : 0.7,
    system: [
      { type: 'text', text: systemText, cache_control: { type: 'ephemeral' } },
    ],
    messages: trimmed,
  };

  let res: Response;
  try {
    res = await fetchWithRetry(ANTHROPIC_URL, {
      method: 'POST',
      headers: {
        'x-api-key': apiKey,
        'anthropic-version': ANTHROPIC_VERSION,
        'content-type': 'application/json',
      },
      body: JSON.stringify(payload),
    });
  } catch (err) {
    const raw = err instanceof Error ? err.message : String(err);
    console.error('[ai-chat] 네트워크 오류:', raw);
    return jsonResponse({ ok: false, error: 'AI 서비스에 연결하지 못했어요. 잠시 후 다시 시도해 주세요.' }, 502);
  }

  if (!res.ok) {
    const errText = await res.text();
    console.error('[ai-chat] HTTP', res.status, errText);
    if (res.status === 401 || res.status === 403) {
      return jsonResponse({ ok: false, error: 'AI 서비스 인증에 실패했어요. 관리자에게 문의해 주세요.' }, 500);
    }
    if (res.status === 429) {
      return jsonResponse({ ok: false, error: RATE_LIMIT_FRIENDLY }, 429);
    }
    return jsonResponse({ ok: false, error: 'AI 호출 중 오류가 발생했어요.' }, 502);
  }

  const data = await res.json() as {
    content?: Array<{ type: string; text?: string }>;
    usage?: AiChatResponse['usage'];
  };
  const text = data.content?.find((b) => b.type === 'text')?.text ?? '';

  return jsonResponse({
    ok: true,
    text,
    usage: data.usage,
    rateLimit: {
      inputRemaining: lastRateLimit.inputRemaining,
      inputLimit: lastRateLimit.inputLimit,
      inputResetAt: lastRateLimit.inputResetAt,
    },
  });
});
