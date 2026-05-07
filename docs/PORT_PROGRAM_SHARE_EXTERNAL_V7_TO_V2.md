# 사전 확인 문서 — 외부공유 페이지 3종 (Stage 3-B-2)

> 작성일: 2026-05-08
> 사전 합의: Stage 3-B-1 (관리자 탭) 확인 완료 → Stage 3-B-2 (외부 페이지) 진입 준비
> 박경수님 명세: 무인증 + 모바일 반응형 필수
> 다음 단계: **Q1~Q5 결정 + 승인 → 코드 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| 신규 라우트 | `/share/client/:token`·`/share/student/:token`·`/share/expert/:token` (모두 무인증) |
| 데이터 진입점 | `program_share` 테이블 (Stage 3-B-1에서 RLS public_read_by_token 적용 완료) |
| 기준 동작 | token 검증 → program_share + program 조회 → 단계 자동 판별 → visibility 기준 항목 렌더 |
| 모바일 반응형 | 단일 컬럼 / 터치 타겟 ≥ 44px / 폰트 ≥ 14px |
| 13 항목 분포 | 고객 7 / 학생 3 / 전문가 3 |

---

## 1단계 — 항목별 데이터 출처 매핑 (섹션 1)

### 고객(ClientSharePage) 7 항목

| # | 항목 (key) | 단계 | 데이터 출처 | 신규? |
|---|---|---|---|---|
| 1 | `basic_info` 기본정보 | 사전·준비 | `programs` 단건 (name·venue·start_date·end_date·notice) | 기존 |
| 2 | `curriculum` 커리큘럼 | 사전·준비 | `program_curriculum` (program_id) — 차시·시간·주제·내용 | 기존 |
| 3 | `instructors` 강사정보 | 사전·준비 | `curriculum_staff` where role IN ('강사','FT') + `staff_pool`/`profiles` join (name·career_summary·profile_image_url **만**, ⚠️ 연락처·계좌 절대 X) | 기존 |
| 4 | `materials` 교재 | 사전·준비 | `programs.notice_files` jsonb (Stage 1에서 추가) — 1단계 활용 | 기존 |
| 5 | `survey_view` 만족도 확인 | 결과 | `surveys` (program_id) 통계 — 응답 수·평균·코멘트 (read-only) | 기존 |
| 6 | `edit_request` 수정요청 버튼 | 결과 | **신규 응답 INSERT** — Q1 결정 | 응답 |
| 7 | `feedback_comments` 의견회신 댓글 | 결과 | **신규 댓글 시스템** — Q1 결정 | 응답 |

### 학생(StudentSharePage) 3 항목

| # | 항목 | 단계 | 데이터 출처 | 신규? |
|---|---|---|---|---|
| 1 | `checkin` 출석체크 링크 | 진행 | `attendance_sessions` (program_id·check_in_open=true) → 각 세션 `/attend/:session_token` 점프 | 기존 |
| 2 | `survey_submit` 만족도 응답 폼 | 결과 | `public_forms` (program_id·form_type='survey'·is_active) → `/form/:form_token` 점프 또는 직접 응답 | 기존 |
| 3 | `outcome_upload` 결과물 업로드 | 결과 | **Q3 결정 필요** — Storage 통합 vs URL 입력 vs 외부 폼 활용 | 응답 |

### 전문가(ExpertSharePage) 3 항목

| # | 항목 | 단계 | 데이터 출처 | 신규? |
|---|---|---|---|---|
| 1 | `invite_response` 초대수락/거절 | 사전 | **Q2 본인 식별 결정 후** → `curriculum_staff` where 본인 매칭된 차시 → 수락/거절 UPDATE | 응답 |
| 2 | `activity_log` 활동일지 작성 | 진행 | **Q2 본인 식별 후** → `activity_logs` INSERT (program_id·expert_id) | 응답 |
| 3 | `lecture_certificate` 강의확인서 수령 | 결과 | **Q2 본인 식별 + Q4 결정** → `issued_certificates` (type='lecture') 조회 | 응답 |

### ⚠️ 발견한 이슈 — 전문가 본인 식별 (Q2)

`program_share.expert_token`은 program 단위 토큰. 어떤 전문가인지 식별 불가.

해결 옵션 (Q2):

| 옵션 | 동작 | 추천 |
|---|---|---|
| **A. 전화번호 입력** | 진입 시 sessionStorage 없으면 전화번호 입력 → `curriculum_staff` 또는 `staff_pool.phone` 매칭 → 본인 차시 표시 | ✅ **추천** — 단순. V2 절대 규칙 sessionStorage 금지지만 박경수님 v9 시스템 룰에 "끝 4자리 sessionStorage 보존" 예외 명시. 1차는 매번 입력으로 단순화 |
| B. curriculum_staff.token 활용 | 기존 `/curriculum-invite/:token`(미구현 예고만 있음) 와 통합 — 각 차시별 토큰으로 본인 식별 | ⚠️ 토큰 2개로 분기, UX 복잡 |
| C. 미인증 단순 표시 | 본인 식별 X — 전체 강사 목록·전체 활동일지 노출 | ❌ 보안·프라이버시 부적합 |

---

## 2단계 — 응답 데이터 모델 (섹션 2)

박경수님 명세 응답형 항목 5종:
- 고객: 수정요청 (edit_request) / 의견회신 댓글 (feedback_comments)
- 학생: 결과물 업로드 (outcome_upload)
- 전문가: 활동일지 (activity_log) — 기존 `activity_logs` 활용

### Q1 — 응답 저장 모델

| 옵션 | 동작 | 추천 |
|---|---|---|
| **A. 단일 통합 테이블** | `program_share_responses` (program_id, response_type, audience, author_name, author_phone, payload jsonb, created_at) | ⚠️ 빠른 구현, 향후 분리 시 마이그레이션 |
| **B. 분리 테이블 2개** | `program_edit_requests` + `program_share_comments` (수정요청·댓글) — 결과물은 form_applications 활용, 활동일지는 기존 activity_logs | ✅ **추천** — 명확. type-safe. 댓글은 답글·정렬 등 자주 사용 |
| C. 모든 항목 별도 테이블 5개 | 항목별 1 테이블 | ❌ 과도. 결과물·일지·확인서는 기존 활용 가능 |

**제 추천: 옵션 B**

---

## 3단계 — 신규 테이블 SQL (섹션 3 — Q1·B 옵션 채택 시)

```sql
-- ============================================================
-- 1. program_edit_requests — 고객 수정요청
-- ============================================================
CREATE TABLE public.program_edit_requests (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  requester_name TEXT NOT NULL,
  requester_phone TEXT,
  content       TEXT NOT NULL,
  status        TEXT NOT NULL DEFAULT 'pending'
                CHECK (status IN ('pending', 'reviewing', 'resolved', 'rejected')),
  reviewed_by   UUID REFERENCES public.profiles(id),
  reviewed_at   TIMESTAMPTZ,
  review_note   TEXT,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_program_edit_requests_program_id ON public.program_edit_requests(program_id);
ALTER TABLE public.program_edit_requests ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_insert" ON public.program_edit_requests FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_all" ON public.program_edit_requests FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- ============================================================
-- 2. program_share_comments — 의견회신 댓글 (답글 1단계)
-- ============================================================
CREATE TABLE public.program_share_comments (
  id            UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id    UUID NOT NULL REFERENCES public.programs(id) ON DELETE CASCADE,
  parent_id     UUID REFERENCES public.program_share_comments(id) ON DELETE CASCADE,
  author_role   TEXT NOT NULL CHECK (author_role IN ('client', 'staff')),
  author_name   TEXT NOT NULL,
  content       TEXT NOT NULL,
  is_deleted    BOOLEAN NOT NULL DEFAULT FALSE,
  created_at    TIMESTAMPTZ NOT NULL DEFAULT now()
);
CREATE INDEX idx_program_share_comments_program_id ON public.program_share_comments(program_id);
CREATE INDEX idx_program_share_comments_parent_id ON public.program_share_comments(parent_id);
ALTER TABLE public.program_share_comments ENABLE ROW LEVEL SECURITY;
CREATE POLICY "public_select" ON public.program_share_comments FOR SELECT USING (true);
CREATE POLICY "public_insert" ON public.program_share_comments FOR INSERT WITH CHECK (true);
CREATE POLICY "auth_all" ON public.program_share_comments FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

### 학생 결과물 업로드 — Q3

| 옵션 | 동작 | 추천 |
|---|---|---|
| **A. URL 입력** | 학생이 외부 클라우드(드라이브 등) 업로드 후 URL 제출 → `form_applications` 활용 (form_type='application') | ✅ **추천** — 1단계 단순. Stage 1 NoticeCard 패턴 |
| B. Storage 통합 | Supabase Storage 업로드 | ⚠️ STEP-STORAGE 후 |
| C. 결과물 폼 신규 | program_outcome_submissions 테이블 신규 + Storage | ❌ 과도. 1단계 미적합 |

**제 추천: 옵션 A** — 기존 form_applications 재사용. URL 입력 + 학생 이름·전화

### 전문가 강의확인서 수령 — Q4

| 옵션 | 동작 | 추천 |
|---|---|---|
| **A. issued_certificates 조회만** | 관리자가 미리 발급한 강의확인서를 본인 식별 후 다운로드 | ✅ **추천** — 기존 시스템 활용 |
| B. 즉석 발급 | 외부에서 본인이 [발급 요청] → certificate_templates 기반 PDF 즉석 생성 | ⚠️ STEP-PDF-GEN 후 |
| C. 미구현 placeholder | 1단계 안내문만 | ❌ 박경수님 명세 충족 X |

**제 추천: 옵션 A** — 관리자 사전 발급 → 외부에서 본인 식별 후 다운로드

---

## 4단계 — 화면 구성 + 모바일 반응형 (섹션 4)

### 공통 레이아웃 (3 페이지 동일)

```
┌─────────────────────────────────┐ <- 모바일 max-w-md, 데스크톱 max-w-2xl
│ 🎓 프로그램명                    │ <- 헤더
│ [현재 단계 배지]                  │
│ 기간 · 장소                       │
├─────────────────────────────────┤
│ ┌─ 항목 카드 1 ────────────────┐ │ <- 단일 컬럼
│ │ 📅 기본정보                   │ │   (sm 이상에서 grid-cols-2 가능)
│ │ ...                           │ │
│ └───────────────────────────────┘ │
│ ┌─ 항목 카드 2 ────────────────┐ │
│ │ 📋 커리큘럼                   │ │
│ │ - 1차시 09:00~10:00          │ │
│ │ - 2차시 10:00~12:00          │ │
│ └───────────────────────────────┘ │
│ ...                                │
├─────────────────────────────────┤
│ © 2026 BalanceDot WorkFlow       │
└─────────────────────────────────┘
```

### 단계별 노출 흐름

```ts
// 진입 시
const share = await fetchProgramShareByToken(audience, token);
if (!share) → 404 화면
const stage = detectStage(today, share);
if (stage === 'before') → "아직 시작 전" 화면
const items = STAGE_ITEMS[audience][stage].filter(item =>
  share.visibility[audience]?.[item] !== false
);
// items 배열 순서대로 렌더
```

### 신규 파일 구성

| 신규 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `src/pages/share-portal/sharePortalUtils.ts` | ~150 | token 검증·fetch·항목 데이터 fetch |
| `src/pages/share-portal/SharePortalShell.tsx` | ~120 | 공통 레이아웃 + 헤더 + 404 + 시작 전 화면 |
| `src/pages/share-portal/ClientSharePage.tsx` | ~100 | 고객용 — 7 항목 합성 |
| `src/pages/share-portal/StudentSharePage.tsx` | ~100 | 학생용 — 3 항목 합성 |
| `src/pages/share-portal/ExpertSharePage.tsx` | ~150 | 전문가용 — 3 항목 + 본인 식별 (전화번호) |
| `src/pages/share-portal/identity/PhoneIdentityGate.tsx` | ~120 | 전문가 전화번호 입력 게이트 (Q2 옵션 A) |
| `src/pages/share-portal/items/BasicInfoItem.tsx` | ~80 | programs 기본정보 |
| `src/pages/share-portal/items/CurriculumItem.tsx` | ~120 | program_curriculum |
| `src/pages/share-portal/items/InstructorsItem.tsx` | ~140 | curriculum_staff (강사·FT) — 사진·이름·약력만 |
| `src/pages/share-portal/items/MaterialsItem.tsx` | ~70 | programs.notice_files 다운로드 링크 |
| `src/pages/share-portal/items/SurveyViewItem.tsx` | ~110 | surveys 통계 |
| `src/pages/share-portal/items/EditRequestItem.tsx` | ~140 | program_edit_requests INSERT |
| `src/pages/share-portal/items/FeedbackCommentsItem.tsx` | ~200 | program_share_comments + 답글 |
| `src/pages/share-portal/items/CheckinItem.tsx` | ~90 | attendance_sessions → /attend/:token 점프 |
| `src/pages/share-portal/items/SurveySubmitItem.tsx` | ~80 | public_forms → /form/:token 점프 |
| `src/pages/share-portal/items/OutcomeUploadItem.tsx` | ~140 | URL 입력 → form_applications INSERT |
| `src/pages/share-portal/items/InviteResponseItem.tsx` | ~150 | curriculum_staff 본인 매칭 차시 + 수락/거절 |
| `src/pages/share-portal/items/ActivityLogItem.tsx` | ~180 | activity_logs INSERT |
| `src/pages/share-portal/items/LectureCertificateItem.tsx` | ~120 | issued_certificates 조회 + 다운로드 |
| `src/App.tsx` (수정) | +6 | 3 라우트 추가 |
| `src/types/database.ts` (수정) | +20 | ProgramEditRequest·ProgramShareComment |
| `supabase/migrations/20260521_share_responses.sql` (신규) | ~50 | 2 테이블 + RLS |

**합계 추정**: ~2,400줄 (20 신규 + 3 수정 + 1 SQL) / 모두 < 400줄

> ⚠️ V-1 통과는 가능하나 한 commit으로는 검토 부담 큼 → **Q5 분할 검토**

---

## 5단계 — Stage 분할 (Q5)

| 옵션 | 동작 | 추천 |
|---|---|---|
| **X** | 한 commit (~2,400줄, 20 신규) | ⚠️ 검토 부담 |
| **Y** | 페이지별 3 commit (Client / Student / Expert) | ⚠️ 공통 SharePortalShell + items가 페이지 간 공유라 1번째 commit이 큼 |
| **Z** | **2 commit** — (1) 공통 셸 + 고객용 페이지(7 항목, read-only 위주) (2) 학생·전문가 페이지(응답형 위주) | ✅ **추천** — 검증 단위 명확. Stage 3-B-1 패턴과 일관 |

**제 추천: 옵션 Z**

### Stage 3-B-2-① — 공통 셸 + 고객용 (60~80분)
- SharePortalShell, ClientSharePage
- 항목 7개: BasicInfo, Curriculum, Instructors, Materials, SurveyView, EditRequest, FeedbackComments
- 신규 테이블 2개 (program_edit_requests, program_share_comments)

### Stage 3-B-2-② — 학생·전문가 (60~80분)
- StudentSharePage, ExpertSharePage, PhoneIdentityGate
- 항목 6개: Checkin, SurveySubmit, OutcomeUpload, InviteResponse, ActivityLog, LectureCertificate
- form_applications 활용 (URL 입력)

---

## 6단계 — V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | 최대 ~200 (FeedbackComments) | ✅ |
| V-2 catch + 한글 | `console.error('[share-portal/<page>] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown | nested join 일부 + inline anonymous type | ✅ |
| V-4 한글 메시지 | 외부 페이지라 더 친근한 한글 | ✅ |
| V-5 cancelled 가드 | 모든 useEffect 비동기 fetch | ✅ |
| V-6 직접 fetch | 각 항목 컴포넌트 자체 fetch (props는 programId·share만) | ✅ |
| V-7 디자인 토큰 | violet/orange/cyan 톤 + 모바일 반응형 |  ✅ |

**모바일 반응형 추가 점검**:
- 컨테이너: `max-w-md` (모바일) → `sm:max-w-2xl`
- 터치 타겟: 버튼 `h-11 px-4` (44×height)
- 폰트: 본문 `text-sm` (14px) 또는 `text-base` (16px)
- 단일 컬럼 (sm 이상에서 일부 grid-cols-2)

---

## 7단계 — 박경수님 의사결정 5개 (Q1~Q5)

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| **Q1** | **응답 데이터 모델** — A(단일 jsonb) / B(분리 2 테이블 + 기존 활용) / C(항목별 5 테이블) | ✅ **B** — 명확 + 재사용. 신규 2 테이블만 (program_edit_requests + program_share_comments) |
| **Q2** | **전문가 본인 식별** — A(전화번호 입력) / B(curriculum_staff.token 활용) / C(미인증 전체 노출) | ✅ **A** — 진입 시 전화번호 게이트. staff_pool.phone 매칭 |
| **Q3** | **학생 결과물 업로드** — A(URL 입력 + form_applications) / B(Storage 통합) / C(전용 테이블) | ✅ **A** — 1단계 단순. STEP-STORAGE 후 B로 전환 가능 |
| **Q4** | **강의확인서 수령** — A(issued_certificates 조회만) / B(즉석 발급) / C(placeholder) | ✅ **A** — 관리자 사전 발급 + 본인 식별 후 다운로드 |
| **Q5** | **Stage 분할** — X(한 commit) / Y(페이지별 3) / **Z(공통+고객 / 학생·전문가)** | ✅ **Z** — 검증 단위 명확, Stage 3-B-1 패턴과 일관 |

---

## 8단계 — 작업 순서 (승인 후)

### Stage 3-B-2-① — 공통 셸 + 고객용 (60~80분, 1 commit)
1. **Q1·Q2·Q3·Q4 SQL 박경수님 직접 실행** (program_edit_requests + program_share_comments)
2. `migrations/20260521_share_responses.sql` (보존본)
3. `types/database.ts` — ProgramEditRequest + ProgramShareComment
4. `share-portal/sharePortalUtils.ts` — token 검증·fetch
5. `share-portal/SharePortalShell.tsx` — 공통 레이아웃·404·시작 전
6. `share-portal/items/{BasicInfo,Curriculum,Instructors,Materials,SurveyView,EditRequest,FeedbackComments}Item.tsx`
7. `share-portal/ClientSharePage.tsx`
8. `App.tsx` — `/share/client/:token` 라우트
9. tsc -b → V-1~V-7 검증 → 보고서 → commit/push

### Stage 3-B-2-② — 학생·전문가 (60~80분, 1 commit)
1. `share-portal/identity/PhoneIdentityGate.tsx`
2. `share-portal/items/{Checkin,SurveySubmit,OutcomeUpload,InviteResponse,ActivityLog,LectureCertificate}Item.tsx`
3. `share-portal/StudentSharePage.tsx` + `ExpertSharePage.tsx`
4. `App.tsx` — 2 라우트 추가
5. tsc -b → V-1~V-7 검증 → 보고서 → commit/push

**롤백**: 각 commit 별도 revert. SQL revert만 별도.

---

## 9. 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q5 결정 → 그 후 Stage 3-B-2-① 코드 진입

**Q1 (옵션 B 분리 2 테이블) 진행 시 SQL** — 섹션 3에 전체 SQL 있어요. 박경수님이 Supabase Dashboard에서 직접 실행하시고 결과 알려주시면 코드 진입할게요.
