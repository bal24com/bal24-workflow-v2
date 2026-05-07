# Stage 2 이식 결과 보고 — 결과보고서 빌더 (프로그램 상세 6번째 탭)

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_PROGRAM_EDIT_V7_TO_V2.md](./PORT_PROGRAM_EDIT_V7_TO_V2.md)
> 박경수님 결정: Stage 1 검증 완료 → Stage 2 진입 / Stage 3 (`/curriculum-invite/:token`)는 이번 제외
> 사전 확인 문서 기준대로 진행

---

## 매핑 요약

| 항목 | 사전 확인 문서 | 이식 결과 |
|---|---|---|
| 위치 | 프로그램 상세 6번째 탭 | ✅ `/programs/:id` 탭 5개 → **6개** (`결과보고서` 추가) |
| 테이블 | `report_sections` (Stage 1 SQL에 사전 생성) | ✅ 그대로 사용 |
| 자동집계 섹션 | 8종 (사업개요·참여·출석·커리큘럼·강사·만족도·예산·결과물) | ✅ 8 함수 모두 구현 |
| UX | 체크박스 + 드래그 + AI 버튼 + 인라인 적용 + [+ 항목 추가] | ✅ 모두 구현 |
| 자동 시드 | 진입 시 비어 있으면 8 auto 섹션 INSERT | ✅ 구현 |
| AI 버튼 | placeholder (Q4) | ✅ 클릭 시 안내 — STEP-AI-PREP 후 활성 |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것 (V7 EducationDetailV9 결과보고서 차용)
- 단일 페이지 섹션 목록 (목차/미리보기 분리 없음)
- 섹션마다 ☑ 체크박스 / ≡ 드래그 / 🤖 AI 버튼 / 본문 편집
- AI 분석 결과 인라인 표시 + [적용] 버튼
- [+ 항목 추가] 버튼으로 custom 섹션 신설
- 8 자동집계 섹션 (사업개요·참여인원·출석현황·커리큘럼·강사현황·만족도·예산집행·결과물)
- 하단 [전체 AI 초안] [PDF 내보내기] 버튼 (placeholder)

### 버린 것 (1단계 미포함, 사전 확인 문서대로)
- ❌ 실제 AI callClaude — STEP-AI-PREP 후 (Q4)
- ❌ PDF 내보내기 실행 — STEP-EXPORT 후
- ❌ 별도 미리보기 모드 (사전 확인 문서: 단일 페이지)

### 새로 작성한 것 (V2 표준)
- `report/reportAggregator.ts` 8 자동집계 함수 (`overview`/`participants`/`attendance`/`curriculum`/`staff`/`survey`/`budget`/`outcomes`)
- `report/CustomSectionAddModal.tsx` — 제목 입력 → custom 섹션 INSERT
- `report/ReportSectionCard.tsx` — 단일 섹션 카드 (체크박스·드래그·AI placeholder·본문 편집)
- `ReportBuilderTab.tsx` — 메인 + 자동 시드 + 순서 변경 + DnD
- ProgramDetailPage 6번째 탭 추가

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `src/pages/programs/ProgramDetailPage.tsx` (수정) | 215 | 6번째 탭 라우팅 + 아이콘 |
| `src/pages/programs/detail/ReportBuilderTab.tsx` (신규) | 251 | 메인 + 자동 시드 + DnD + 액션 버튼 |
| `src/pages/programs/detail/report/ReportSectionCard.tsx` (신규) | 237 | 단일 섹션 카드 |
| `src/pages/programs/detail/report/CustomSectionAddModal.tsx` (신규) | 90 | custom 섹션 추가 모달 |
| `src/pages/programs/detail/report/reportAggregator.ts` (신규) | 329 | 8 자동집계 함수 + 라벨 |
| `docs/PORT_PROGRAM_EDIT_V7_TO_V2_STAGE2_REPORT.md` (본 문서) | — | — |

**합계 신규 코드**: ~907줄 (4 파일) / 모두 < 400줄

---

## 자동집계 8 섹션 — 데이터 출처

| section_key | title | 출처 | 비고 |
|---|---|---|---|
| `overview` | 사업개요 | `programs` 단건 + project join | name·type·기간·장소·정원·description·goal_text |
| `participants` | 참여인원 | `participant_applications` (status별 카운트) | 신청·검토중·승인·반려·철회·완료 |
| `attendance` | 출석현황 | `attendance_sessions` + `attendance_records` | 세션별 체크인 수 |
| `curriculum` | 커리큘럼 | `program_curriculum` + `curriculum_staff` (join) | 차시별 강사·역할 통합 |
| `staff` | 강사현황 | `instructor_invitations` + `curriculum_staff` (inner join via curriculum) | 초빙·매칭 분리 표시 |
| `survey` | 만족도 | `surveys.answers` jsonb 평균 (type별) | rating 추출 + 산술 평균 |
| `budget` | 예산집행 | 프로그램 → project_id → `income`(입금완료) + `expenses` | 잔여 = 수입 − 지출 |
| `outcomes` | 결과물 | `public_forms` + `form_applications` 응답 수 | form_type 별 |

각 섹션 [집계] 버튼 클릭 → SQL 집계 → markdown 텍스트 → textarea 편집 모드 → [저장] → `report_sections.content`에 영구 저장.

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (이식 영역 최대 **329줄** = `reportAggregator.ts`)
- [x] **V-2** 모든 catch / `if (error)` `console.error('[report-builder] ...', err)` 또는 `[report-aggregator] ...` + `toast.error(...)` 한글
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. nested join은 inline anonymous type
- [x] **V-4** 사용자 노출 메시지 전부 한글 (탭 라벨·섹션 제목·빈 상태·에러·확인창·placeholder 안내)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 (`ReportBuilderTab` 진입 + 시드)
- [x] **V-6** Supabase 직접 fetch — 각 섹션이 자체 aggregateSection 호출. props는 `programId`·section 메타만
- [x] **V-7** 디자인 토큰 일관성 — `border-violet-100`·`shadow-[0_4px_16px_rgba(124,58,237,0.06)]`·violet/orange 톤만 사용

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 1.84s** (production 번들 정상)
- preview dev server: ✅ vite v8.0.10 ready, console 에러 0건, `/login` redirect 정상
- 화면 검증: ⚠️ 인증 + 프로그램 데이터 필요. 박경수님 로그인 후 직접 확인 필요

---

## 짚어둘 점

### 1. 자동 시드 동작
- 프로그램 상세 → "결과보고서" 탭 첫 진입 시 `report_sections` 비어 있음을 감지 → 8 auto 섹션 INSERT (sort_order=10,20,…,80) → 즉시 표시
- 두 번째 진입부터는 기존 row 그대로 사용

### 2. 드래그·드롭 (라이브러리 추가 X)
- HTML5 native `draggable`·`onDragStart`·`onDragEnter`·`onDragEnd`·`onDragOver`
- `onDragEnter` 시점에 클라이언트 상태에서 즉시 재배열 → drop 시점에 sort_order 일괄 UPDATE
- 실패 시 `refresh()` fallback

### 3. AI 버튼 placeholder (Q4 결정대로)
- 섹션 카드 우측 [🤖 AI] 클릭 → 섹션 아래 인라인 패널 펼침
- 안내 텍스트: "AI 분석은 STEP-AI-PREP 완료 후 활성화 예정입니다"
- [적용] 버튼 누르면 안내문이 본문 초안에 들어감 (UI 흐름 검증용)
- 하단 [전체 AI 초안] / [PDF 내보내기] 버튼은 toast.info로 안내만

### 4. 자동집계 본문 편집 흐름
- [집계] 버튼 → SQL 집계 결과를 textarea에 채움 (편집 모드 진입)
- 사용자가 검토·수정 → [저장] → DB 영구 저장
- 다시 집계하려면 [집계] 버튼 재클릭 (덮어쓰기 후 다시 검토)

### 5. 라우트·App.tsx 영향
- 변경 없음. 기존 `/programs/:id` 그대로, 6번째 탭만 추가.

### 6. 롤백 가능성
- 단일 commit이므로 `git revert <hash>` 한 줄로 즉시 되돌리기 가능
- `report_sections` 테이블은 Stage 1 SQL에 이미 생성됨 → 코드만 revert 후 데이터 잔존 (관리자가 직접 삭제 가능)

---

## 다음 액션

1. ✅ **Stage 2 화면 검증** — Netlify 배포 후 박경수님이 `/programs/<프로그램ID>` 접속 → "결과보고서" 6번째 탭 → 8 자동 섹션 + [집계]·[적용]·체크박스·드래그·[+ 항목 추가] 동작 확인
2. ✅ **Stage 3 진입 결정** — `/curriculum-invite/:token` 외부 참여의사 페이지는 이번 제외, 추후 필요 시 진입
