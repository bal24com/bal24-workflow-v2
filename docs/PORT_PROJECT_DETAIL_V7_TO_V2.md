# V7 → V2 이식 사전 확인 문서 — 프로젝트 상세

> 작성일: 2026-05-08
> 대상: 박경수님 검토용
> 다음 단계: **이 문서 OK 받은 뒤 코드 작성 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| V7 파일 경로 | `C:\workflow\workflow_v7_full\src\pages\v9\ProjectDetailV9.tsx` (1,751줄, 1파일) |
| 이식할 기능명 | **프로젝트 상세 — 개요 탭 풍부화 + 단계 진행 바** |
| V2 목적 경로 | `src/pages/projects/ProjectDetailPage.tsx` (헤더 강화) + `detail/StageProgressBar.tsx` (신규) + `detail/overview/*.tsx` (신규 6개) + `detail/projectDetailUtils.ts` (신규) |
| 이식 이유 | V2 현재 OverviewTab(76줄)은 기본정보 표 + 설명만. V7의 **3열 그리드 (재무·참여자·이벤트 / 태스크 / 활동·다음 행동·빠른 액션)** 패턴이 운영자가 가장 자주 머무는 화면. 정보 밀도와 액션 접근성을 동시에 올림 |

---

## 1단계 — 현황 파악 결과

### V7 ProjectDetailV9 — 무엇을 갖고 있는가
- **헤더**: 단계 워크플로우 (영업→제안→계약→실행→정산→종료) 클릭 변경 + 즐겨찾기 + 컨소시엄사 칩
- **메인 2탭**: 개요 / 컨소시엄 통합관리
- **개요 탭 — 3열 그리드**:
  - 좌: 재무 요약 (계약금·정산·잔여 + 진행률 바) / 참여자 (PM·내부·외부) / 이벤트·행사 일정 / 단계별 자료 폴더
  - 중앙: 3 sub탭 (태스크 / 체크리스트 / 간트차트)
  - 우: 활동 타임라인 / AI 다음 행동 / 빠른 액션
- **모달 6종**: AddActivity / ProjectEdit / ContactPick / ParticipantPick / StageChange / 기타
- **localStorage 기반** (V2 절대 규칙 위반)

### V2 ProjectDetailPage 현황
| 파일 | 줄 수 | 상태 |
|---|---|---|
| `ProjectDetailPage.tsx` | 184 | 5탭 라우팅 메인 |
| `detail/OverviewTab.tsx` | 76 | **빈약 — 기본정보 표 + 설명만** ⚠️ |
| `detail/TasksTab.tsx` | 165 | 정상 |
| `detail/MembersTab.tsx` | 121 | 정상 |
| `detail/FilesTab.tsx` | 295 | 정상 |
| `detail/PortalTab.tsx` | 171 | 정상 |
| `detail/TaskFormModal.tsx` | 220 | 정상 |
| **합계** | **1,524 (8 파일)** | V-1 통과 |

### 충돌·차이 지점
| 영역 | V7 | V2 | 처리 |
|---|---|---|---|
| 단계값 | 6단계 (영업·제안·계약·실행·정산·종료) | 4단계 (제안·진행·정산·종료) | 4단계로 매핑 |
| 즐겨찾기 | `project.isFavorite` | 컬럼 없음 | **제외** (별도 SQL 필요) |
| 컨소시엄 통합관리 | 메인 2탭 안에 통합 | `/consortium/:id` 별도 페이지(STEP-CON 7탭) | **제외** — 링크만 안내 |
| 재무 데이터 | `contractAmount`/`settledAmount` 컬럼 | `projects.budget` + `income(amount)` 합계 + `expenses(gross_amount)` 합계 | Supabase 집계 |
| 참여자 | `internalMemberIds[]`/`externalStaffIds[]` 배열 컬럼 | `project_members` 테이블 (이미 MembersTab에 풀버전 있음) | **개요엔 미니 프리뷰만** |
| 활동 타임라인 | `activities` LS 배열 | `activity_logs` 테이블 (이미 STEP 11-D 구현) | Supabase fetch + 표시만 |
| 단계 변경 | 헤더 칩 클릭 → 즉시 변경 | `ProjectFormModal` 수정 모드에서 변경 | **시각화만**, 변경은 기존 모달 유지 |
| AI 다음 행동 | callClaude 호출 | (없음) | **정적 안내 텍스트만 차용** |
| 카드 클래스 | `v9-card` 자체 | `rounded-2xl border border-violet-100` | V2 표준 |
| 다크모드 | 다수 적용 | 미지원 | 클래스 제거 |

---

## 2단계 — 이식 계획

### A. 가져올 것 (V7 로직·UI 패턴 차용)

| # | 항목 | V7 위치 | V2 차용 형태 |
|---|---|---|---|
| 1 | **단계 진행 바** (헤더 영역) | L300~370 | V2 4단계로 매핑한 시각화. 수정은 기존 ProjectFormModal에서 |
| 2 | **재무 요약 카드** (계약금·정산·잔여 + 진행률) | L420~445 | V2 budget·income·expense 집계로 구성 |
| 3 | **참여자 미니 프리뷰** (PM·고객사·인력 N명) | L447~516 | 한 줄 요약, "참여인력 탭 열기" 링크 |
| 4 | **이벤트·행사 일정** (programs + schedule_events 통합) | L518~610 | V2 schedule_events + programs.project_id |
| 5 | **활동 타임라인** (최근 8개) | L763~795 | activity_logs.project_id 기준 |
| 6 | **AI 다음 행동** (단계별 안내) | L800~870 | **정적 텍스트만** (callClaude X) |
| 7 | **빠른 액션** | L880~920 | 태스크 추가·미팅 일지·결과보고서 등 |

### B. 버릴 것 (V2에 부적합 또는 별도 STEP)

| 버릴 항목 | 이유 |
|---|---|
| `localStorage` 기반 LS 인프라 (`loadProjects`/`loadActivities` 등) | V2 절대 규칙 |
| 즐겨찾기 토글 (`project.isFavorite`) | V2 컬럼 없음. 별도 SQL 필요 (Q1) |
| 컨소시엄 통합관리 메인 2탭 | V2는 `/consortium/:id`에 STEP-CON 7탭 별도 존재. 중복 (Q5) |
| 단계 헤더 칩 클릭 즉시 변경 | V2는 `ProjectFormModal` 수정으로 일관. 1차에선 시각화만 (Q2) |
| 활동 인라인 추가 폼 (AddActivityModal) | V2는 `/activity-logs` 메뉴 별도. 1차엔 표시만 (Q3) |
| AI callClaude 다음 행동 | `/ai` 메뉴와 책임 중복. 정적 안내만 (Q4) |
| 단계별 자료 폴더 (`activitiesByStage`) | activity_logs에 stage 컬럼 없음. 1차 제외 |
| 중앙 3 sub탭 (태스크·체크리스트·간트) | 태스크는 이미 V2 TasksTab에 풀버전. 체크리스트·간트는 V2 미도입 |
| 컨소시엄사 칩 (헤더) | `/consortium/:id`에서 풀버전 제공 |
| 외부 인력풀 (`externalStaffIds[]`) | V2 project_members 단일. MembersTab에서 처리 |
| 자체 `v9-card`·`v9-section-title`·`v9-chip` 클래스 | V2 표준 토큰 사용 |
| 다크모드 클래스 | V2 미지원 |
| 강한 그라데이션 (`bg-gradient-to-r from-orange-500 to-pink-500`) | V2 violet 단일 톤 |

### C. V2 표준으로 새로 쓸 것

| 신규/수정 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `ProjectDetailPage.tsx` (수정) | 184 → ~210 | 헤더에 `<StageProgressBar>` 끼워넣기 |
| `detail/StageProgressBar.tsx` (신규) | ~80 | 4단계 (제안·진행·정산·종료) 진행 바 |
| `detail/OverviewTab.tsx` (재작성) | 76 → ~140 | 3열 그리드 합성 |
| `detail/overview/FinanceSummaryCard.tsx` (신규) | ~140 | 예산·수입·지출·잔여 + 진행률 |
| `detail/overview/MembersPreviewCard.tsx` (신규) | ~110 | PM·고객사·참여인력 N명 + "참여인력 탭" 링크 |
| `detail/overview/EventsTimelineCard.tsx` (신규) | ~170 | programs + schedule_events 통합 표시 |
| `detail/overview/ActivityTimelineCard.tsx` (신규) | ~150 | activity_logs.project_id 최근 8개 |
| `detail/overview/NextActionCard.tsx` (신규) | ~80 | 단계별 정적 안내 (status 분기) |
| `detail/overview/QuickActionsCard.tsx` (신규) | ~70 | 태스크·일지·보고서·외부공유 4 버튼 |
| `detail/projectDetailUtils.ts` (신규) | ~180 | 재무 집계·이벤트·활동 fetch |

**모든 신규 파일 < 400줄. V-1 통과.**

### D. DB 컬럼 매핑표

| V7 (LS·`*_v9`) | V2 (Supabase) | 비고 |
|---|---|---|
| `project.title` | `projects.name` | |
| `project.stage` 6단계 | `projects.status` 4단계 | 영업/제안/계약 → 제안, 실행 → 진행 |
| `project.contractAmount` | `projects.budget` | |
| `project.settledAmount` | `income.amount` SUM where project_id (status='입금완료') | 동적 집계 |
| `project.remaining` | budget − settled (계산) | |
| `project.pmName` | `projects.pm_id` → `profiles.name` | 이미 join 중 |
| `project.clientName` | `projects.client_id` → `clients.name` | 이미 join 중 |
| `project.internalMemberIds[]` | `project_members` 테이블 | |
| `project.consortiumPartners[]` | `consortium_members` 테이블 | 1차 미사용 |
| `activities` (LS) | `activity_logs` (project_id 필터) | |
| `linkedSchedules` | `schedule_events` (1차 미사용 — 별도 SQL 확인 필요) | |
| `linkedEducations` | `programs` (project_id 필터) | |
| `isFavorite` | (없음) | 1차 미사용 |

---

## 3. 최종 V2 프로젝트 상세 화면 구성안

```
┌──────────────────────────────────────────────────────────────┐
│ ← 프로젝트 목록                                                │
│ 프로젝트명  [상태배지]                    [결과보고서 작성]    │ ← 기존
│ 유형 · 고객사 · 담당자                                         │
├──────────────────────────────────────────────────────────────┤
│ ① 제안 ─── ② 진행 ─── ③ 정산 ─── ④ 종료                      │ ← 신규 StageProgressBar
│              ●                                                 │   (현재 단계 표시만)
├──────────────────────────────────────────────────────────────┤
│ [개요] [태스크] [참여인력] [파일] [포털]                       │ ← 기존 5탭
└──────────────────────────────────────────────────────────────┘

[개요 탭] — 3열 그리드 (lg 이상에서만, 모바일은 1열 적층)
┌─────────────────┬─────────────────┬─────────────────┐
│ 💰 재무 요약    │ 📋 기본정보     │ 📅 활동 타임라인│
│  예산           │ (기존 카드)      │  최근 8개       │
│  수입 합계      │                  │ ────────────────│
│  지출 합계      ├─────────────────┤ ✨ 다음 행동     │
│  잔여 (진행률)  │ 📝 설명          │  단계별 안내    │
│ ────────────────│ (기존 카드)      │ ────────────────│
│ 👥 참여자        │                  │ ⚡ 빠른 액션    │
│  PM · 고객사     │                  │  태스크·일지·   │
│  인력 N명        │                  │  보고서·공유    │
│ ────────────────┤                  │                 │
│ 🎯 이벤트·행사   │                  │                 │
│  programs +      │                  │                 │
│  schedule_events │                  │                 │
└─────────────────┴─────────────────┴─────────────────┘
```

> **left/center/right 3열**, 중앙은 **기존 OverviewTab의 기본정보·설명** 그대로 유지 (정보 손실 0). 좌·우는 V7 차용 신규 카드.

---

## 4. V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | 최대 ~210 (ProjectDetailPage) / 모든 신규 파일 ~80~180 / utils ~180 | ✅ |
| V-2 catch + 한글 | 각 fetch에 `console.error('[project-detail] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown 미사용 | Supabase nested join은 inline anonymous type | ✅ |
| V-4 한글 메시지 | 모두 한글 | ✅ |
| V-5 cancelled 가드 | 모든 useEffect 비동기 fetch에 적용 | ✅ |
| V-6 직접 fetch | 각 카드 컴포넌트가 자체 fetch (props는 projectId만 받음) | ✅ |
| V-7 디자인 토큰 | `#7C3AED`/`#F97316`/`#06B6D4`/`#10B981`/`#E11D48` 5톤 | ✅ |

---

## 5. 박경수님 의사결정 5개

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| Q1 | **즐겨찾기 컬럼 추가** (`projects.is_favorite`) | ❌ 제외 — 별도 STEP. 이번엔 status 진행만 |
| Q2 | **헤더 단계 칩 클릭 즉시 변경** (V7처럼) | ❌ 제외 — 1차는 시각화만. 수정은 기존 ProjectFormModal 유지 |
| Q3 | **활동 타임라인에서 인라인 일지 추가** | ❌ 제외 — `/activity-logs` 메뉴로 "+ 새 일지" 링크만 |
| Q4 | **AI 다음 행동 — callClaude 호출** | ❌ 제외 — 정적 안내 텍스트만 차용 (status 4종 분기) |
| Q5 | **컨소시엄 통합관리 메인 2탭** | ❌ 제외 — `/consortium/:id` STEP-CON 페이지에 풀버전 존재. 개요 탭에 "컨소시엄 페이지 열기" 링크만 (consortium_id 있을 때) |

---

## 6. 작업 순서 (OK 받은 뒤)

1. `detail/projectDetailUtils.ts` 신규 — 재무 집계 / 이벤트 fetch / 활동 fetch
2. `detail/StageProgressBar.tsx` 신규 — 4단계 진행 바
3. `detail/overview/FinanceSummaryCard.tsx` 신규
4. `detail/overview/MembersPreviewCard.tsx` 신규
5. `detail/overview/EventsTimelineCard.tsx` 신규
6. `detail/overview/ActivityTimelineCard.tsx` 신규
7. `detail/overview/NextActionCard.tsx` 신규
8. `detail/overview/QuickActionsCard.tsx` 신규
9. `detail/OverviewTab.tsx` 재작성 (3열 그리드 합성)
10. `ProjectDetailPage.tsx` 헤더에 StageProgressBar 끼워넣기
11. `tsc -b` 통과 → V-1~V-7 자체 검증 → 보고서 작성 → commit/push

**예상 commit 수**: 1건 (`feat: V7 이식 — 프로젝트 상세 개요 탭 + 단계 진행 바`)
**예상 작업 시간**: 50~60분

**롤백 안전성**: 단일 commit이므로 `git revert <hash>` 한 줄로 되돌리기 가능. OverviewTab·ProjectDetailPage는 수정 전 상태로 자동 복원.

---

## 7. 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q5 결정 → 그 후 코드 진입
