# STEP-AI-PREP Stage AI-① 이식 결과 보고 — AI 인프라 구축

> 작업일: 2026-05-08
> 박경수님 결정: Q1~Q5 모두 추천대로 (Supabase Secret + Sonnet 4.7/Haiku 4.5 + V7 rate limit 5종 + V7 utils + 2 commit 분할)
> 범위: Edge Function `ai-chat` + 프론트 래퍼 `aiClient` + 유틸 (`aiUtils`·`fileToText`) + 기존 `/ai` 페이지 callAi 전환

---

## 매핑 요약 (V7 → V2)

| V7 (참조) | V2 (이식 결과) |
|---|---|
| `lib/ai/callClaude.ts` (461줄) — 5 패턴 (트림·압축·429 백오프·친화 메시지·예방 대기) | ✅ Deno 환경에 맞춰 `supabase/functions/ai-chat/index.ts` 로 이식 |
| `lib/extractJson.ts` | ✅ `src/lib/aiUtils.ts` (extractJson<T>) |
| `lib/splitIntoChunks.ts` | ✅ `src/lib/aiUtils.ts` (splitIntoChunks) |
| `lib/fileToText.ts` (226줄) — XLSX 3-tier·CSV·DOCX·TXT | ✅ `src/lib/fileToText.ts` (V2 표준 적용) |
| V7 클라이언트 직접 fetch (CORS 우회 위해 직접) | 🔄 V2 는 Edge Function 우회 (브라우저 → Supabase Edge → Anthropic) — JWT 인증 + 키 노출 차단 |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것 (V7 차용)
- **rate limit 5 패턴**: parseRateLimitHeaders·preemptiveWaitIfLow·fetchWithRetry·trimHistory·compactPrompt
- **prompt cache**: cache_control: ephemeral 자동 적용 (system + 마지막 user message)
- **fileToText**: XLSX 3-tier fallback (sheet_to_csv → sheet_to_json → 셀 단위), CSV·DOCX·TXT
- **extractJson + splitIntoChunks**: AI 응답 후처리·긴 텍스트 분할

### 버린 것
- ❌ V7 의 클라이언트 직접 fetch — V2 는 Edge Function 만 (보안: API 키 서버에만 보관)
- ❌ V7 의 LocalStorage 기반 호출 카운터 — V2 는 사용 금지

### 새로 작성한 것
- `supabase/functions/ai-chat/types.ts` — request/response 타입
- `supabase/functions/ai-chat/prompts.ts` — 5 preset 시스템 프롬프트 (한국어 격식·데이터 기반·추측 금지)
- `supabase/functions/ai-chat/index.ts` — Deno serve handler + V7 5 패턴 + Anthropic 호출
- `src/lib/aiUtils.ts` — extractJson<T> + splitIntoChunks
- `src/lib/fileToText.ts` — V7 226줄 V2 표준 적용 이식
- `src/lib/aiClient.ts` — callAi / callAiWithFile / callAiWithFiles 프론트 래퍼
- `src/pages/ai/aiUtils.ts` — sendToAi 가 callAi('chat') 사용하도록 전환 + 배포 전 Mock fallback 유지

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/functions/ai-chat/types.ts` (신규) | 70 | 공유 타입 |
| `supabase/functions/ai-chat/prompts.ts` (신규) | 83 | 5 preset 시스템 프롬프트 |
| `supabase/functions/ai-chat/index.ts` (신규) | **212** | Deno serve + V7 rate limit 5 + Anthropic |
| `src/lib/aiUtils.ts` (신규) | 73 | extractJson + splitIntoChunks |
| `src/lib/fileToText.ts` (신규) | 249 | XLSX·CSV·DOCX·TXT 통합 추출 |
| `src/lib/aiClient.ts` (신규) | 223 | callAi/callAiWithFile/callAiWithFiles |
| `src/pages/ai/aiUtils.ts` (수정) | 153 | sendToAi → callAi('chat') 전환 + Mock fallback |

**합계 신규 코드**: ~1,063줄 (Edge 365 + 프론트 698) / 모두 < 400줄 (최대 249)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (최대 **249줄** = `fileToText.ts`)
- [x] **V-2** catch / error 모두 `console.error('[ai-chat] ...', err)` / `[ai-client]` / `[file-to-text]` + 한글 toast (`aiUtils.ts` Mock fallback 안내문 포함)
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건 (XLSX·mammoth interop 만 명시 interface)
- [x] **V-4** 사용자 노출 메시지 전부 한글 (rate limit·인증·payload·네트워크·안내문 모두)
- [x] **V-5** useEffect 비동기 가드 — `aiClient` 자체는 명령형이라 해당 없음, 호출부 (`AiPage`) 는 STEP 21 에서 이미 cancelled 가드 적용됨
- [x] **V-6** Supabase 직접 fetch — 인증은 `supabase.functions.invoke('ai-chat')` 가 자동으로 user JWT 첨부 (Edge 에서 검증)
- [x] **V-7** 디자인 토큰 일관성 — UI 변경 없음 (다음 Stage AI-② 에서 placeholder 활성화 시)

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0** (mammoth 동적 import는 변수 이름 우회 + `/* @vite-ignore */`)
- `npx vite build`: ✅ **built in 2.79s**
- 기존 `/ai` 페이지 동작: Edge 미배포 시 Mock fallback (배포 안내 toast)

---

## 짚어둘 점

### 1. V7 rate limit 5 패턴 (Deno 이식)
```ts
// 1) parseRateLimitHeaders — anthropic-ratelimit-input-tokens-remaining 등 파싱
// 2) preemptiveWaitIfLow — 남은 토큰이 너무 적으면 reset 시각까지 자동 대기
// 3) fetchWithRetry — 429 응답 시 retry-after 또는 exp backoff (최대 3회)
// 4) trimHistory — MAX_HISTORY 초과 시 앞쪽부터 자르기
// 5) compactPrompt — 같은 줄 반복·과도 공백 제거
```
- 모두 Edge Function 안에서 처리 (클라이언트는 단순 호출만)
- prompt cache: system 블록과 마지막 user 텍스트 블록에 `cache_control: { type: 'ephemeral' }` 자동 부여

### 2. preset 5종 (시스템 프롬프트)
- `report-section`: 결과보고서 섹션 1개 생성 (300~500자)
- `curriculum-extract`: 운영안 → 차시 JSON 추출
- `next-action`: 프로젝트/프로그램 다음 액션 추천 (Haiku 4.5 디폴트)
- `report-full`: 전체 결과보고서 초안 (Sonnet 4.7)
- `chat`: 일반 대화 (`/ai` 페이지)
- 모두 한국어 격식·데이터 기반·추측 금지

### 3. fileToText.ts 차용 포인트
- mammoth 는 선택 패키지 (미설치 시 친화 에러). dynamic import 시 모듈명을 변수로 우회하여 TS 정적 해석 회피
- XLSX 3-tier fallback: csv → json → 셀 단위 순회 (보호된·복잡한 시트 대응)
- formatExtractedForPrompt: 다중 첨부를 라벨링 텍스트로 합쳐 AI 프롬프트에 주입 가능

### 4. Mock fallback 유지 이유
- Stage AI-① 은 코드만 작성 — Edge Function `supabase functions deploy ai-chat` 가 박경수님 손이 필요
- 배포 전에는 `callAi` → 에러 → `buildMockReply` 가 배포 명령어 안내 출력
- 배포 후 자동으로 실제 AI 응답 전환

### 5. /ai 페이지 영향
- STEP 21 `AiPage.tsx` 변경 없음 — 내부 `sendToAi()` 가 자동으로 callAi 사용
- `supabase` import 제거 (lazy `await import('aiClient')` 만 사용)

### 6. 라우트·App.tsx 영향
- 변경 없음

### 7. 롤백 가능성
- 단일 commit 이라 `git revert <hash>` 한 줄
- supabase/functions/ai-chat/ 폴더 삭제 + aiClient.ts·aiUtils.ts·fileToText.ts 삭제 + aiUtils.ts 의 supabase 직접 fetch 복구

---

## 다음 액션

### 박경수님 확인 사항 (Stage AI-① 종료 전)

1. **Edge Function 배포** (필수):
   ```bash
   cd C:/workflow/bal24-workflow-v2
   supabase functions deploy ai-chat
   ```
   배포 성공 시 `https://clsljkxvgmqwenettkrz.supabase.co/functions/v1/ai-chat` 에 활성화

2. **ANTHROPIC_API_KEY 등록 확인** (이미 등록됐다고 박경수님 확인):
   ```bash
   supabase secrets list
   ```
   `ANTHROPIC_API_KEY` 가 보이면 OK

3. **/ai 페이지 화면 검증**:
   - 배포 전: Mock 모드 메시지 (배포 명령어 안내) 정상 출력
   - 배포 후: 실제 Sonnet 4.7 응답 (한국어 격식·데이터 기반)

### Stage AI-② 진입 결정

박경수님 OK 시 Stage AI-② 진입 — **4 곳 placeholder 활성화** (60~90분, 1 commit):
- ① ReportSectionCard 의 `🤖 AI` 버튼 → callAi('report-section') + 다듬기·요약·확장
- ② CurriculumTab 의 `✦ AI 생성` 버튼 → callAiWithFiles('curriculum-extract') + extractJson + 차시 일괄 INSERT
- ③ HomePage 의 `NextActionCard` (신규) → callAi('next-action', Haiku) + 추천 액션 3개
- ④ ProjectReportBuilder 의 `[전체 AI 초안]` → callAi('report-full', 8K maxTokens)
