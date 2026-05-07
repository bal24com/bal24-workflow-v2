# 이식 결과 보고 — 프로젝트 상세 V7 → V2

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_PROJECT_DETAIL_V7_TO_V2.md](./PORT_PROJECT_DETAIL_V7_TO_V2.md)
> 박경수님 결정: Q1~Q5 모두 추천(❌ 제외)대로 진행 OK
> 메모: Q2 단계 변경은 기존 모달 유지 / Q4 AI는 STEP-AI-PREP 후 연결 / Q5 컨소시엄은 링크만

---

## V7 → V2 매핑 요약

| 항목 | V7 (원본) | V2 (이식 결과) |
|---|---|---|
| 파일명 | `src/pages/v9/ProjectDetailV9.tsx` (1,751줄, 1파일) | `ProjectDetailPage.tsx` + `detail/StageProgressBar.tsx` + `detail/OverviewTab.tsx` + `detail/overview/*.tsx` 6개 + `detail/projectDetailUtils.ts` (총 9파일 신규/수정 + 기존 8파일) |
| 데이터 저장 | `localStorage` + Supabase merge | Supabase 직접 fetch |
| 단계값 | 6단계 (영업·제안·계약·실행·정산·종료) | 4단계 (제안·진행·정산·종료) |
| 즐겨찾기 | `project.isFavorite` | (제외, 별도 STEP) |
| 컨소시엄 통합관리 | 메인 2탭 | `/consortium/:id` 링크만 (QuickActionsCard) |
| 재무 데이터 | `contractAmount`/`settledAmount` 필드 | `projects.budget` + `income(amount, status='입금완료')` 합 + `expenses(gross_amount)` 합 |
| 활동 타임라인 | `activities` LS 배열 | `activity_logs` 테이블 (project_id 필터) |
| 단계 변경 | 헤더 칩 클릭 즉시 변경 | 시각화만 (수정은 ProjectFormModal 유지) |
| AI 다음 행동 | `callClaude` 호출 | 정적 안내 (STEP-AI-PREP 후 동적 전환 예정) |
| 카드 클래스 | `v9-card` 자체 | `rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.06)]` |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것 (V7 로직·UI 패턴)
- **헤더 단계 진행 바** (4단계 ●·✓·○ 시각화)
- **재무 요약 카드** (예산·수입·지출·잔여 + 진행률 바)
- **참여자 미니 프리뷰** (PM·고객사·인력 N명, 풀버전은 참여인력 탭)
- **이벤트·행사 일정** (programs + schedule_events 통합)
- **활동 타임라인** (activity_logs 최근 8건)
- **다음 행동 안내** (status별 정적 가이드 4종)
- **빠른 액션** (태스크·일정·결과보고서·외부공유 + 컨소시엄 링크)

### 버린 것
- ❌ localStorage 인프라 전부 (V2 절대 규칙)
- ❌ 즐겨찾기 토글 (Q1)
- ❌ 헤더 단계 칩 클릭 즉시 변경 (Q2 — 박경수님: "기존 모달 유지가 실수 방지에 좋다")
- ❌ 활동 인라인 추가 폼 (Q3 — `/activity-logs` 메뉴 링크로)
- ❌ AI callClaude 호출 (Q4 — 정적 안내 + STEP-AI-PREP 완료 후 연결 예정)
- ❌ 컨소시엄 통합관리 메인 2탭 (Q5 — `/consortium/:id` STEP-CON 7탭과 중복 방지)
- ❌ 단계별 자료 폴더 (activity_logs.stage 컬럼 부재)
- ❌ 중앙 3 sub탭 (체크리스트·간트 — V2 미도입)
- ❌ 외부 인력풀 분리 (V2 project_members 단일)
- ❌ 자체 v9-card·다크모드·강한 그라데이션

### 새로 작성한 것 (V2 표준)
- `detail/projectDetailUtils.ts` — 4 fetch 함수 (재무·참여자·이벤트·활동) + 활동 타입 라벨
- `detail/StageProgressBar.tsx` — 4단계 진행 바 (시각화 전용)
- `detail/overview/*.tsx` — 카드 컴포넌트 6종
- 기존 OverviewTab는 **중앙 컬럼**으로 이전, 정보 손실 0
- `setTab` 콜백을 OverviewTab → MembersPreviewCard·QuickActionsCard로 전달해 탭 간 전환 가능

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `src/pages/projects/ProjectDetailPage.tsx` (수정) | 192 | 헤더에 StageProgressBar 추가 + setTab 콜백 |
| `src/pages/projects/detail/OverviewTab.tsx` (재작성) | 108 | 3열 그리드 합성 (76→108) |
| `src/pages/projects/detail/StageProgressBar.tsx` (신규) | 62 | 4단계 진행 바 |
| `src/pages/projects/detail/projectDetailUtils.ts` (신규) | 157 | 4 fetch 함수 + 라벨 |
| `src/pages/projects/detail/overview/FinanceSummaryCard.tsx` (신규) | 117 | 재무 요약 + 진행률 |
| `src/pages/projects/detail/overview/MembersPreviewCard.tsx` (신규) | 118 | 참여자 미니 프리뷰 |
| `src/pages/projects/detail/overview/EventsTimelineCard.tsx` (신규) | 135 | 이벤트 통합 |
| `src/pages/projects/detail/overview/ActivityTimelineCard.tsx` (신규) | 107 | 활동 로그 최근 8건 |
| `src/pages/projects/detail/overview/NextActionCard.tsx` (신규) | 61 | status별 정적 안내 |
| `src/pages/projects/detail/overview/QuickActionsCard.tsx` (신규) | 68 | 빠른 액션 4 + 컨소시엄 링크 |
| `docs/PORT_PROJECT_DETAIL_V7_TO_V2.md` (신규) | 215 | 사전 확인 문서 |
| `docs/PORT_PROJECT_DETAIL_V7_TO_V2_REPORT.md` (신규, 본 문서) | - | 결과 보고 |

**합계 신규 코드**: ~932줄 (10 파일) / **모두 < 400줄**

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (이식 영역 최대 **157줄** = `projectDetailUtils.ts`. 전체 detail 폴더 최대는 기존 FilesTab 295줄)
- [x] **V-2** catch 블록 4개 모두 `console.error('[project-detail] ...', raw)` + `toast.error(...)` 한글 메시지
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. Supabase nested join은 inline anonymous type
- [x] **V-4** 사용자 노출 메시지 전부 한글 (카드 제목·빈 상태·에러·진행률 라벨·status 안내 4종 모두)
- [x] **V-5** useEffect 비동기 fetch 4곳 모두 `cancelled` 가드 (FinanceSummaryCard·MembersPreviewCard·EventsTimelineCard·ActivityTimelineCard)
- [x] **V-6** Supabase 직접 fetch — 각 카드가 자체 useEffect로 utils 호출. props는 `projectId`·`pmName`·`clientName`·`status`·`consortiumId` 등 메타만 전달, 데이터는 props drilling 없음
- [x] **V-7** 디자인 토큰 일관성 — 임의 HEX 0건. `border-violet-100`·`shadow-[0_4px_16px_rgba(124,58,237,0.06)]`·tone 5종 (violet/orange/cyan/emerald/rose)만 사용

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 1.81s** (production 번들 정상)
- preview dev server: ✅ vite v8.0.10 ready (5174 포트로 자동 fallback, 5173은 이전 backgroud server 점유)
- 화면 검증 (`/projects/:id`): ⚠️ 인증 보호 라우트 + 프로젝트 데이터 필요. **박경수님 로그인 후 직접 확인 부탁드려요**

---

## 짚어둘 점

### 1. V2 스키마 차이로 조정한 항목
- **재무 합계 정의**: 수입은 `status='입금완료'`만 합산 (대기 항목은 미수금이라 제외). 지출은 전체 합산 + 대기 항목은 별도 표시.
- **활동 로그 타입**: V7은 임의 문자열, V2는 5종 enum (`mentoring`·`lecture`·`business_trip`·`ta`·`operation`) — 라벨 함수로 한글 변환.
- **이벤트 통합**: V7의 `linkedEducations` (LS) → V2의 `programs.project_id`. V7의 `linkedSchedules` (LS) → V2의 `schedule_events.project_id`. 둘 다 V2 스키마에 있음, 조회만 새로 작성.

### 2. 추가 SQL 불필요
- 신규 컬럼·테이블 없음. 기존 6개 테이블 사용 (`projects`·`income`·`expenses`·`project_members`·`programs`·`schedule_events`·`activity_logs`).

### 3. 후속 작업 후보
- **Q1 즐겨찾기** — `projects.is_favorite boolean default false` 컬럼 + 헤더 별 토글 + 정렬에 활용. 1~2 commit 분량.
- **Q2 단계 클릭 변경** — 단계 칩 클릭 → 확인 모달 → status 변경. 박경수님 결정: 기존 ProjectFormModal 유지가 좋다 (실수 방지).
- **Q3 활동 인라인 추가** — 활동 타임라인 헤더의 "+ 새 일지"가 현재는 `/activity-logs` 메뉴 이동. 인라인 모달은 후속.
- **Q4 AI 다음 행동** — STEP-AI-PREP 완료 후 `NextActionCard` 내부에서 callClaude로 동적 안내 생성. 인터페이스 그대로 유지하면 교체만으로 가능.

### 4. 라우트·App.tsx 영향
- 변경 없음. 기존 `/projects/:id` 그대로.

### 5. 롤백 가능성
- 단일 commit으로 묶이므로 `git revert <hash>` 한 줄로 즉시 되돌리기 가능.
- ProjectDetailPage·OverviewTab은 수정 전 상태로 자동 복원, 신규 9 파일은 자동 삭제.

---

## Git Commit/Push (예정)

```bash
cd C:\workflow\bal24-workflow-v2
git add docs/PORT_PROJECT_DETAIL_V7_TO_V2.md \
        docs/PORT_PROJECT_DETAIL_V7_TO_V2_REPORT.md \
        src/pages/projects/ProjectDetailPage.tsx \
        src/pages/projects/detail/OverviewTab.tsx \
        src/pages/projects/detail/StageProgressBar.tsx \
        src/pages/projects/detail/projectDetailUtils.ts \
        src/pages/projects/detail/overview/
git commit -m "feat: V7 이식 — 프로젝트 상세 개요 탭 + 단계 진행 바"
git push origin main
```
