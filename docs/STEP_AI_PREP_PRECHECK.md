# STEP-AI-PREP 사전 확인 문서 — AI 호출 인프라 + 4 placeholder 활성

> 작성일: 2026-05-08
> 범위: Edge Function (ai-chat) + aiClient.ts + 4 placeholder 활성
> 다음 단계: **Q1~Q5 결정 + 승인 → 코드 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| 신규 인프라 | Supabase Edge Function `ai-chat` + `src/lib/aiClient.ts` |
| 기존 자산 | `src/lib/claude.ts` (명함 OCR 전용, 브라우저 직접 호출 — 향후 Edge로 이전) / `AiPage.tsx` (현재 Mock 응답) |
| 활성 대상 | placeholder 4 곳 (ReportSectionCard / CurriculumTab / NextActionCard / [전체 AI 초안]) |
| 보안 원칙 | API 키는 Edge Function 환경변수만 / 사용자 명시 클릭 시만 호출 |

---

## 섹션 1 — V2 현재 AI 자산 + V7 참조

### 1-A. V2 이미 있는 것 ✅
- `src/lib/claude.ts` (196줄) — 명함 OCR 전용 직접 API 호출 (`VITE_CLAUDE_API_KEY` 브라우저 노출 ⚠️)
- `src/pages/ai/AiPage.tsx` + `AiChatWindow` + `aiUtils.ts` — 채팅 UI 완성, 응답은 Mock
- `ai_conversations` + `ai_messages` 테이블 (이미 사용 중)

### 1-B. V2 부족한 것 ❌
- `supabase/functions/ai-chat/` 디렉토리·index.ts 미존재
- 프론트 공용 호출 래퍼 (명함만 따로, AiPage·placeholder 4곳 통합 X)
- API 키 secret 등록 (박경수님 Supabase 콘솔에서 직접)
- prompt caching 전략

### 1-C. V7 자산 — 적극 차용 가치 큰 것 ⭐

V7 `src/lib/aiConfig.ts` (304줄) + `src/lib/v9/fileToText.ts` (226줄) + `AIAssistant.tsx` (1,882줄) 분석:

| V7 패턴 | 차용 형태 | 가치 |
|---|---|---|
| **`callClaude` / `callClaudeWithFile` / `callClaudeWithFiles` 3단 분리** | aiClient.ts 동일 분리 | text·단일파일·다중파일 케이스별 명확 |
| **rate limit 안정화 5종** ⭐⭐⭐ | Edge Function 그대로 차용 | ① 히스토리 5턴 ② 프롬프트 압축 ③ 429 exponential backoff (1·2·4초) ④ 친화 에러 메시지 ⑤ 잔량 5% 미만 사전 대기 |
| **`extractJson<T>(text)`** | aiClient.ts util | ` ```json``` ` 펜스·중괄호 robust 추출 |
| **fileToText (xlsx/csv/docx/text)** 226줄 | 그대로 차용 | curriculum-extract preset의 텍스트 추출 필수 |
| **`splitIntoChunks(text, 8000)`** | 그대로 차용 | 큰 파일 청크 분할 다중 호출 |
| **`formatExtractedForPrompt(docs)`** | 그대로 차용 | 여러 파일 prompt 통합 포맷 |
| **AIAssistant 메인 탭 5종** (인박스 / AI 초안 / 파일관리 / 태스크 템플릿 / 교육 팸플릿) | AiPage 확장은 **별도 STEP-AI-ASSIST**로 분리 | 1,882줄 너무 큼. STEP-AI-PREP은 인프라+placeholder만 |
| **"라이브러리 자료" 시스템** (`ai_docs_v1`) | 별도 STEP | 사용자 문서 → AI 참고 자료 |
| **모델 선택 UI** (Sonnet 4.6/Haiku 4.5/Opus 4.7) | 시스템 설정 메뉴 (별도 STEP) | preset별 default + 호출 override만 이번 STEP |
| **응답 후 액션** ([인쇄 PDF]·[HTML 다운로드]·[외부 AI 프롬프트 복사]) | STEP-EXPORT 후 | AI 초안 작성 페이지 |

### 1-D. V7 → V2 핵심 차이 (보안·아키텍처)

| 영역 | V7 | V2 (이번 STEP-AI-PREP) |
|---|---|---|
| **API 키** | `localStorage.getItem('claude_api_key_v1')` — 사용자별 입력 | **Supabase secret 서버 환경변수** (브라우저 X) |
| **호출 경로** | 브라우저 → Anthropic 직접 (`anthropic-dangerous-direct-browser-access: true`) | 브라우저 → Supabase Edge Function → Anthropic |
| **Rate limit** | 클라이언트 헤더 파싱 + 사전 대기 | Edge에서 동일 로직 + 사용자별 일일 한도 |
| **모델 설정** | localStorage `claude_model_v1` | Edge에서 preset별 default + 호출 override |
| **prompt cache** | (없음) | system 메시지 cache_control (90% 비용 절감) |

**원칙**: V7의 똑똑한 retry·압축·extractJson·fileToText 패턴은 그대로 차용 / 아키텍처는 V2 표준(Edge Function·Supabase secret·prompt cache)으로 한 단계 업그레이드

### 1-E. 박경수님 placeholder 4 곳 (현재 상태 + V7 참고 패턴)

| 위치 | 현재 | V7 참고 패턴 | 활성 후 동작 |
|---|---|---|---|
| `ReportSectionCard.tsx` 🤖 AI 버튼 | 안내 텍스트 | `callClaude` + JSON 추출 | 섹션 type별 데이터 → AI 본문 초안 (200~400자) |
| `CurriculumTab.tsx` [✦ AI 생성] | toast.info | **TaskTemplatesV9 묶음 Z** ⭐ — fileToText·splitIntoChunks·callClaudeWithFiles·extractJson 통합 패턴 그대로 | 첨부 파일 → 차시 JSON 배열 추출 |
| `NextActionCard.tsx` | 정적 status 안내 4종 | (V7엔 동일 패턴 없음 — 신규) | status + 통계 → 동적 다음 행동 추천 |
| `ReportBuilderTab.tsx` [전체 AI 초안] | toast.info | V7 EducationDetail 결과보고서 빌더 패턴 | 모든 auto 섹션 → chunk 분할 호출 |

---

## 섹션 2 — Edge Function 설계

### 2-A. 디렉토리·파일 (Deno 런타임)
```
supabase/functions/ai-chat/
  index.ts              ─ Deno fetch handler
  prompts.ts            ─ 4 placeholder별 system prompt
  types.ts              ─ 입출력 타입
  deno.json (선택)
```

### 2-B. 입출력 인터페이스
```ts
// 요청 (프론트 → Edge)
interface AiChatRequest {
  /** 사용처 식별 — prompt cache key 분리·로깅·할당량 */
  preset: 'report-section' | 'curriculum-extract' | 'next-action' | 'report-full' | 'chat';
  /** 시스템 프롬프트 override (선택) — 기본은 preset */
  system?: string;
  messages: Array<{ role: 'user' | 'assistant'; content: string | ContentBlock[] }>;
  /** 0.0 ~ 1.0 */
  temperature?: number;
  /** max output tokens */
  maxTokens?: number;
  /** 'sonnet' (기본) | 'haiku' */
  model?: 'sonnet' | 'haiku';
}

// 응답 (Edge → 프론트)
interface AiChatResponse {
  ok: boolean;
  text?: string;
  /** Anthropic usage */
  usage?: { input_tokens: number; output_tokens: number; cache_read_input_tokens?: number };
  error?: string;
}
```

### 2-C. 인증·Rate limit
- **JWT 검증**: Supabase Edge Function의 `--verify-jwt` 옵션 사용 → 인증된 사용자만 호출
- **rate limit**: 사용자별 분당 호출 수 제한 (Edge에서 in-memory 또는 Supabase ai_messages 카운트)
- **API 키**: `Deno.env.get('ANTHROPIC_API_KEY')` — Supabase Dashboard에서 secret 등록

### 2-D. prompt cache (Q3)
Anthropic prompt caching으로 system 메시지 캐시 (5분 TTL):
```json
{
  "system": [
    { "type": "text", "text": "...long system prompt...", "cache_control": { "type": "ephemeral" } }
  ]
}
```
4 preset마다 system이 다르므로 cache key도 분리됨. 같은 preset 반복 호출 시 90% 비용 절감.

### 2-E. V7 rate limit 안정화 5종 — Edge Function에 차용 ⭐

V7 aiConfig.ts의 패턴을 Deno Edge Function으로 포팅:

```ts
// Edge Function 내부
const PREEMPTIVE_RATIO = 0.05;
const MAX_RETRIES = 3;

let lastRateLimit = {
  inputRemaining: undefined,
  inputResetAt: undefined,
  retryAfter: undefined,
};

function parseRateLimitHeaders(headers: Headers) {
  return {
    inputRemaining: Number(headers.get('anthropic-ratelimit-input-tokens-remaining') ?? '') || undefined,
    inputLimit: Number(headers.get('anthropic-ratelimit-input-tokens-limit') ?? '') || undefined,
    inputResetAt: headers.get('anthropic-ratelimit-input-tokens-reset') ?? undefined,
    retryAfter: Number(headers.get('retry-after') ?? '') || undefined,
  };
}

async function fetchWithRetry(url: string, init: RequestInit) {
  let attempt = 0;
  while (true) {
    await preemptiveWaitIfLow();         // ⑤ 잔량 5% 미만 사전 대기
    const res = await fetch(url, init);
    lastRateLimit = parseRateLimitHeaders(res.headers);
    if (res.status !== 429) return res;
    if (attempt >= MAX_RETRIES) return res;
    const wait = Math.max(
      (lastRateLimit.retryAfter ?? 0) * 1000,
      Math.pow(2, attempt) * 1000,        // ③ 1·2·4초 backoff
    );
    await new Promise(r => setTimeout(r, wait));
    attempt++;
  }
}

// 시스템 프롬프트 압축
function compactPrompt(s: string): string {
  return s.replace(/[ \t]+\n/g, '\n').replace(/\n{3,}/g, '\n\n').trim();
}
```

V7의 `extractJson<T>` / `splitIntoChunks` / `formatExtractedForPrompt`는 **프론트(`aiClient.ts`)**에 그대로 둠 — Edge에서 chunk 분할 호출은 비효율(왕복·timeout 위험).

---

## 섹션 3 — 프론트 래퍼 + V7 차용 유틸

### 3-A. `src/lib/aiClient.ts` (신규)
- supabase.functions.invoke('ai-chat', { body }) 호출
- 에러 처리·toast 메시지 한글 표준화
- loading state — Promise 반환 (호출자 useState 관리)
- 사용자 명시 클릭 시만 호출 (자동 실행 금지 — 박경수님 명세)

### 3-B. `src/lib/aiUtils.ts` (신규 — V7 차용)
V7 `extractJson` + `splitIntoChunks` + `formatExtractedForPrompt` 그대로 차용 — Edge 호출 후 응답 처리·청크 분할에 사용:

```ts
/** AI 응답에서 JSON 부분 robust 추출 (V7 그대로) */
export function extractJson<T>(text: string): T | null;

/** 큰 텍스트 chunk 분할 (V7 그대로) */
export function splitIntoChunks(text: string, chunkSize?: number): string[];
```

### 3-C. `src/lib/fileToText.ts` (신규 — V7 차용 226줄)
V7 `src/lib/v9/fileToText.ts` 그대로 포팅. xlsx·csv·docx·text 추출. CurriculumTab [✦ AI 생성]에서 활용:

```ts
export type FileTextSource = 'xlsx' | 'csv' | 'docx' | 'text' | 'unknown';
export interface ExtractedDoc { ... }
export function classifyFile(file: File): FileTextSource;
export async function fileToText(file: File): Promise<ExtractedDoc | null>;
export function formatExtractedForPrompt(docs: ExtractedDoc[]): string;
```

⚠️ V7은 xlsx 라이브러리 동적 import 사용. V2도 패키지 추가 필요 — Q5에서 결정.

### 3-B. 인터페이스
```ts
// src/lib/aiClient.ts
export interface CallAiOptions {
  preset: AiChatRequest['preset'];
  messages: AiChatRequest['messages'];
  system?: string;
  temperature?: number;
  maxTokens?: number;
  model?: 'sonnet' | 'haiku';
}

export async function callAi(options: CallAiOptions): Promise<{
  ok: boolean;
  text?: string;
  errorMessage?: string;
}>;

/** 명함 OCR — 기존 claude.ts를 Edge로 옮긴 후 활용 (이번엔 별도) */
export async function extractBusinessCardViaEdge(file: File): Promise<BusinessCardInfo>;
```

### 3-C. 호출 패턴 (각 placeholder)
```ts
// ReportSectionCard.tsx (예시)
async function handleAiClick() {
  setAiLoading(true);
  try {
    const res = await callAi({
      preset: 'report-section',
      messages: [
        {
          role: 'user',
          content: `프로그램 데이터:\n${JSON.stringify(programData)}\n\n섹션: ${section.title}\n\n위 데이터를 바탕으로 ${section.title} 섹션 본문을 한국어로 작성해줘.`,
        },
      ],
      maxTokens: 1024,
    });
    if (!res.ok) {
      toast.error(res.errorMessage ?? 'AI 호출에 실패했어요.');
      return;
    }
    setAiText(res.text ?? '');
  } finally {
    setAiLoading(false);
  }
}
```

---

## 섹션 4 — 4 placeholder별 system prompt 설계

### 4-A. ReportSectionCard 🤖 AI (`preset: 'report-section'`)
```
당신은 한국 비즈니스 결과보고서 작성 전문가입니다.
주어진 프로그램 데이터를 바탕으로 [섹션 제목] 섹션 본문을 작성하세요.

규칙:
- 한국어로 작성. 격식체.
- 마크다운 없이 plain text + 줄바꿈만.
- 200~400자 내외.
- 숫자·날짜는 데이터 그대로 인용.
- 추측·과장 금지. 데이터에 없는 내용 만들지 않음.
```

### 4-B. CurriculumTab [✦ AI 생성] (`preset: 'curriculum-extract'`)
```
당신은 운영안·일정표·PDF에서 교육 차시를 추출하는 전문가입니다.

[추출 원칙]
1. 표·일정 모든 행을 차시 항목으로 변환
2. 시간(시작·종료), 주제, 강사 (가능하면), 내용 추출
3. JSON 배열만 출력. 코드펜스·설명 X.

[형식]
[{"session_no":1,"title":"...","start_time":"HH:MM","end_time":"HH:MM","content":"..."}, ...]
```

### 4-C. NextActionCard AI (`preset: 'next-action'`)
```
당신은 한국 비즈니스 프로젝트 매니저입니다.
프로그램의 status와 통계를 보고 다음에 할 일 3~5개를 추천하세요.

규칙:
- 한국어, 격식체.
- 항목당 한 줄 (50자 이내).
- "📌 ..." 형식.
- 데이터에 근거. 추측 금지.
```

### 4-D. [전체 AI 초안] (`preset: 'report-full'`)
- 모든 auto 섹션 데이터를 한 번에 모아 전송
- system: 결과보고서 작성 전문가
- output: 각 섹션 markdown 형식으로 chunk 분할
- 클라이언트가 응답 파싱 → 각 섹션의 content에 INSERT

---

## 섹션 5 — 비용·사용량 통제 (Q4)

### 5-A. Anthropic 가격 (2026-05 기준)
- **Sonnet 4.7**: $3/M input, $15/M output (cache: $0.30/M read)
- **Haiku 4.5**: $0.25/M input, $1.25/M output (cache: $0.025/M read)

### 5-B. 통제 옵션
| 옵션 | 동작 | 추천 |
|---|---|---|
| **A. 일일 한도** | 사용자별 일일 호출 수 제한 (예: 50회) | ✅ **추천** — Edge에서 ai_messages 카운트 |
| B. token 한도 | 호출당 max_tokens 제한 + 입력 길이 제한 | ✅ 기본 적용 |
| C. 모델 자동 선택 | 입력 길이별 sonnet/haiku 자동 선택 | ⚠️ 복잡, 일단 수동 |
| D. 사용량 추적 UI | AiPage에 누적 token 표시 | ⚠️ 후속 STEP |

**제 추천**: A + B 기본 적용. C·D는 후속.

---

## 섹션 6 — 박경수님 의사결정 5개 (Q1~Q5)

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| **Q1** | **API 키 관리** — A(Supabase secret) / B(V7 패턴 사용자별 localStorage) | ✅ **A** — Supabase Dashboard에서 `ANTHROPIC_API_KEY` secret 등록. 브라우저에 노출 X. V7 패턴(B)는 보안 위험으로 사용 안 함 |
| **Q2** | **기본 모델** | ✅ **Sonnet 4.7** + NextAction만 Haiku 4.5. AiPage·각 placeholder는 호출 시 override 가능. **V7처럼 사용자가 모델 변경 UI 추가는 별도 STEP** (시스템 설정 메뉴) |
| **Q3** | **prompt caching + V7 rate limit 안정화 5종** | ✅ **적용** — V7의 ① 히스토리 5턴 ② 프롬프트 압축 ③ 429 exp backoff ④ 친화 에러 ⑤ 잔량 5% 미만 사전 대기 모두 Edge에 차용 + Anthropic prompt cache 추가 |
| **Q4** | **V7 유틸 차용 + 패키지** | ✅ **차용**: `extractJson` / `splitIntoChunks` / `fileToText` 모두 V2 `src/lib/`로 포팅. 패키지 추가: **`xlsx` (sheetjs)** — fileToText의 xlsx 처리에 필수 (V7도 사용) |
| **Q5** | **Stage 분할** | ✅ **2 commit 분할**: ① 인프라 (Edge + aiClient + aiUtils + fileToText + AiPage 실연결) ② 4 placeholder 활성. **AiPage 1,882줄 V7 AIAssistant는 별도 STEP-AI-ASSIST** (인박스/AI초안작성/파일관리/태스크템플릿 5탭은 큰 작업) |

---

## 섹션 7 — V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | Edge Function index.ts ~180 / aiClient.ts ~150 / placeholder 활성은 +50~100줄/파일 | ✅ |
| V-2 catch + 한글 | `console.error('[step-ai/<area>] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown | Anthropic 응답은 inline anonymous type | ✅ |
| V-4 한글 메시지 | 모두 한글 (placeholder 안내·에러·결과) | ✅ |
| V-5 cancelled 가드 | useEffect 비동기 fetch에 적용. AI 호출은 사용자 클릭이라 cancel 우선순위 낮음 (AbortController 옵션) | ⚠️ 검토 |
| V-6 직접 fetch | aiClient는 supabase.functions.invoke 호출 — 각 placeholder 자체 호출 | ✅ |
| V-7 디자인 토큰 | 변경 없음 (UI 추가 X, 기존 placeholder 활성만) | ✅ |

---

## 섹션 8 — 작업 순서 (승인 후)

### Stage AI-① — 인프라 (60~80분, 1 commit)
1. **Q1 박경수님 직접 — Supabase Dashboard에서 ANTHROPIC_API_KEY secret 등록**
2. `supabase/functions/ai-chat/index.ts` 신규 (Deno) — JWT 검증 + 4 preset routing + cache + rate limit
3. `supabase/functions/ai-chat/prompts.ts` — 4 system prompt 정리
4. `src/lib/aiClient.ts` — callAi() 공용 래퍼
5. **Supabase CLI로 deploy** — 박경수님 직접 또는 안내
6. AiPage 확장 (Mock → 실제 호출, preset='chat')
7. tsc -b → V-1~V-7 → 보고서 → commit

### Stage AI-② — 4 placeholder 활성 (60~80분, 1 commit)
1. ReportSectionCard 🤖 AI — preset='report-section'
2. CurriculumTab [✦ AI 생성] — preset='curriculum-extract' + 파일 텍스트 추출 (jsdom·xlsx 등 라이브러리 검토)
3. NextActionCard — preset='next-action' (status별 동적)
4. ReportBuilderTab [전체 AI 초안] — preset='report-full' + chunk 분할
5. tsc -b → V-1~V-7 → 보고서 → commit

**롤백**: 각 commit 별도 revert. Edge Function은 deploy 별도라 코드만 revert해도 함수는 살아있음 (호출 안 하면 비용 0).

---

## 섹션 8.5 — V7 AIAssistant 후속 STEP 예고 (참고)

V7 `AIAssistant.tsx` 1,882줄에는 STEP-AI-PREP 범위 외에 다음이 포함됨 — 별도 STEP으로:

| V7 기능 | V2 후속 STEP 후보 |
|---|---|
| 📥 인박스 — AI가 분류한 입력(메모·이메일·메신저) 모음 | STEP-AI-INBOX |
| ✍️ AI 초안 작성 — 견적서·제안서·보고서 등 문서별 templates | STEP-AI-DRAFT |
| 📁 파일 관리 — 라이브러리 자료(`ai_docs_v1`) + Drive 동기화 | STEP-AI-LIBRARY |
| 📋 태스크 템플릿 — 운영안 PDF/엑셀 → 태스크 자동 추출 (TaskTemplatesV9 묶음 Z) | STEP-AI-TASK-EXTRACT (이번 CurriculumTab 활성과 패턴 동일) |
| 🎓 교육 팸플릿 관리 — 교육 결과보고서 자동 생성 | STEP-AI-EDU-DRAFT |

이번 STEP-AI-PREP은 **인프라 + 4 placeholder만**. AiPage UI는 기존 채팅 그대로 두고 응답만 Mock → 실제로 교체.

---

## 섹션 9 — 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q5 결정 → Stage AI-① 진입

**Stage AI-① 진입 전 박경수님이 직접 해야 할 것**:
1. **Supabase Dashboard → Edge Functions → Secrets**에 `ANTHROPIC_API_KEY` 등록 (Anthropic Console에서 키 발급)
2. **Supabase CLI 설치** (Stage AI-① 끝나면 deploy 명령 안내)
3. (선택) **billing limit** 설정 — Anthropic Console에서 월 한도 (예: $20)

다른 의견 있으면 알려주세요. 특히:
- **Q5 Stage 분할** — "한 번에 가자" 원하시면 한 commit으로
- **Q4 일일 한도 50회** — 박경수님 사용 패턴에 따라 100~200 또는 무제한도 가능
