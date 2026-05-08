# STEP-AI-PREP Stage AI-② 이식 결과 보고 — 4 placeholder 활성화

> 작업일: 2026-05-08
> 박경수님 명세: Stage AI-② 커리큘럼 AI 추출·보고서 초안·NextAction AI 버튼 활성화 + Edge Function 529 재시도 추가
> 범위: 4 곳 placeholder 활성화 (3 buttons + 1 modal) + Edge Function 529 백오프

---

## 매핑 요약

| placeholder (이전) | 활성화 결과 |
|---|---|
| `NextActionCard` 정적 안내만 | ✅ AI 추천 버튼 (next-action preset, Haiku 4.5) |
| `CurriculumTab` 새 파일 / AI 생성 toast | ✅ `AiCurriculumModal` (curriculum-extract preset, JSON 추출 → 일괄 INSERT) |
| `ReportBuilderTab` 전체 AI 초안 toast | ✅ `handleAiFullDraft` (report-full preset, programs 메타 → 섹션 초안) |
| Edge Function 429 만 재시도 | ✅ 429 + 529 모두 재시도, 529 는 3s/6s/9s 선형 백오프 |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것
- 박경수님 명세 (전체 코드 블록)
- V7 → V2 이식 표준의 V-1~V-7 자체 검증
- 명세상 정규식 깨진 부분 (`/$[\s\S]*$/`) 은 우리 헬퍼 `extractJson<T>` 로 대체 (코드 펜스·중괄호·대괄호 4단계 fallback)

### 버린 것
- ❌ `CurriculumTab.showPlaceholder` 함수 (호출처 0건 → 미사용 함수 제거)

### 새로 작성한 것
- `src/pages/programs/detail/curriculum/AiCurriculumModal.tsx` (신규, 225줄)
- 3 파일 수정 (NextActionCard 전체 교체 / CurriculumTab 5곳 / ReportBuilderTab 4곳)
- 1 Edge Function 수정 (`fetchWithRetry` 529 분기 + 503 응답)

---

## 신규/수정 파일

| 파일 | 줄 수 | 변경 내용 |
|---|---|---|
| `supabase/functions/ai-chat/index.ts` (수정) | 232 | 429 + 529 재시도 (529 는 3/6/9s 선형 백오프) + 503 응답 분기 |
| `src/pages/projects/detail/overview/NextActionCard.tsx` (전체 교체) | 123 | AI 추천 버튼 + 결과 패널 (Haiku 4.5) |
| `src/pages/programs/detail/curriculum/AiCurriculumModal.tsx` (신규) | **225** | 파일업로드 → fileToText → curriculum-extract → JSON 미리보기 → 일괄 INSERT |
| `src/pages/programs/detail/CurriculumTab.tsx` (수정) | 277 | 모달 import + 상태 + 새 파일·AI 생성 버튼 활성화 + 모달 렌더 |
| `src/pages/programs/detail/ReportBuilderTab.tsx` (수정) | 325 | aiDraft 상태 + handleAiFullDraft + 버튼 disabled 로딩 + 결과 패널 (max-h-72 스크롤) |

**합계 변경 라인**: ~1,182줄 / 모두 < 400줄 (최대 325)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (최대 **325줄** = `ReportBuilderTab.tsx`)
- [x] **V-2** catch 블록 모두 `console.error('[next-action] ...')` / `[ai-curriculum]` / `[report-full]` + `toast.error` (한글)
- [x] **V-3** any 0건 — 응답 body 는 `{ ok?: boolean; text?: string; error?: string }` 타입 단언만 사용
- [x] **V-4** 사용자 노출 메시지 전부 한글 ('AI 분석 중…', 'AI가 커리큘럼을 추출하는 중…', 'AI 작성 중…' 등)
- [x] **V-5** 비동기 fetch 가드 — modal/card 모두 명령형 트리거(클릭) 라 cancelled 가드 불필요. `setSaving`·`setExtracting` 등 finally 에서 항상 해제
- [x] **V-6** `supabase.functions.invoke('ai-chat', {body})` 사용 (직접 fetch 0건)
- [x] **V-7** 디자인 토큰 — violet 50/100/200/600·rounded-2xl·shadow-[0_4px_16px_rgba(124,58,237,0.06)] 일관 적용

추가 명세 준수
- [x] AI 버튼 사용자 클릭 시만 호출 (자동 실행 0건)
- [x] 로딩 중 `disabled` 처리 (NextAction·전체 AI 초안·저장 모두)

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 2.69s** (2,198 modules)
- `preview_start` (vite dev): ✅ /login 정상 렌더, 콘솔 에러 0건
- ⚠️ AI 버튼 실 동작은 박경수님 로그인 + Edge Function 재배포 후 화면 검증 필요

---

## 짚어둘 점

### 1. Edge Function 재배포 필요
박경수님 명세 그대로 — Stage AI-② 변경사항이 적용되려면 재배포:
```bash
cd C:/workflow/bal24-workflow-v2
supabase functions deploy ai-chat --project-ref clsljkxvgmqwenettkrz
```
- 529 백오프 + 503 응답이 적용되어 과부하 시 자동 재시도됨

### 2. 명세 보정 두 곳
1. **fileToText 반환형**: 명세는 `await fileToText(file)` 가 string 이라 가정했지만, V2 의 `fileToText` 는 `Promise<ExtractedDoc | null>` (객체). `doc.text` 로 추출하도록 수정 + null 가드 추가
2. **JSON 추출 정규식**: 명세의 `raw.match(/$[\s\S]*$/)` 는 깨진 정규식. 우리 헬퍼 `extractJson<T>` (4단계 fallback: 코드펜스 → 트림 → 중괄호 → 대괄호) 로 대체

### 3. preset 별 모델
- NextAction → **Haiku 4.5** (짧은 응답 — preset default)
- 커리큘럼 추출 → **Sonnet 4.6** (구조 추출 정확도)
- 전체 AI 초안 → **Sonnet 4.6** + maxTokens 4096

### 4. 자동 실행 금지 준수
- 모든 AI 호출은 사용자 클릭 트리거. useEffect 안에서 자동 호출 0건
- 로딩 중 버튼 `disabled` + 스피너 표시

### 5. 결과 패널 UX
- NextAction: 카드 안 인라인 패널 + [닫기]
- 커리큘럼: 모달 내 미리보기 + [N개 차시 저장] (선택적 저장)
- 전체 초안: 페이지 상단 readonly 패널 + 💡 "복사 안내" + [닫기] (사용자가 각 섹션에 수동 붙여넣기)

### 6. 라우트·App.tsx 영향
- 변경 없음

### 7. 롤백 가능성
- 단일 commit `git revert <hash>` 한 줄
- Edge Function 재배포만 하면 즉시 활성화/비활성화 가능

---

## 다음 액션

### 박경수님 확인 사항

1. **Edge Function 재배포**:
   ```bash
   supabase functions deploy ai-chat --project-ref clsljkxvgmqwenettkrz
   ```

2. **화면 검증 (3 곳)**:
   - [ ] **프로젝트 상세 / 개요 탭**: `[AI 추천]` 클릭 → Haiku 응답 (3~5 가지 행동 안내) 정상 출력
   - [ ] **프로그램 상세 / 커리큘럼 탭**: `[새 파일]` or `[AI 생성]` 클릭 → 모달 → xlsx 업로드 → 차시 미리보기 → `[N개 차시 저장]` → DB INSERT 확인
   - [ ] **프로그램 상세 / 결과보고서 탭**: `[전체 AI 초안]` → 섹션별 ### 마크다운 초안 패널 표시

### Stage AI-③ 진입 결정 (선택)

- ReportSectionCard 의 섹션별 `🤖 AI` 버튼 (각 섹션 1개씩 다듬기·요약·확장)
- 박경수님 명세 미포함이라 Stage AI-② 검증 후 별도 결정
