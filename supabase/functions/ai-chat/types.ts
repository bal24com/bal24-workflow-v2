// bal24 v2 — Edge Function ai-chat 입출력 타입 (Stage AI-①)
// Deno 환경에서 컴파일됨.

export type AiPreset =
  | 'report-section'
  | 'curriculum-extract'
  | 'next-action'
  | 'report-full'
  | 'chat';

export type AiModel = 'sonnet' | 'haiku';

export interface ContentBlockText {
  type: 'text';
  text: string;
}

export interface ContentBlockImage {
  type: 'image';
  source: {
    type: 'base64';
    media_type: string;
    data: string;
  };
}

export interface ContentBlockDocument {
  type: 'document';
  source: {
    type: 'base64';
    media_type: 'application/pdf';
    data: string;
  };
  title?: string;
}

export type ContentBlock = ContentBlockText | ContentBlockImage | ContentBlockDocument;

export interface AiChatMessage {
  role: 'user' | 'assistant';
  content: string | ContentBlock[];
}

export interface AiChatRequest {
  preset: AiPreset;
  /** 시스템 프롬프트 override (선택) — 기본은 preset 기반 */
  systemOverride?: string;
  messages: AiChatMessage[];
  temperature?: number;
  maxTokens?: number;
  model?: AiModel;
}

export interface AiChatResponse {
  ok: boolean;
  text?: string;
  usage?: {
    input_tokens: number;
    output_tokens: number;
    cache_read_input_tokens?: number;
    cache_creation_input_tokens?: number;
  };
  error?: string;
  /** rate limit 정보 (디버깅·UI용) */
  rateLimit?: {
    inputRemaining?: number;
    inputLimit?: number;
    inputResetAt?: string;
  };
}
