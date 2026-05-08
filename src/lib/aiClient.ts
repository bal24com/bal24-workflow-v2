// bal24 v2 — AI 호출 프론트 래퍼 (Stage AI-①)
// supabase.functions.invoke('ai-chat', body) — 인증된 사용자만.
// 사용자 명시 클릭 시만 호출 (자동 실행 금지 — 박경수님 명세).

import { supabase } from './supabase';

export type AiPreset =
  | 'report-section'
  | 'curriculum-extract'
  | 'next-action'
  | 'report-full'
  | 'chat';

export type AiModel = 'sonnet' | 'haiku';

export interface AiContentBlockText {
  type: 'text';
  text: string;
}

export interface AiContentBlockImage {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface AiContentBlockDocument {
  type: 'document';
  source: {
    type: 'base64';
    media_type: 'application/pdf';
    data: string;
  };
  title?: string;
}

export type AiContentBlock = AiContentBlockText | AiContentBlockImage | AiContentBlockDocument;

export interface AiMessage {
  role: 'user' | 'assistant';
  content: string | AiContentBlock[];
}

export interface CallAiOptions {
  preset: AiPreset;
  messages: AiMessage[];
  systemOverride?: string;
  temperature?: number;
  /** 256 ~ 4096 (Edge에서 clamp) */
  maxTokens?: number;
  model?: AiModel;
}

export interface CallAiResult {
  ok: boolean;
  text?: string;
  errorMessage?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  rateLimit?: {
    inputRemaining?: number;
    inputLimit?: number;
    inputResetAt?: string;
  };
}

/** 텍스트만 — 가장 단순한 호출 */
export async function callAi(options: CallAiOptions): Promise<CallAiResult> {
  const { data, error } = await supabase.functions.invoke('ai-chat', {
    body: options,
  });

  type Body = {
    ok: boolean;
    text?: string;
    error?: string;
    usage?: CallAiResult['usage'];
    rateLimit?: CallAiResult['rateLimit'];
  };

  // FunctionsHttpError(=Edge가 4xx/5xx로 응답): supabase-js가 error에 context를 담아 던짐.
  // 본문에 우리 표준 에러 객체가 있을 수 있으니 우선 읽어본다.
  if (error) {
    const raw = error.message ?? '';
    console.error('[ai-client] invoke 실패:', raw, error);
    let serverMessage: string | undefined;
    type WithContext = { context?: { json?: () => Promise<unknown>; text?: () => Promise<string> } };
    const ctx = (error as unknown as WithContext).context;
    if (ctx) {
      try {
        if (typeof ctx.json === 'function') {
          const parsed = (await ctx.json()) as Body | null;
          if (parsed && typeof parsed === 'object') {
            serverMessage = parsed.error;
            console.error('[ai-client] server error body:', parsed);
          }
        } else if (typeof ctx.text === 'function') {
          const txt = await ctx.text();
          if (txt) {
            console.error('[ai-client] server error text:', txt);
            serverMessage = txt.length > 200 ? txt.slice(0, 200) + '…' : txt;
          }
        }
      } catch (parseErr) {
        const r = parseErr instanceof Error ? parseErr.message : '';
        console.error('[ai-client] error body 파싱 실패:', r);
      }
    }
    return {
      ok: false,
      errorMessage: serverMessage ?? `AI 호출 실패: ${raw || '네트워크 오류'}`,
    };
  }

  const body = data as Body | null;

  if (!body) {
    return { ok: false, errorMessage: 'AI 응답이 비어 있어요.' };
  }
  if (!body.ok) {
    return { ok: false, errorMessage: body.error ?? 'AI 호출에 실패했어요.' };
  }

  return {
    ok: true,
    text: body.text ?? '',
    usage: body.usage,
    rateLimit: body.rateLimit,
  };
}

/** 단일 파일 (PDF·이미지) 첨부 호출 — Anthropic 멀티모달 */
export async function callAiWithFile(
  file: File,
  userPrompt: string,
  preset: AiPreset,
  opts?: { maxTokens?: number; systemOverride?: string },
): Promise<CallAiResult> {
  const base64 = await fileToBase64(file);
  const mime = inferMime(file);
  if (!mime) {
    return {
      ok: false,
      errorMessage: '지원하지 않는 파일 형식이에요. PDF·JPG·PNG·WEBP·GIF만 가능해요.',
    };
  }
  const isPdf = mime === 'application/pdf';
  const block: AiContentBlock = isPdf
    ? {
        type: 'document',
        source: { type: 'base64', media_type: 'application/pdf', data: base64 },
        title: file.name,
      }
    : {
        type: 'image',
        source: { type: 'base64', media_type: mime, data: base64 },
      };
  return callAi({
    preset,
    messages: [
      {
        role: 'user',
        content: [block, { type: 'text', text: userPrompt }],
      },
    ],
    maxTokens: opts?.maxTokens ?? 2048,
    systemOverride: opts?.systemOverride,
  });
}

/** 다중 파일 첨부 호출 */
export async function callAiWithFiles(
  files: Array<{ data: string; mimeType: string; name: string }>,
  userPrompt: string,
  preset: AiPreset,
  opts?: { maxTokens?: number; systemOverride?: string },
): Promise<CallAiResult> {
  if (files.length === 0) {
    return callAi({
      preset,
      messages: [{ role: 'user', content: userPrompt }],
      maxTokens: opts?.maxTokens ?? 2048,
      systemOverride: opts?.systemOverride,
    });
  }

  const blocks: AiContentBlock[] = files.map((f) => {
    const isPdf = f.mimeType === 'application/pdf';
    const isImage = f.mimeType.startsWith('image/');
    if (!isPdf && !isImage) {
      throw new Error(`지원하지 않는 파일: ${f.name} (${f.mimeType})`);
    }
    return isPdf
      ? {
          type: 'document',
          source: { type: 'base64', media_type: 'application/pdf', data: f.data },
          title: f.name,
        }
      : {
          type: 'image',
          source: { type: 'base64', media_type: f.mimeType, data: f.data },
        };
  });
  blocks.push({ type: 'text', text: userPrompt });

  return callAi({
    preset,
    messages: [{ role: 'user', content: blocks }],
    maxTokens: opts?.maxTokens ?? 3072,
    systemOverride: opts?.systemOverride,
  });
}

/** File → base64 (data: 부분 제거) */
export async function fileToBase64(file: File): Promise<string> {
  return new Promise<string>((res, rej) => {
    const r = new FileReader();
    r.onload = () => {
      const result = r.result;
      if (typeof result !== 'string') {
        rej(new Error('파일 읽기 결과가 올바르지 않아요.'));
        return;
      }
      const idx = result.indexOf(',');
      res(idx >= 0 ? result.slice(idx + 1) : result);
    };
    r.onerror = () => rej(new Error('파일을 읽지 못했어요.'));
    r.readAsDataURL(file);
  });
}

function inferMime(file: File): string | null {
  const mime = (file.type || '').toLowerCase();
  if (mime) return mime;
  const n = file.name.toLowerCase();
  if (/\.pdf$/.test(n)) return 'application/pdf';
  if (/\.png$/.test(n)) return 'image/png';
  if (/\.(jpe?g)$/.test(n)) return 'image/jpeg';
  if (/\.webp$/.test(n)) return 'image/webp';
  if (/\.gif$/.test(n)) return 'image/gif';
  return null;
}
