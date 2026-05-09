# STEP-MENTORING 사전 확인 문서

> bal24-workflow-v2 | 2026-05-09
> 작성자: 박경수님 (사전 확인 문서)
> 전제: STEP-PROGRAM-TYPE · STEP-PROGRAM-MODULE-RENDER · STEP-PROGRAM-ASSIGNMENT 완료

---

## 📌 핵심 결론 요약

- DB 3 테이블 신규: `mentoring_assignments` (멘토↔멘티 매핑 + 지급 기준) + `mentoring_sessions` (회차별 일지) + `mentoring_feedbacks` (피드백)
- `activity_logs.log_type='mentoring'` 은 V2 에서 폐기: 단순 텍스트 로그로는 멘토링일지 양식 (주제·내용·사진·회수) 수용 불가 → 별도 `mentoring_sessions` 테이블로 대체
- 지급 방식 2 종: ① 단가 × 회수  ② 전체 1회 계약금액 — PM 이 프로그램별로 직접 선택 입력
- 원천징수 선택: 멘토·강사 (전문가활용비) 가 본인 로그인 후 선택 (3.3% 사업소득 / 8.8% 기타소득) — 강사료도 동일 정책 적용 (Q5 별도 STEP)
- 접근 방식 2 트랙: PARTNER 로그인 (bal24.kr) + `/mentoring-mentor/:token` 토큰 링크 둘 다 지원

---

## ✅ 가져올 것 / ❌ 버릴 것

### ✅ 가져올 것

| 항목 | 출처 | V2 적용 방식 |
|---|---|---|
| 멘토링일지 양식 | 멘토링일지.pdf | mentoring_sessions: 멘토·일시·주제·내용·사진첨부 |
| 멘토 전문분야 태그 | guruai 스크린샷 | profiles.expertise 컬럼 활용 (기존) |
| 멘토 상태관리 | guruai 대시보드 | instructor_invitations.status 기존 구조 재활용 |
| 커리큘럼 토큰 패턴 | V2 기존 | /mentoring-mentor/:token, /mentoring-student/:token |
| 관리자 메모 | guruai 수정화면 | mentoring_assignments.pm_note 컬럼 |

### ❌ 버릴 것

| 항목 | 버리는 이유 |
|---|---|
| activity_logs.log_type='mentoring' | 단순 텍스트로는 주제·사진·회수 수용 불가 → mentoring_sessions 로 완전 대체 |
| guruai 멘토 승인/보류 관리 | V2 는 instructor_invitations 기반 — 별도 mentor 승인 테이블 불필요 |
| guruai 멘토 독립 회원가입 | V2 는 PARTNER 로그인 방식 확정 — 별도 가입 플로우 없음 |
| 멘토 스킬 별도 테이블 | profiles.expertise 문자열로 충분 — 이번 STEP 범위 아님 |

---

## 📂 파일 분할 계획

| 파일 경로 | 예상 줄 수 | 역할 |
|---|---|---|
| src/types/mentoring.ts | ~60 | MentoringAssignment · MentoringSession · MentoringFeedback 타입 |
| src/pages/programs/detail/MentoringTab.tsx | ~280 | PM용 멘토링 탭 — 매핑 목록 + 회차별 일지 테이블 |
| src/pages/programs/detail/MentoringAssignModal.tsx | ~220 | 멘토 배정 모달 — 지급방식 선택 + 원천징수 표시 |
| src/pages/programs/detail/mentoringUtils.ts | ~80 | fetchMentoringAssignments · fetchSessions · calcPay 헬퍼 |
| src/pages/mentoring/MentoringMentorPage.tsx | ~260 | 멘토 전용 페이지 — 일지 작성 + 목록 (토큰 또는 PARTNER 로그인) |
| src/pages/mentoring/MentoringStudentPage.tsx | ~200 | 멘티 전용 페이지 — 일지 조회 + 피드백 제출 (토큰) |
| src/pages/mentoring/MentoringPartnerView.tsx | ~150 | PARTNER 로그인 시 진입 — 내 배정 프로그램 + 일지 작성 버튼 |
| supabase/migrations/20260509_mentoring.sql | ~80 | 3 개 테이블 + RLS + 인덱스 |

**합계**: 7 개 파일 + SQL 1 개 / 총 ~1,330 줄 (파일당 최대 280 줄)

---

## 🗄️ DB 설계 (신규 3 테이블)

### `mentoring_assignments` — 멘토 ↔ 프로그램 매핑 + 지급 기준

```sql
CREATE TABLE mentoring_assignments (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  program_id      UUID REFERENCES programs(id) ON DELETE CASCADE,
  mentor_id       UUID REFERENCES profiles(id),
  mentee_ids      UUID[],
  meet_type       TEXT CHECK (meet_type IN ('대면', '비대면', '혼합')),
  pay_type        TEXT CHECK (pay_type IN ('단가×회수', '전체계약')),
  unit_price      INTEGER,
  session_count   INTEGER,
  contract_amount INTEGER,
  tax_type        TEXT CHECK (tax_type IN ('3.3%', '8.8%', '면세')),
  pm_note         TEXT,
  status          TEXT DEFAULT '진행' CHECK (status IN ('진행', '완료', '취소')),
  created_at      TIMESTAMPTZ DEFAULT NOW(),
  updated_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `mentoring_sessions` — 회차별 멘토링 일지

```sql
CREATE TABLE mentoring_sessions (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  assignment_id   UUID REFERENCES mentoring_assignments(id) ON DELETE CASCADE,
  session_date    DATE NOT NULL,
  topic           TEXT NOT NULL,
  content         TEXT NOT NULL,
  photo_urls      TEXT[],
  session_no      INTEGER,
  submitted_by    UUID REFERENCES profiles(id),
  submitted_at    TIMESTAMPTZ,
  created_at      TIMESTAMPTZ DEFAULT NOW()
);
```

### `mentoring_feedbacks` — 멘티 피드백

```sql
CREATE TABLE mentoring_feedbacks (
  id              UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  session_id      UUID REFERENCES mentoring_sessions(id) ON DELETE CASCADE,
  mentee_id       UUID REFERENCES profiles(id),
  rating          INTEGER CHECK (rating BETWEEN 1 AND 5),
  comment         TEXT,
  submitted_at    TIMESTAMPTZ DEFAULT NOW()
);
```

---

## 💰 지급 계산 로직

```
pay_type = '단가×회수'  →  실지급액 = unit_price × 완료_session_count
pay_type = '전체계약'   →  실지급액 = contract_amount (고정)

원천징수:
  3.3%  →  공제액 = 실지급액 × 0.033  (사업소득)
  8.8%  →  공제액 = 실지급액 × 0.088  (기타소득)
  면세  →  공제액 = 0

실수령액 = 실지급액 - 공제액
```

강사료 동일 정책: program_staff_fees 의 원천징수도 같은 3 종 선택 구조를 적용한다.
(기존 3.3%/8.8% 고정값 → 멘토·강사 본인이 로그인 후 선택하는 방식으로 추후 통합 STEP 에서 개선 — Q5 별도 STEP)

---

## 🔄 의사결정 사항 (Q1~Q5)

(Q1~Q4 는 이전 세션에서 승인 완료. 아래는 이번 자료 분석 후 추가 필요한 결정 사항)

### Q1. mentoring_assignments.mentee_ids 저장 방식

- A: UUID 배열 (`mentee_ids UUID[]`) — 단순, 멘티별 상태 저장 불가
- B: 별도 `mentoring_mentees` 연결 테이블 — 멘티별 상태·피드백 개별 추적 가능

**추천 A** — 이번 STEP 은 일지·지급 구현이 핵심. 멘티별 추적은 별도 STEP 으로 분리.

### Q2. 원천징수 선택 시점

- A: 배정 시 PM 이 기본값 입력, 멘토 로그인 후 변경 가능
- B: 배정 시 비워두고, 멘토가 첫 로그인 시 필수 선택

**추천 A** — PM 이 초안 입력, 멘토가 로그인 후 확인·변경. 실무 흐름 자연스럽고 지급 계산도 즉시 가능.

### Q3. 멘토링일지 사진 첨부 방식

- A: Supabase Storage 직접 업로드 (`photo_urls TEXT[]`)
- B: 이번 STEP 에서 사진 첨부 제외 → 다음 STEP 으로 분리

**추천 A** — 일지 핵심 필드. `mentoring-sessions` 버킷에 업로드, 최대 5 장 제한.

### Q4. MentoringTab 위치 (프로그램 상세 내)

- A: 기존 placeholder → 실 컴포넌트 교체 (`MentoringTab` 으로 대체)
- B: 커리큘럼 탭 옆에 새로운 탭으로 수동 추가

**추천 A** — `MODULE_TO_TAB` 의 `'mentoring'` → `MentoringTab` 교체. 기존 표준 유지.

### Q5. 강사료 (program_staff_fees) 원천징수 통합 여부

- A: 이번 STEP 에서 program_staff_fees 에도 tax_type 컬럼 추가
- B: 강사료 원천징수는 별도 STEP-STAFF-FEE-TAX 로 분리

**추천 B** — 멘토링 STEP 범위를 명확하게 유지. 강사료 원천징수는 STEP-STAFF-FEE-TAX 에서 처리.

---

## 🗺️ 라우트 추가 (신규)

```
/mentoring-mentor/:token   → MentoringMentorPage  (토큰 또는 PARTNER 로그인)
/mentoring-student/:token  → MentoringStudentPage (멘티 토큰)
```

---

## 📋 RLS 정책 요약

| 테이블 | PM/Admin | 멘토 (PARTNER) | 멘티 (토큰) |
|---|---|---|---|
| mentoring_assignments | ALL | SELECT (본인 배정) | SELECT (본인) |
| mentoring_sessions | ALL | INSERT/UPDATE (본인) | SELECT |
| mentoring_feedbacks | SELECT | SELECT | INSERT (본인) |
