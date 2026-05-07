# 이식 결과 보고 — 홈(대시보드) V7 → V2

> 작업일: 2026-05-07
> 사전 확인 문서: [PORT_HOME_V7_TO_V2.md](./PORT_HOME_V7_TO_V2.md)
> 박경수님 결정: Q1~Q5 추천(전부 ❌ 제외)대로 진행 OK

---

## V7 → V2 매핑 요약

| 항목 | V7 (원본) | V2 (이식 결과) |
|---|---|---|
| 파일명 | `src/pages/v9/HomeV9.tsx` (665줄, 1파일) | `src/pages/dashboard/DashboardPage.tsx` + `components/*.tsx` 4개 + `dashboardUtils.ts` (961줄, 6파일) |
| 데이터 저장 | `localStorage` + Supabase merge | Supabase 단일 (직접 fetch) |
| 테이블 | `projects_v9`·`tasks_v9` (LS 키) | `projects`·`tasks` |
| 컬럼 (project) | `title`·`stage`·`isFavorite`·`isArchived` | `name`·`status`·(없음)·status='종료' |
| 컬럼 (task) | `dueDate`·`assigneeIds[]` | `due_date`·`assignee_id` (단일) |
| 단계값 | 영업·제안·계약·실행·정산·종료 (6) | 제안·진행·정산·종료 (4) |
| 태스크 상태 | '완료' 외 미상세 | 인식·실행·검토·완료. 미완료 = `status in (인식,실행,검토)` |
| 토스트 | 자체 `showToast()` | `useToast()` (V2 ToastContext) |
| 카드 클래스 | `v9-card`·`v9-card-accent`·`v9-section-title` | `rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.06)]` |
| 사용자 분기 | `pmName`·`internalMemberIds` 토글 | 분기 없음 (단일 사용자 운영) |

---

## 가져온 것 / 버린 것

### 가져온 것 (V7 로직·UI 패턴 차용)
- 인사말 헤더 카드 (오늘 날짜 + 사용자명 + 아이콘) — V2 디자인 토큰으로 재구성
- 오늘 마감·지연 태스크 KPI 2개 (총 KPI 6개로 확장)
- 단계별 미니 통계 (V7 6단계 → V2 4단계로 매핑)
- 진행 중 프로젝트 카드 리스트 (status·client·`updated_at desc` 정렬, 최대 6개)
- 오늘·지연 할 일 패널 (지연=rose / 오늘=orange)
- 빠른 액션 버튼 그리드 + AI 메뉴 안내 카드

### 버린 것 (V2에 부적합 또는 별도 STEP)
- ❌ `localStorage` 인프라 전부 (`loadProjects`/`loadTasks`/`pushExistingDataOnce`/`fetchAndMergeTasks`/`fetchAndMergeActivities`) — V2 절대 규칙: LS 금지
- ❌ AI 일일 브리핑 (`callClaude`·`getApiKey`·`home_briefing_v1`) — `/ai` 메뉴와 책임 중복 (Q1)
- ❌ 자동 알림 시스템 (`runDueDateNotices` 약 150줄, 태스크 D-1·회의 D-1·세금계산서 D-3·정산 D-3) — 인박스 시스템 부재. 별도 STEP으로 분리 (Q2)
- ❌ "내 것 / 전체" 토글 (`projectScope`·`taskScope`) — V2는 단일 사용자 운영, `pmName`/`internalMemberIds` 컬럼 없음 (Q3)
- ❌ `useV9Realtime` projects·tasks subscribe — V2 Realtime 미도입 (Q4)
- ❌ 강한 그라데이션 색조 (`from-orange-400 to-pink-400` 등) — V2 violet 단일 톤 유지 (Q5)
- ❌ `isFavorite` 우선 정렬·`isArchived` 필터 — V2 컬럼 부재
- ❌ 외부 응답 도착 KPI / 이번달 정산 합계 KPI — KPI 6개로 제한 (수입과 중복)
- ❌ 자체 `v9-card` 클래스 / 다크모드 클래스 — V2 표준 토큰만

### 새로 작성한 것 (V2 표준 적용)
- `dashboardUtils.ts` 신규 함수 3개: `fetchActiveProjects`·`fetchProjectStageCounts`·`fetchTaskBuckets`
- 기존 `fetchDashboardKpis` 확장: `todayDueCount`·`overdueCount` 2 KPI 추가
- 컴포넌트 4개 분리 (V-1 400줄 규칙 준수): `GreetingHeader`·`TaskAlertPanel`·`ProjectStagePanel`·`QuickActionsCard`
- 모든 fetch는 `useEffect` + `cancelled` 가드 + `useToast()` 한글 에러
- V2 디자인 토큰 일관 적용 (`#7C3AED`/`#F97316`/`#06B6D4`/`#10B981`/`#E11D48`)

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `src/pages/dashboard/DashboardPage.tsx` (수정) | 244 | 메인 레이아웃 + KPI 6개 + 최근 지출 + 4개 패널 합성 |
| `src/pages/dashboard/dashboardUtils.ts` (확장 190→348) | 348 | KPI 집계·진행 중 프로젝트·단계별 카운트·태스크 버킷 |
| `src/pages/dashboard/components/GreetingHeader.tsx` (신규) | 53 | 오늘 날짜 + 사용자명 헤더 |
| `src/pages/dashboard/components/TaskAlertPanel.tsx` (신규) | 117 | 오늘·지연 태스크 fetch + 표시 |
| `src/pages/dashboard/components/ProjectStagePanel.tsx` (신규) | 138 | 단계별 통계 + 진행 중 프로젝트 카드 |
| `src/pages/dashboard/components/QuickActionsCard.tsx` (신규) | 61 | 빠른 액션 + AI 메뉴 안내 |
| `docs/PORT_HOME_V7_TO_V2.md` (신규) | 215 | 사전 확인 문서 |
| `docs/PORT_HOME_V7_TO_V2_REPORT.md` (신규, 본 문서) | - | 이식 결과 보고 |

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (최대 **348줄** = `dashboardUtils.ts`)
- [x] **V-2** catch 블록 모두 `console.error('[dashboard] ...', raw)` + `toast.error('...')` 한글 메시지 (3곳: DashboardPage L103·ProjectStagePanel L79·TaskAlertPanel L68)
- [x] **V-3** any/unknown 미사용 — `as any` 0건, `: unknown` 0건. Supabase nested join은 모두 Inline anonymous type으로 명시
- [x] **V-4** 사용자 노출 메시지 전부 한글 (KPI 라벨·빈 상태·에러 토스트·인사말 모두)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 적용 (DashboardPage·ProjectStagePanel·TaskAlertPanel 3곳)
- [x] **V-6** Supabase 직접 fetch — 각 컴포넌트가 자체 `useEffect`로 `dashboardUtils` 호출. props drilling 없음
- [x] **V-7** 디자인 토큰 일관성 — 임의 HEX 0건. `border-violet-100`·`shadow-[0_4px_16px_rgba(124,58,237,0.06)]`·tone 5종(violet/orange/cyan/emerald/rose)만 사용

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 1.97s** (production 번들 정상)
- preview dev server: ✅ vite v8.0.10 ready in 1677ms, console 에러 0건, `/login` redirect 정상
- 화면 검증 (`/home`): ⚠️ 인증 보호 라우트라 박경수님 로그인 후 직접 확인 필요

---

## 짚어둘 점

### 1. V2 스키마 차이로 조정한 항목
- **단계 6→4 매핑**: V7의 영업·제안·계약 → V2 `제안`, V7의 실행 → V2 `진행`. 카드 칩은 V2 `PROJECT_STATUS_STYLE` 헬퍼 그대로 재사용.
- **태스크 미완료 정의**: V7은 `status !== '완료'`, V2는 `status in (인식, 실행, 검토)`로 명시 (V2의 4단계 enum).
- **즐겨찾기·아카이브 제거**: V2 `projects` 테이블에 `is_favorite`/`is_archived` 컬럼 없음. 정렬은 `updated_at desc` 단일 키.

### 2. 추가 SQL 불필요
- 신규 컬럼·테이블 없음. 기존 테이블 (`projects`·`tasks`·`income`·`expenses`·`programs`·`clients`)만 사용.

### 3. 후속 작업 후보 (이번 이식엔 미포함)
- **자동 알림 시스템** (Q2 보류분): 인박스 테이블 신설 후 D-1·D-3 cron 또는 클라이언트 트리거 구현 — 별도 STEP 24 등으로 추후 진행 권장.
- **사용자 KPI 토글** (Q3 보류분): `profiles.role` + `project_members` 도입 후 다중 사용자 운영 시점에 추가.
- **Realtime 구독** (Q4 보류분): Supabase publication 설정 후 `useV9Realtime` 유사 훅 신설 시 적용.

### 4. 라우트 영향
- `/home` 라우트 그대로 유지. App.tsx 변경 없음.
- 컴포넌트 내부의 `<Link to="/projects">`, `<Link to="/expense">`, `<Link to="/ai">`, `<Link to="/programs">`, `<Link to="/schedule">`, `<Link to="/shares">` 모두 V2 기존 라우트.

---

## Git Push 루틴 (예정)

```bash
cd C:\workflow\bal24-workflow-v2
git add docs/PORT_HOME_V7_TO_V2.md \
        docs/PORT_HOME_V7_TO_V2_REPORT.md \
        src/pages/dashboard/DashboardPage.tsx \
        src/pages/dashboard/dashboardUtils.ts \
        src/pages/dashboard/components/ \
        CLAUDE.md
git commit -m "feat: V7 이식 — 홈 대시보드 (단계 통계·태스크 알림·빠른 액션)"
git push origin main
```
