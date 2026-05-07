# V7 → V2 이식 사전 확인 문서 — 홈(대시보드)

> 작성일: 2026-05-07
> 대상: 박경수님 검토용
> 다음 단계: **이 문서 OK 받은 뒤 코드 작성 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| V7 파일 경로 | `C:\workflow\workflow_v7_full\src\pages\v9\HomeV9.tsx` (665줄) |
| 이식할 기능명 | **홈 대시보드 — 통계·태스크 알림·프로젝트 현황 통합** |
| V2 목적 경로 | `src/pages/dashboard/DashboardPage.tsx` (기존 262줄, 분할 후 메인 ~200줄) + `dashboard/components/*.tsx` 신규 |
| 이식 이유 | V2 현재 홈은 KPI 4개+최근목록 2개로 단순. V7의 **태스크 알림 + 단계별 진행 + 빠른 액션** 패턴이 매일 들어오는 운영자 입장에서 더 가치 큼. 이번에 테스트로 옮겨보고 향후 본격 이식의 표본 케이스로 활용 |

---

## 1단계 — 현황 파악 결과

### V7 HomeV9 — 무엇을 갖고 있는가
- 인사말 + 일일 날짜 + **AI 브리핑** (callClaude + 1시간 캐시)
- KPI 7개 (전체 진행 프로젝트·전체 태스크·오늘 마감·지연·외부 응답 도착·미정산·이번달 정산 합계)
- **"내 것 / 전체" 토글** (프로젝트·태스크 각각)
- 단계별 미니 통계 6단계 (영업/제안/계약/실행/정산/종료)
- 진행 중 프로젝트 카드 리스트 (즐겨찾기 우선 + 최근 6개)
- 오늘·지연 할 일 (지연=빨강, 오늘=황색)
- AI 추천 액션 (단계별 자동 안내)
- 빠른 액션 2개 (프로젝트·AI 초안)
- **자동 알림 시스템** (1일 1회): 태스크 D-1·지연·회의 D-1·세금계산서 D-3·정산 지급 D-3 → inbox_items_v9 적재
- **Realtime sync** (`useV9Realtime` for projects·tasks)
- **localStorage 기반 데이터** + `fetchAndMergeTasks` 패턴 (V2와 정반대 구조)

### V2 DashboardPage 현황 (Stage 3 완료 — 5602702 commit)
- 헤더 "🏠 홈"
- KPI 4개 (진행 중 프로젝트·이번달 수입+전월 변화율·미정산 지출·활성 프로그램)
- 최근 프로젝트 5개
- 최근 지출 5개
- `useToast()` 적용, cancelled 가드 적용
- 디자인 토큰 100% 적용 (`#7C3AED`/`#F97316`/`#06B6D4`/`#10B981` + `rounded-2xl border border-violet-100`)

### 충돌·차이 지점
| 영역 | V7 | V2 | 처리 |
|---|---|---|---|
| 데이터 저장 | `localStorage` + Supabase merge | Supabase only | **V2 절대 규칙** — LS 사용 금지 |
| 카드 스타일 | `v9-card`·`v9-card-accent` 자체 클래스 | Tailwind 직접 (`rounded-2xl border border-violet-100`) | V2 표준 |
| 다크모드 | `dark:bg-stone-800/40` 다수 | 미지원 | 다크 클래스 제거 |
| AI 호출 | `callClaude` (api 키 LS) | AiPage(`/ai`)에서 처리 | 홈에서 제거, AI는 `/ai` 메뉴 안내만 |
| 자동 알림 | `inbox_items_v9` 적재 | 인박스 시스템 없음 | **이번 이식에서 제외** (별도 STEP으로) |
| Realtime | `useV9Realtime` | 미도입 | **이번 이식에서 제외** (별도 STEP으로) |
| 사용자 분기 | `pmName`·`internalMemberIds` 토글 | 단일 사용자 운영 | **이번 이식에서 제외** |

---

## 2단계 — 이식 계획

### A. 가져올 것 (V7 로직·UI 패턴 차용)

| # | 항목 | V7 위치 | 차용 형태 |
|---|---|---|---|
| 1 | 인사말 카드 (오늘 날짜 + 사용자명 + 아이콘) | L383~407 | V2 디자인 토큰으로 새로 작성 |
| 2 | 오늘 마감 / 지연 태스크 KPI 2개 | L427~441 | KPI 카드에 추가 |
| 3 | **단계별 미니 통계** (6→4단계) | L511~519 | 차용. V2 status 4단계로 매핑 |
| 4 | **진행 중 프로젝트 카드 리스트** | L520~538 | 차용. 최근 6개·status 칩 |
| 5 | **오늘·지연 할 일 패널** | L562~595 | 차용. 지연=rose, 오늘=amber |
| 6 | 추천 액션 패널 | L597~624 | 단계별 안내 텍스트 (단순화) |
| 7 | 빠른 액션 (프로젝트 신규·AI 메뉴) | L627~637 | V2 라우트로 변경 (`/projects`, `/ai`) |

### B. 버릴 것 (V2에 부적합 또는 별도 STEP)

| 버릴 항목 | 이유 |
|---|---|
| `localStorage` 기반 LS 인프라 (`loadProjects/loadTasks/pushExistingDataOnce/fetchAndMergeTasks/fetchAndMergeActivities`) | V2 절대 규칙: LS 금지. Supabase 직접 fetch |
| AI 일일 브리핑 (`callClaude`·`getApiKey`·`home_briefing_v1`) | AiPage(`/ai`)와 책임 중복. 홈은 데이터 요약만 |
| `runDueDateNotices` 자동 알림 시스템 (~150줄) | 인박스 시스템 부재. 별도 STEP으로 분리 |
| `useV9Realtime` projects·tasks subscribe | V2 Realtime 미도입. 별도 STEP으로 |
| **"내 것 / 전체" 토글** (`projectScope`·`taskScope`) | V2는 단일 사용자 운영. `pmName`/`internalMemberIds` 컬럼 없음 |
| `isFavorite` 우선 정렬 | V2 projects 테이블에 컬럼 없음 |
| `isArchived` 필터 | V2는 `status='종료'`로 처리 |
| 외부 응답 도착 KPI (`instructor_invitations.status='submitted'`) | 단계별 KPI는 1차에선 4개로 제한, 추후 확장 |
| 이번달 정산 합계 KPI | V2는 이미 "이번달 수입" KPI 보유. 중복 |
| `v9-card`·`v9-card-accent`·`v9-section-title`·`v9-btn-soft` 자체 클래스 | V2 표준 토큰으로 교체 |
| 다크모드 클래스 (`dark:bg-stone-800/40` 등) | V2 미지원 |
| 그라데이션 아이콘 박스 (`from-orange-400 to-pink-400` 등 강한 색조) | V2 violet 단일 톤 유지 |

### C. V2 표준으로 새로 쓸 것

| 신규 작성물 | 줄 수 추정 | 역할 |
|---|---|---|
| `dashboard/DashboardPage.tsx` (수정) | ~220줄 | 메인 레이아웃·로딩·에러 토스트 |
| `dashboard/dashboardUtils.ts` (확장) | 190 → ~310줄 | 신규: `fetchTaskBuckets`·`fetchActiveProjectsByStatus`·`fetchProjectStageCounts` |
| `dashboard/components/GreetingHeader.tsx` (신규) | ~60줄 | 오늘 날짜 + 사용자명 + 아이콘 |
| `dashboard/components/TaskAlertPanel.tsx` (신규) | ~140줄 | 오늘·지연 태스크 fetch + 표시 |
| `dashboard/components/ProjectStagePanel.tsx` (신규) | ~180줄 | 단계별 통계 + 진행 중 프로젝트 카드 |
| `dashboard/components/QuickActionsCard.tsx` (신규) | ~60줄 | 빠른 액션 + 추천 안내 |

**모든 신규 파일 < 400줄. 메인 페이지 사이즈 V-1 통과.**

### D. DB 컬럼 매핑표

| V7 (LS·`*_v9`) | V2 (Supabase) | 비고 |
|---|---|---|
| `ProjectV9.title` | `projects.name` | 명칭 다름 |
| `ProjectV9.stage` ('영업'\|'제안'\|'계약'\|'실행'\|'정산'\|'종료') | `projects.status` ('제안'\|'진행'\|'정산'\|'종료') | **6→4 매핑**: 영업/제안/계약 → 제안, 실행 → 진행, 정산 → 정산, 종료 → 종료 |
| `ProjectV9.clientName` | `projects.client_id` → `clients.name` join | join 필요 |
| `ProjectV9.pmName` | `projects.owner_id` → `profiles.name` (있으면) | **이번 이식에선 미사용** |
| `ProjectV9.internalMemberIds[]` | `project_members` 테이블 | **이번 이식에선 미사용** |
| `ProjectV9.isFavorite` | (컬럼 없음) | **이번 이식에선 미사용**, 정렬은 `created_at desc` |
| `ProjectV9.isArchived` | `status='종료'` | 필터로 대체 |
| `ProjectV9.updatedAt` | `projects.updated_at` | snake_case |
| `TaskV9.dueDate` | `tasks.due_date` | snake_case |
| `TaskV9.status` ('완료' 등) | `tasks.status` ('인식'\|'실행'\|'검토'\|'완료') | 미완료 = `status != '완료'` |
| `TaskV9.assigneeIds[]` | (없음 — `tasks` 단순 구조) | "내 것" 분기 미사용 |
| `TaskV9.priority` | `tasks.priority`(있으면) | 표시는 안 하되 sort 보조 가능 |
| `instructor_invitations_v9` (LS) | `instructor_invitations` (Supabase) | 이번 이식엔 미사용 |
| `settlements` (LS) | `expenses` (status='대기') / `project_settlements` | 이번 이식엔 미사용 |
| `inbox_items_v9` (LS) | (없음) | 자동 알림은 별도 STEP |

### V2 status 4단계 매핑 — 단계별 미니 통계 카드

| V2 status | 색상 토큰 | 카드 라벨 |
|---|---|---|
| 제안 | `bg-violet-50 text-violet-600` | 제안 |
| 진행 | `bg-cyan-50 text-cyan-600` | 진행 |
| 정산 | `bg-orange-50 text-orange-600` | 정산 |
| 종료 | `bg-slate-100 text-slate-500` | 종료 |

(V2 `PROJECT_STATUS_STYLE` 헬퍼 재사용)

---

## 3. 최종 V2 홈 화면 구성안

```
┌──────────────────────────────────────────────────────────────┐
│ 🏠 홈                                                         │ ← 기존 헤더 유지
├──────────────────────────────────────────────────────────────┤
│ ✨ GreetingHeader (신규)                                      │
│   2026년 5월 7일 목요일 · 안녕하세요, 박경수 님 👋             │
└──────────────────────────────────────────────────────────────┘

┌─────────┬─────────┬─────────┬─────────┐
│진행 중   │이번달   │미정산   │활성     │ ← 기존 KPI 4개 유지
│프로젝트 │수입     │지출     │프로그램 │
└─────────┴─────────┴─────────┴─────────┘
┌─────────┬─────────┐
│오늘 마감│지연      │ ← 신규 KPI 2개 추가 (V7 차용)
│태스크   │태스크   │
└─────────┴─────────┘

┌────────────────────────┬──────────────────────┐
│ 📊 진행 중 프로젝트     │ ⏰ 오늘·지연 할 일    │ ← 기존 "최근 프로젝트"를
│   - 단계 통계 4칩       │  - 지연 (rose)        │   ProjectStagePanel로 교체
│   - 카드 리스트 6개     │  - 오늘 (amber)       │
│ (ProjectStagePanel)    │ (TaskAlertPanel)      │
├────────────────────────┼──────────────────────┤
│ 💼 최근 지출 5개        │ ⚡ 빠른 액션          │ ← 최근 지출 유지 +
│ (기존 유지)             │  + 추천 안내           │   QuickActionsCard 신규
└────────────────────────┴──────────────────────┘
```

---

## 4. V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | DashboardPage ~220, 컴포넌트 4개 각 60~180, utils ~310 | ✅ 통과 예상 |
| V-2 catch + 한글 | 각 fetch에 `console.error('[dashboard] ...', err)` + `toast.error('...')` | ✅ 적용 예정 |
| V-3 any/unknown 미사용 | Supabase nested join에서만 `as unknown as T[]` 사용 | ✅ |
| V-4 한글 메시지 | 모든 사용자 노출 문자열 한글 | ✅ |
| V-5 cancelled 가드 | 모든 useEffect 비동기 fetch에 적용 | ✅ |
| V-6 직접 fetch | 각 컴포넌트에서 supabase 직접 호출 (props drilling 없음) | ✅ |
| V-7 디자인 토큰 | `#7C3AED`/`#F97316`/`#06B6D4`/`#10B981` + `rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.06)]` | ✅ |

---

## 5. 박경수님 의사결정 필요 항목

다음 5가지 중 하나라도 다르게 가고 싶으면 알려주세요. **OK 주시면 그대로 진행**.

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| Q1 | **AI 일일 브리핑** | ❌ 제외 — `/ai` 메뉴와 중복. 홈은 데이터 요약만 |
| Q2 | **자동 알림 (D-1·D-3)** | ❌ 제외 — 별도 STEP으로 (인박스 시스템 신설 필요) |
| Q3 | **"내 것 / 전체" 토글** | ❌ 제외 — V2는 단일 사용자 운영, 컬럼 부재 |
| Q4 | **Realtime 구독** | ❌ 제외 — V2 미도입. 폴링도 안 함 (페이지 진입 시 1회 fetch) |
| Q5 | **그라데이션 강한 색조** (`from-orange-400 to-pink-400` 등) | ❌ 제외 — V2 violet 단일 톤 유지 |

---

## 6. 작업 순서 (OK 받은 뒤)

1. `dashboardUtils.ts` 확장 (3 함수 추가)
2. `components/GreetingHeader.tsx` 신규
3. `components/TaskAlertPanel.tsx` 신규
4. `components/ProjectStagePanel.tsx` 신규
5. `components/QuickActionsCard.tsx` 신규
6. `DashboardPage.tsx` 레이아웃 재구성
7. `tsc -b` 통과 확인 → V-1~V-7 자체 검증 → 보고서 작성 → push

**예상 commit 수**: 1건 (`feat: V7 이식 — 홈 대시보드 (단계 통계·태스크 알림·빠른 액션)`)
**예상 작업 시간**: 30~40분

---

## 7. 다음 액션

✅ 박경수님이 **이 문서 검토** → OK / 수정 요청 → 그 후 코드 진입
