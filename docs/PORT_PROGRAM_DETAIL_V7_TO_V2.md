# V7 → V2 이식 사전 확인 문서 — 프로그램 상세 (1단계)

> 작성일: 2026-05-08
> 대상: 박경수님 검토용
> 진행 합의: **E (이 문서) → A (1단계 상세 페이지) → 결과 보고 후 2단계 여부 결정**
> 다음 단계: **이 문서 OK 받은 뒤 코드 작성 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| V7 파일 경로 | `C:\workflow\workflow_v7_full\src\pages\v9\EducationDetailV9.tsx` (2,441줄, 1파일, 17 카드) |
| 이식할 기능명 | **프로그램 상세 페이지 5~6 탭** (`/programs/:id`) |
| V2 목적 경로 | `src/pages/programs/ProgramDetailPage.tsx` (신규) + `programs/detail/*Tab.tsx` (신규 5~6개) + `programs/detail/programDetailUtils.ts` (신규) |
| 이식 이유 | V2 현재 `/programs`는 목록만 있고 **상세 페이지가 없음**. 클릭해도 갈 곳 없음. V7의 17 카드 정보를 V2의 흩어진 메뉴(출석·일지·신청·모집·폼·포털)에 임베드 형태로 모음 |

---

## 1단계 — 현황 파악 결과

### V7 EducationDetailV9 — 17 카드
교육 개요 / 공지사항 / 성과 목표 / 통계 KPI / 결과물 제출 현황 / 멘토링 관리 / 커리큘럼 / 교안 자료 / 만족도 응답 / 초빙 처리 / 강사 배정 현황 / 프로그램 분류 / 사전 교육생 명단 / 고객사 수신 현황

### V2 Programs 현황
- `/programs` (ProgramsPage 353줄) — 목록만
- `ProgramFormModal` 263줄 — 9 필드 모달 (신규/수정)
- `InvitationManagePanel` 303줄 — 강사 초청 패널 (목록 카드에서 펼침)
- **`/programs/:id` 라우트 없음** ⚠️ — App.tsx에 미정의

### 운영 기능 현 위치 (사이드바 흩어짐)
| 기능 | V2 메뉴 | 테이블 | program_id 연결? |
|---|---|---|---|
| 강사 초빙 | `/programs` 카드 펼침 | `instructor_invitations` | ✅ program_id |
| 교육생 신청 | `/applications` | `participant_applications` | ✅ program_id |
| 강사·TA 모집 | `/recruit-manage` | `recruit_forms` | ✅ program_id |
| 출석 | `/attendance` | `attendance_sessions`+`attendance_records` | ✅ program_id |
| 통합 일지 | `/activity-logs` | `activity_logs` | ✅ program_id |
| 외부 폼 | `/forms` | `public_forms`+`form_applications` | ✅ program_id |
| 수료증 | `/certificates` | `issued_certificates` | (확인 필요) |
| 커리큘럼 | (없음) | `Curriculum` (`education_id`) | ⚠️ **education_id** |
| 만족도 응답 | (없음) | `Survey` (`education_id`) | ⚠️ **education_id** |

### ⚠️ 스키마 발견 1 — Educations vs Programs 이중 구조
V2에 **두 종류의 테이블**이 공존:
- **Programs** (실제 사용 중, 사이드바 `/programs` 메뉴)
  - `programs`·`program_curriculum`(코드 미사용)·`attendance_sessions(program_id)`·`public_forms(program_id)`·`activity_logs(program_id)`·`participant_applications(program_id)`·`recruit_forms(program_id)`
- **Educations** (테이블만 있고 메뉴·페이지 없음)
  - `educations`·`curriculum(education_id)`·`students(education_id)`·`attendance(student_id)`·`surveys(education_id)`·`assignments(education_id)`

**Curriculum / Survey가 `education_id`로 묶여있어** programs 상세에서 직접 join 불가. 의사결정 필요 (Q1).

### ⚠️ 스키마 발견 2 — `program_curriculum` 테이블
CLAUDE.md엔 등록돼 있지만 **TypeScript 인터페이스 없음 + 코드 어디서도 안 씀**. Supabase에 실제로 존재하는지 박경수님 확인 필요 (Q2).

---

## 2단계 — 이식 계획

### A. 가져올 것 (V7 → V2)

| # | V7 카드 | V2 차용 형태 |
|---|---|---|
| 1 | 교육 개요 | 기본정보·공지·성과목표 통합 표시 |
| 2 | 통계 KPI | 신청수·출석률·만족도 등 집계 카드 |
| 3 | 강사 배정 현황 + 초빙 처리 | `instructor_invitations.program_id` 임베드 |
| 4 | 사전 교육생 명단 + 신청 현황 | `participant_applications.program_id` 임베드 + 모집은 `recruit_forms` |
| 5 | 출석 세션 | `attendance_sessions.program_id` 임베드 |
| 6 | 통합 일지 | `activity_logs.program_id` 임베드 |
| 7 | 결과물 제출 / 만족도 응답 | `public_forms` (form_type='survey'·'feedback') 임베드 |
| 8 | 고객사 수신 현황 | `project_portals` (project 단위) 안내 링크 |
| 9 | QR·공개 링크 | 신규 발행 + 복사·새탭 (3단계로 미루는 것도 가능) |

### B. 버릴 것 (V2 부적합 또는 별도 STEP)

| 버릴 항목 | 이유 |
|---|---|
| `localStorage` 인프라 | V2 절대 규칙 |
| 커리큘럼 카드 (1단계) | `education_id` 매핑 미해결 (Q1) |
| 만족도 응답 카드 (1단계) | 동일 |
| 멘토링 관리 카드 | V2 멘토링 시스템 미도입 (별도 STEP) |
| 프로그램 분류 카드 | 결과보고서 양식 매칭 — 별도 STEP |
| 교안 자료 카드 | `program_files` 테이블 부재 |
| AI 추출 / AI 다음 행동 | STEP-AI-PREP 후 |
| 자체 v9-card·다크모드·강한 그라데이션 | V2 표준 토큰 |
| 풍부한 단계별 데이터 폴더 | activity_logs에 stage 컬럼 없음 |

### C. V2 표준으로 새로 쓸 것

| 신규/수정 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `App.tsx` (수정) | +1 라인 | `/programs/:id` Route 추가 |
| `pages/programs/ProgramDetailPage.tsx` (신규) | ~190 | 헤더·탭 라우팅·fetch program 단건 |
| `pages/programs/detail/programDetailUtils.ts` (신규) | ~180 | 통계 집계·관련 fetch 함수들 |
| `pages/programs/detail/OverviewTab.tsx` (신규) | ~180 | 기본정보·KPI·통계 |
| `pages/programs/detail/StaffStudentsTab.tsx` (신규) | ~240 | 초빙 + 신청 + 모집 임베드 |
| `pages/programs/detail/AttendanceLogTab.tsx` (신규) | ~200 | 출석·일지 임베드 |
| `pages/programs/detail/SurveyResultTab.tsx` (신규) | ~180 | public_forms (survey/feedback) 임베드 |
| `pages/programs/detail/ShareTab.tsx` (신규) | ~150 | 공개 링크·QR·외부 폼·포털 안내 |
| `pages/programs/ProgramsPage.tsx` (수정) | +5 라인 | 목록 카드 클릭 → `/programs/:id` 이동 |

**모든 신규 파일 < 400줄. V-1 통과.**

### D. DB 컬럼 매핑표

| V7 (LS·Education) | V2 (Supabase·Program) | 비고 |
|---|---|---|
| `education.title` | `programs.name` | |
| `education.startAt`/`endAt` | `programs.start_date`/`end_date` | |
| `education.location` | `programs.venue` | |
| `education.targetAudience`+`targetCount` | `programs.description`(텍스트)+`programs.capacity` | |
| `education.publicToken` | (없음) — `public_forms.form_token` 활용 | |
| `education.curriculum[]` | (해결 보류 — Q1) | |
| `education.invitations[]` | `instructor_invitations.program_id` | |
| `education.expectedStudents[]` | `participant_applications.program_id` | |
| `education.attendees[]` | `attendance_sessions.program_id` + `attendance_records` | |
| `education.surveys[]` | (해결 보류 — Q1) | |
| `education.materials[]` | (별도 STEP) | |
| `education.notice` | `programs.description` 또는 별도 컬럼 | 1차엔 description 활용 |

### V2 status / type 매핑 — 변경 없음
- `programs.type`: '교육'·'캠프'·'행사'·'기타' (V2 표준 그대로)
- `programs.status`: '준비'·'진행'·'완료'·'취소' (V2 표준 그대로)

---

## 3. 최종 V2 프로그램 상세 화면 구성안

```
┌──────────────────────────────────────────────────────────────┐
│ ← 프로그램 목록                                                │
│ 프로그램명  [유형배지] [상태배지]              [수정] [공개링크]│
│ 기간 · 장소 · 정원                                              │
│ 프로젝트: [프로젝트명] (있으면 클릭→프로젝트 상세)              │
└──────────────────────────────────────────────────────────────┘
[개요] [강사·교육생] [출석·일지] [결과·만족도] [공유]            ← 5탭

[개요 탭]
┌──────────────┬──────────────┬──────────────┐
│ 기본 정보     │ 통계 KPI      │ 빠른 액션     │
│ (description, │ 신청·승인·   │ 출석 시작·    │
│  공지)        │ 출석률·만족도│ 폼 발행·일지  │
└──────────────┴──────────────┴──────────────┘

[강사·교육생 탭]
┌──────────────┬──────────────┐
│ 🎤 강사 초빙  │ 👥 교육생 신청 │
│ instructor_   │ participant_  │
│ invitations   │ applications  │
│ + 추가/수정   │ + 신청 상세  │
├──────────────┼──────────────┤
│ 📣 모집 공고  │              │
│ recruit_forms │              │
└──────────────┴──────────────┘

[출석·일지 탭]
- attendance_sessions 목록 + "+ 새 세션" → /attendance/:sessionId 점프
- activity_logs 최근 8건 + "+ 새 일지" → /activity-logs

[결과·만족도 탭]
- public_forms (form_type='survey' or 'feedback') 목록 + 응답 수
- form_applications 최근 응답 미리보기

[공유 탭]
- 공개 신청 폼 발행 (`/apply/:programId`)
- 모집 공고 링크 (`/recruit/:token`)
- 출석 외부 (`/attend/:token`)
- 일지 외부 (`/log/:token`)
- 프로젝트 포털 안내 (project_portals — 프로젝트 단위)
```

---

## 4. V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | 최대 ~240 (StaffStudentsTab) — 모든 신규 파일 안전 | ✅ |
| V-2 catch + 한글 | 각 fetch에 `console.error('[program-detail] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown 미사용 | Supabase nested join은 inline anonymous type | ✅ |
| V-4 한글 메시지 | 모두 한글 | ✅ |
| V-5 cancelled 가드 | 모든 useEffect 비동기 fetch에 적용 | ✅ |
| V-6 직접 fetch | 각 탭이 자체 fetch (props는 programId만 받음) | ✅ |
| V-7 디자인 토큰 | violet/orange/cyan/emerald/rose 5톤 | ✅ |

---

## 5. 박경수님 의사결정 필요 (Q1~Q5)

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| **Q1** | **커리큘럼·만족도 카드 (Curriculum/Survey 테이블)** — `education_id`로 묶여있는데 V2엔 `/educations` 메뉴 없음 | ❌ **1단계 미구현** + "준비 중" 안내. 후속 결정: ① Educations 메뉴 도입 ② Curriculum 테이블에 `program_id` 컬럼 추가 ③ 그대로 유지 |
| **Q2** | **`program_curriculum` 테이블 실제 존재 여부** | Supabase Dashboard에서 박경수님 확인 후 결과 알려주시면 1단계 OverviewTab에 차시 정보 표시 가능. 없으면 "준비 중" |
| **Q3** | **상세 헤더에 "공개 링크" 버튼** (V7처럼 토큰 발행 후 복사·새탭·QR) | ⚠️ **3단계로 미루기** 추천 — 1단계엔 "공유 탭"에서 처리. 헤더는 깔끔하게 [수정] 버튼만 |
| **Q4** | **사이드바 메뉴(`/attendance`·`/activity-logs` 등) 제거하고 상세 안으로만 통합?** | ❌ **유지** — 상세는 임베드(미리보기 + 메뉴 점프). 메뉴 통째 제거는 큰 변화 |
| **Q5** | **AI 통계 / 다음 행동 안내** | ❌ **제외** — STEP-AI-PREP 후. 1단계 통계는 단순 SQL 집계만 |

---

## 6. 작업 순서 (OK 받은 뒤)

1. `programs/detail/programDetailUtils.ts` — fetch 함수들
2. `programs/detail/OverviewTab.tsx`
3. `programs/detail/StaffStudentsTab.tsx`
4. `programs/detail/AttendanceLogTab.tsx`
5. `programs/detail/SurveyResultTab.tsx`
6. `programs/detail/ShareTab.tsx`
7. `programs/ProgramDetailPage.tsx` (헤더 + 탭 라우팅)
8. `App.tsx` — `/programs/:id` Route 추가
9. `programs/ProgramsPage.tsx` — 카드/리스트 클릭 → 상세 이동
10. `tsc -b` 통과 → V-1~V-7 자체 검증 → 보고서 작성 → commit/push

**예상 commit 수**: 1건 (`feat: V7 이식 — 프로그램 상세 5탭 페이지`)
**예상 작업 시간**: 60~80분
**롤백 안전성**: 단일 commit이므로 `git revert <hash>` 한 줄로 복원

---

## 7. 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q5 결정 → 그 후 코드 진입
