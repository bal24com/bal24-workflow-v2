# 사전 확인 문서 — 프로그램 외부공유 탭 전면 확장 (Stage 3-B)

> 작성일: 2026-05-08
> 진행 합의: 사전 확인 → Q1~Q5 결정 → 코드 진입
> 박경수님 명세: 4단계 × 3대상 매트릭스 + 단계 자동 판별 + 외부 페이지 3종
> 다음 단계: **Q1~Q5 결정 + 승인 → 코드 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| 현재 V2 | `ShareTab.tsx` 207줄 — 토큰 링크 모음 (신청·모집·출석·폼) |
| 박경수님 명세 | **4단계 × 3대상** 매트릭스 + 단계 자동 판별 + 외부 페이지 3종 + 노출 항목 체크박스 |
| 신규 라우트 | 외부 페이지 3종 (`/portal/client/:token`·`/portal/student/:token`·`/portal/expert/:token`) — Q2 결정 |
| 신규 테이블/컬럼 | program_share (또는 programs 컬럼 7~8개) — Q1 결정 |
| Stage 분할 | Q5 결정 |

---

## 1. 데이터 모델 (섹션 1)

### 박경수님 명세 정리

**1.1 단계 자동 판별 — 4 날짜**
- 사전 (모집·홍보)
- 준비 (교육 전 안내)
- 진행 (교육 중)
- 결과 (교육 후 보고)

PM이 4 날짜 설정 → 현재 날짜 기준 어느 단계인지 자동 판별

**1.2 노출 항목 매트릭스 (총 13개)**

| 단계 / 대상 | 고객(담당자) | 학생(참여자) | 전문가 |
|---|---|---|---|
| 사전 | 기본정보·커리큘럼·강사정보·교재 | — | 초대수락/거절 (curriculum_staff.token) |
| 준비 | (사전과 동일 4개) | — | — |
| 진행 | — | 출석체크 링크 | 활동일지 |
| 결과 | 만족도 확인·수정요청·의견회신 댓글 | 만족도 응답·결과물 업로드 | 강의확인서 수령 |

> 박경수님 명세에서 고객용 사전·준비는 동일 4개 (기본정보·커리큘럼·강사정보·교재). 즉 **단계×대상 = 12 셀** 중 사용 셀 9개 + 항목 13개

**1.3 외부 토큰 3종**
- `/portal/client/:token` — 고객용 (token = client_token)
- `/portal/student/:token` — 학생용 (token = student_token)
- `/portal/expert/:token` — 전문가용 (token = expert_token)
  - ⚠️ 이미 V2에 `/portal/:token` (STEP 15 ClientPortalPage) 존재 — Q2 충돌 결정 필요

### 데이터 저장 옵션 (Q1)

#### 옵션 A — programs 테이블 컬럼 추가 (단순)
```sql
ALTER TABLE programs
  ADD COLUMN share_pre_date      DATE,
  ADD COLUMN share_ready_date    DATE,
  ADD COLUMN share_progress_date DATE,
  ADD COLUMN share_result_date   DATE,
  ADD COLUMN share_client_token  TEXT UNIQUE,
  ADD COLUMN share_student_token TEXT UNIQUE,
  ADD COLUMN share_expert_token  TEXT UNIQUE,
  ADD COLUMN share_visibility    JSONB;
```
- ✅ 단순. programs 단건 fetch로 모두 조회
- ❌ programs 컬럼 늘어남 (현재 13 컬럼 → 21 컬럼)

#### 옵션 B — 별도 program_share 테이블 (1:1)
```sql
CREATE TABLE program_share (
  program_id          UUID PRIMARY KEY REFERENCES programs(id) ON DELETE CASCADE,
  pre_date            DATE,
  ready_date          DATE,
  progress_date       DATE,
  result_date         DATE,
  client_token        TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  student_token       TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  expert_token        TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  visibility          JSONB NOT NULL DEFAULT '{}',
  created_at          TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at          TIMESTAMPTZ NOT NULL DEFAULT now()
);
```
- ✅ programs 테이블 비대화 방지
- ✅ 토큰 default + UNIQUE 자동
- ✅ 외부 페이지가 토큰만으로 program 조회 가능 (join)
- ❌ join 필요 (단건 조회 시 추가 비용)

**제 추천: 옵션 B** — programs 테이블 분리, V2 portal_templates 패턴과 일관

### `visibility` jsonb 구조

```jsonc
{
  "client":  { "basic_info": true, "curriculum": true, "instructors": true, "materials": false,
               "survey_view": true, "edit_request": true, "feedback_comments": true },
  "student": { "checkin": true, "survey_submit": true, "outcome_upload": false },
  "expert":  { "invite_response": true, "activity_log": true, "lecture_certificate": true }
}
```
- 사용자가 체크박스로 on/off → 그대로 저장
- 항목 키는 코드에 hardcoded enum (Q4)

---

## 2. 단계 자동 판별 로직 (섹션 2)

### 4 날짜의 의미 — Q3
| 옵션 | 동작 |
|---|---|
| **A. 각 단계의 시작일** | 현재 ≥ result → 결과 / ≥ progress → 진행 / ≥ ready → 준비 / ≥ pre → 사전 / 아니면 시작 전 |
| B. 각 단계의 종료일 | 현재 < pre → 사전 / < ready → 준비 / < progress → 진행 / < result → 결과 |
| C. 각 단계의 시작·종료 (8 날짜) | 더 정확하지만 입력 부담 |

**제 추천: 옵션 A** — 4 날짜 입력만 받으면 충분. 단계가 시간순 진행

### 시점 판별 함수
```ts
type ShareStage = 'before' | 'pre' | 'ready' | 'progress' | 'result';

function detectStage(now: string, dates: ShareDates): ShareStage {
  if (dates.result_date && now >= dates.result_date) return 'result';
  if (dates.progress_date && now >= dates.progress_date) return 'progress';
  if (dates.ready_date && now >= dates.ready_date) return 'ready';
  if (dates.pre_date && now >= dates.pre_date) return 'pre';
  return 'before';
}
```

### 외부 페이지에서 단계별 노출
- 외부 페이지가 token으로 program_share + program 조회
- 현재 날짜 기준 단계 판별
- 해당 단계의 visibility 항목만 렌더
- 단계 매트릭스 (Section 1.2) 그대로 적용

---

## 3. 관리자 탭 UI 설계 (섹션 3)

### 화면 구성 (V2 표준)

```
┌──────────────────────────────────────────────────────────────┐
│ 외부공유                                                       │
├──────────────────────────────────────────────────────────────┤
│ 📅 단계 시작일 (PM 직접 설정)                                  │
│   사전: [____]   준비: [____]   진행: [____]   결과: [____]    │
│   현재 단계: [진행] · 진행 시작 D+5                            │
├──────────────────────────────────────────────────────────────┤
│ [고객(담당자)] [학생(참여자)] [전문가]   ← 대상별 탭          │
├──────────────────────────────────────────────────────────────┤
│ 🔗 공유 링크                                                   │
│   /portal/client/abc123…                  [📋 복사] [🔍 QR]   │
│                                                                │
│ ✅ 노출 항목 (체크 시 외부 페이지에 표시)                       │
│   ☑ 기본정보   ☑ 커리큘럼   ☑ 강사정보   ☐ 교재             │
│   ☑ 만족도 확인 (결과 단계)                                   │
│   ☑ 수정요청 버튼 (결과 단계)                                  │
│   ☑ 의견회신 댓글 (결과 단계)                                  │
└──────────────────────────────────────────────────────────────┘
```

### 신규 파일 구성

| 신규 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `pages/programs/detail/share/shareUtils.ts` | ~180 | program_share fetch/save + 단계 판별 + visibility 매트릭스 default |
| `pages/programs/detail/share/StageDateBar.tsx` | ~120 | 4 날짜 picker + 현재 단계 표시 |
| `pages/programs/detail/share/AudienceTab.tsx` | ~210 | 단일 대상 탭 (링크·QR·노출 항목 체크박스) |
| `pages/programs/detail/share/QrPreviewModal.tsx` | ~90 | QR 코드 모달 (qrcode.react 활용) |
| `pages/programs/detail/share/visibilityCatalog.ts` | ~100 | audience × item_id × 단계별 표시 가능 매트릭스 (코드 hardcoded) |
| `pages/programs/detail/ShareTab.tsx` (재작성) | 207 → ~220 | 4 날짜 + 3 대상 탭 합성 |

> 기존 ShareTab의 토큰 링크 모음(신청·모집·출석·폼) 기능은 **다른 탭으로 이동 또는 유지**:
> - 옵션 X: ShareTab 안에 "기타 외부 링크" 섹션으로 보존
> - 옵션 Y: 별도 컴포넌트로 분리 + 다른 탭에서 흡수
>
> **제 추천: X** — ShareTab 하단에 접힘형 "기타 토큰 링크" 섹션으로 보존

---

## 4. 외부 페이지 3종 (섹션 4)

### 라우트 — Q2 결정

| 옵션 | 라우트 | 충돌 |
|---|---|---|
| **A** | `/portal/client/:token` · `/portal/student/:token` · `/portal/expert/:token` | ⚠️ 기존 `/portal/:token` (STEP 15 ClientPortalPage) — react-router는 `/portal/:token`이 `/portal/client/:token`과 충돌 (specificity로 client·student·expert가 먼저 매칭됨, 동작은 OK) |
| **B** | `/share/client/:token` · `/share/student/:token` · `/share/expert/:token` | ❌ 충돌 없음 |
| **C** | 기존 `/portal/:token`을 `/portal/legacy/:token`으로 이동 + 신규는 `/portal/client/:token` 등 | ❌ 큰 변화 — 기존 발급된 링크 깨짐 위험 |

**제 추천: 옵션 B** — `/share/...` prefix. 깔끔하고 충돌 없음. 박경수님 명세는 `/portal/client/:token`이지만 기존 `/portal/:token` 충돌 우려를 명시.

### 외부 페이지 컴포넌트

| 신규 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `pages/share-portal/ClientSharePage.tsx` | ~280 | 고객용 외부 페이지 — token 조회·단계 판별·항목 7개 렌더 |
| `pages/share-portal/StudentSharePage.tsx` | ~200 | 학생용 — 항목 3개 (출석·만족도·결과물) |
| `pages/share-portal/ExpertSharePage.tsx` | ~220 | 전문가용 — 항목 3개 (초대응답·활동일지·강의확인서) |
| `pages/share-portal/items/*.tsx` 13개 | 각 ~80 | 항목별 작은 컴포넌트 (재사용 가능) |
| `App.tsx` (수정) | +6 | 3 라우트 추가 |

> **항목 컴포넌트 13개 분리 대 통합** — Q5 Stage 분할 결정에 따라:
> - 한 번에: 약 1,800줄 / 17 신규 파일
> - 분할: 3-B-1 (관리자 탭) + 3-B-2 (외부 페이지) — 각 1 commit

---

## 5. 박경수님 의사결정 5개 (Q1~Q5)

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| **Q1** | **데이터 저장** — A(programs 컬럼 8개 추가) / B(program_share 별도 테이블) | ✅ **옵션 B** (program_share) — programs 테이블 비대화 방지, V2 패턴 일관 |
| **Q2** | **외부 라우트 prefix** — A(/portal/client/:token, 기존 /portal과 잠재 충돌) / B(/share/client/:token) / C(기존 /portal 이동) | ✅ **옵션 B** (/share/...) — 깔끔하고 충돌 없음 |
| **Q3** | **4 날짜의 의미** — A(단계 시작일) / B(종료일) / C(시작·종료 8개) | ✅ **옵션 A** (시작일) — 입력 부담 적고 단계가 시간순 진행 |
| **Q4** | **노출 항목 default 정책** | ✅ **새 program_share INSERT 시 모두 ON으로 시드** — PM이 필요 없는 항목만 끄는 게 자연스러움 (교재처럼 없을 수 있는 것은 OFF default 검토) |
| **Q5** | **Stage 분할** — 한 번에 / 3-B-1(관리자 탭) + 3-B-2(외부 페이지) | ✅ **분할** — 3-B-1 먼저 (60~80분) → 박경수님 검토 → 3-B-2 (90~120분). 단일 commit 너무 큼 (약 1,800줄). 분할 시 각 단계 화면 검증 가능 |

---

## 6. 작업 순서 (승인 후)

### Stage 3-B-1 — 관리자 탭 UI (60~80분, 1 commit)
1. **Q1 SQL 박경수님 직접 실행** (program_share 테이블)
2. `migrations/20260520_program_share.sql` (보존본)
3. `types/database.ts` — `ProgramShare` + `ShareStage` + `ShareVisibility` 인터페이스
4. `share/visibilityCatalog.ts` — 13 항목 enum + 단계별 매핑
5. `share/shareUtils.ts` — fetch/save + 단계 판별 + default seed
6. `share/StageDateBar.tsx` — 4 날짜 picker + 현재 단계 표시
7. `share/QrPreviewModal.tsx` — QR 모달
8. `share/AudienceTab.tsx` — 대상별 탭 (링크·QR·체크박스)
9. `ShareTab.tsx` 재작성 (4 날짜 + 3 대상 탭 + 기존 토큰 모음 접힘 섹션)
10. tsc -b → 검증 → 보고서 → commit/push

### Stage 3-B-2 — 외부 페이지 3종 (90~120분, 1 commit)
1. `share-portal/items/*.tsx` 13 항목 컴포넌트
2. `share-portal/ClientSharePage.tsx`·`StudentSharePage.tsx`·`ExpertSharePage.tsx`
3. `App.tsx` — 3 외부 라우트 추가
4. tsc -b → 검증 → 보고서 → commit/push

**롤백**: 각 commit 별도 revert 가능. SQL revert만 별도 (`drop table program_share`).

---

## 7. V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | Stage 3-B-1 최대 ~220 / Stage 3-B-2 최대 ~280 (ClientSharePage) | ✅ |
| V-2 catch + 한글 | `console.error('[program-share] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown | nested join 없음 (단순 fetch) + `ShareVisibility` 타입 명시 | ✅ |
| V-4 한글 메시지 | 모두 한글 | ✅ |
| V-5 cancelled 가드 | 모든 useEffect 비동기 fetch | ✅ |
| V-6 직접 fetch | 각 컴포넌트 자체 fetch | ✅ |
| V-7 디자인 토큰 | violet/orange/cyan 톤 | ✅ |

---

## 8. 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q5 결정 → 그 후 코드 진입

**Q1 (옵션 B program_share 테이블) 진행 시 SQL**:
```sql
CREATE TABLE public.program_share (
  program_id     UUID PRIMARY KEY REFERENCES public.programs(id) ON DELETE CASCADE,
  pre_date       DATE,
  ready_date     DATE,
  progress_date  DATE,
  result_date    DATE,
  client_token   TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  student_token  TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  expert_token   TEXT UNIQUE NOT NULL DEFAULT encode(gen_random_bytes(16),'hex'),
  visibility     JSONB NOT NULL DEFAULT '{}'::jsonb,
  created_at     TIMESTAMPTZ NOT NULL DEFAULT now(),
  updated_at     TIMESTAMPTZ NOT NULL DEFAULT now()
);

CREATE INDEX idx_program_share_client_token  ON public.program_share(client_token);
CREATE INDEX idx_program_share_student_token ON public.program_share(student_token);
CREATE INDEX idx_program_share_expert_token  ON public.program_share(expert_token);

ALTER TABLE public.program_share ENABLE ROW LEVEL SECURITY;

-- 외부 페이지 (인증 X, 토큰만으로 SELECT 가능)
CREATE POLICY "public_read_by_token" ON public.program_share
  FOR SELECT USING (true);

-- 관리자 (인증) 전체 권한
CREATE POLICY "auth_all" ON public.program_share
  FOR ALL TO authenticated USING (true) WITH CHECK (true);
```

박경수님이 직접 실행하시고 결과 알려주시면 Stage 3-B-1 코드 진입할게요.
