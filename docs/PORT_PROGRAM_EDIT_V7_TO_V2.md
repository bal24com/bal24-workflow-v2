# V7 → V2 이식 사전 확인 문서 — 프로그램 수정 풀 페이지 + 커리큘럼 + 결과보고서 빌더 + 외부 참여의사

> 작성일: 2026-05-08
> 진행 합의: **2단계 사전 확인 → 코드 진입은 승인 후**
> 신규 테이블: 박경수님 Supabase Dashboard에서 **이미 생성 완료**
> 다음 단계: **Q1~Q5 결정 + 승인 → 코드 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| V7 참고 파일 | `EducationDetailV9.tsx` (2,441줄, 17 카드) + `NewEducationV9.tsx` (1,516줄, 9 카드) |
| 이식 범위 | 4 영역 — ① 수정 풀 페이지 / ② 커리큘럼 ⑥카드 / ③ 결과보고서 빌더 6번째 탭 / ④ 외부 참여의사 페이지 |
| V2 신규 라우트 | `/programs/:id/edit` (인증) + `/curriculum-invite/:token` (외부) |
| 관련 신규 테이블 | `program_curriculum`·`curriculum_staff`·`report_sections` (Supabase 생성 완료) |

---

## 섹션 1 — 수정 풀 페이지 (`/programs/:id/edit`)

### 현황 파악

| 항목 | V7 (NewEducationV9) | V2 (현재) | 격차 |
|---|---|---|---|
| 형태 | 풀 페이지 (1,516줄, 9 카드) | `ProgramFormModal` 263줄 (9 필드 모달) | **풀 페이지 신설 필요** |
| 라우트 | `/v9/educations/:id/edit` | (없음) | `/programs/:id/edit` 신규 |
| 신규 등록도 풀 페이지? | ✅ | ❌ (모달) | 추천: **신규는 모달 유지, 수정만 풀** |

### V7 9 카드 ↔ V2 schema 매핑

| V7 카드 | V2 매핑 | 추가 필드 필요? |
|---|---|---|
| ① 교육 개요 | `programs.name`·`type`·`project_id`·`description` | ❌ (V2 ✅) |
| ② 시간·공개 설정 | `programs.start_date`·`end_date`·`status`·`venue`·`capacity` | ❌ |
| ③ 공지사항 (집합장소·시간·준비물 등) | (없음) | ⚠️ **`notice` 컬럼 필요** |
| ③-1 공지 첨부 | (없음) | ⚠️ **`notice_files jsonb` 컬럼 필요** |
| ④ 성과 목표 | (없음) | ⚠️ **`goal_text` 컬럼 필요** |
| ⑤ 결과물 (외부 업로드 링크) | `public_forms` (form_type='application') | ❌ (안내 + 폼 메뉴 점프) |
| ⑥ 커리큘럼 | `program_curriculum` + `curriculum_staff` (신규 ✅) | 섹션 2 참조 |
| ⑦ 교안 (강사→교육생 자료) | (없음) | ⚠️ **별도 STEP** (1단계 미포함) |
| ⑧ 만족도 조사 문항 | `public_forms` (form_type='survey') 활용 | ❌ (안내 + 폼 메뉴 점프) |
| ⑨ 분류·개인정보 안내 | (없음) | 정적 텍스트 표시 (DB 저장 X) |

### 추가 SQL 필요 (Q1 결정 항목)

```sql
-- 옵션 A: programs 테이블에 컬럼 3개 추가 (추천)
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS notice TEXT,
  ADD COLUMN IF NOT EXISTS notice_files JSONB,
  ADD COLUMN IF NOT EXISTS goal_text TEXT;
```

### V2 표준으로 새로 쓸 것

| 신규 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `pages/programs/edit/ProgramEditPage.tsx` (신규) | ~210 | 메인 컨테이너 + 저장 + 라우팅 |
| `pages/programs/edit/cards/OverviewCard.tsx` (① 교육 개요) | ~140 | name·type·project·description |
| `pages/programs/edit/cards/ScheduleCard.tsx` (② 시간·공개) | ~150 | start/end/status/venue/capacity |
| `pages/programs/edit/cards/NoticeCard.tsx` (③ 공지) | ~160 | notice text + 파일 첨부 |
| `pages/programs/edit/cards/GoalCard.tsx` (④ 성과 목표) | ~80 | goal_text |
| `pages/programs/edit/cards/OutcomeLinkCard.tsx` (⑤ 결과물 안내) | ~80 | /forms 메뉴 점프 안내 |
| `pages/programs/edit/cards/CurriculumCard.tsx` (⑥) | 섹션 2 참조 | ~280 |
| `pages/programs/edit/cards/SurveyLinkCard.tsx` (⑧ 만족도 안내) | ~80 | /forms 점프 안내 |
| `pages/programs/edit/cards/ClassificationCard.tsx` (⑨) | ~70 | 정적 안내 |
| `pages/programs/edit/programEditUtils.ts` | ~150 | save / load / 검증 |

**모든 파일 < 400줄. V-1 통과.**
**V7 ⑦ 교안 카드는 1단계 제외** (별도 STEP).

---

## 섹션 2 — 커리큘럼 ⑥카드 (`program_curriculum` + `curriculum_staff`)

### 신규 테이블 (Supabase 생성 완료, V2 인터페이스 신규 추가)

```ts
// types/database.ts 추가 예정
export interface ProgramCurriculum {
  id: string;
  program_id: string;
  session_no: number;
  title: string;
  content: string | null;
  session_date: string | null;     // YYYY-MM-DD
  duration: number | null;          // 분 단위
  venue: string | null;
  created_at: string;
}

export type CurriculumStaffRole = '강사' | 'FT' | '멘토' | 'TA' | '운영진';
export type CurriculumStaffStatus = 'pending' | 'accepted' | 'rejected';

export interface CurriculumStaff {
  id: string;
  curriculum_id: string;
  staff_pool_id: string | null;     // 외부 전문가 (정산 연동)
  profile_id: string | null;        // 내부 직원 (급여 별도)
  role: CurriculumStaffRole;
  fee: number | null;
  note: string | null;
  token: string;                    // 외부 참여의사 페이지 접근용
  status: CurriculumStaffStatus;
  responded_at: string | null;
  created_at: string;
}
// CONSTRAINT: staff_pool_id와 profile_id 중 하나만 값 존재 (CHECK 제약)
```

### 매칭 UX (박경수님 명세 그대로)

```
┌─────────────────────────────────────────────────────────┐
│ ⑥ 커리큘럼 — 차시별 일정 + 인력 매칭            [+ 차시] │
├─────────────────────────────────────────────────────────┤
│ ┌─ 1차시 ─────────────────────────────────────────────┐ │
│ │ 회차: 1  날짜: [____]  시간: [__]분  장소: [____]   │ │
│ │ 제목: [_______________________________]            │ │
│ │ 내용: [_______________________________]            │ │
│ │                                                     │ │
│ │ 매칭 인력 (3)                                       │ │
│ │ ─ 김강사 (외부) · 강사 · 1,500,000원 [pending] [✕] │ │
│ │ ─ 박운영 (내부) · 운영진 · -            [pending] │ │
│ │ ─ 이TA (외부) · TA · 800,000원       [accepted] │ │
│ │                                                     │ │
│ │ [+ 인력 추가]                                       │ │
│ └─────────────────────────────────────────────────────┘ │
│ ┌─ 2차시 ─────────────────────────────────────────────┐ │
│ │ ...                                                 │ │
└─────────────────────────────────────────────────────────┘

[+ 인력 추가] 클릭 시 모달:
┌──────────────────────────────────────┐
│ [외부 전문가] [내부 직원]  ← 탭 전환  │
├──────────────────────────────────────┤
│ 검색: [____________________________] │
│                                      │
│ ○ 김강사   특기: 마케팅·브랜딩         │
│ ○ 박전문   특기: 데이터 분석           │
│ ...                                  │
│                                      │
│ 역할: [강사 ▾]                       │
│ 금액: [_________________ 원]         │
│ 메모: [____________________________] │
│                                      │
│            [취소] [추가]             │
└──────────────────────────────────────┘

→ 추가 시 token 자동 생성 (백엔드 default 또는 클라 nanoid)
→ "참여의사 링크 발송" 버튼 노출 (섹션 4 참조)
```

### V2 표준으로 새로 쓸 것

| 신규 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `pages/programs/edit/cards/CurriculumCard.tsx` | ~280 | 차시 목록 + 추가/수정/삭제 |
| `pages/programs/edit/curriculum/StaffMatchModal.tsx` | ~260 | 외부/내부 탭 전환 + 검색 + 추가 |
| `pages/programs/edit/curriculum/StaffMatchRow.tsx` | ~110 | 매칭된 인력 한 줄 (token 발송 버튼 포함) |
| `lib/curriculumStaff.ts` | ~80 | token 생성·status 라벨·검증 |

**Q3 결정 사항**: token은 클라이언트 nanoid? 또는 Supabase default `encode(gen_random_bytes(16),'hex')` ? 추천: **DB default** (다른 외부 토큰들과 일관)

---

## 섹션 3 — 결과보고서 빌더 (프로그램 상세 6번째 탭)

### 신규 테이블 (Supabase 생성 완료)

```ts
// types/database.ts 추가 예정
export type ReportSectionType = 'auto' | 'custom';

export interface ReportSection {
  id: string;
  program_id: string;
  section_key: string;       // 'overview' | 'participants' | 'attendance' | ... | custom_*
  title: string;
  content: string | null;    // markdown
  is_visible: boolean;
  sort_order: number;
  section_type: ReportSectionType;
  created_at: string;
  updated_at: string;
}
```

### 8 자동집계 섹션 (section_type='auto')

| section_key | title | 자동집계 출처 |
|---|---|---|
| `overview` | 사업개요 | `programs` 단건 (name·type·기간·장소·정원·description·goal_text) |
| `participants` | 참여인원 | `participant_applications` 카운트 (status별) |
| `attendance` | 출석현황 | `attendance_sessions` + `attendance_records` (세션별 출석률) |
| `curriculum` | 커리큘럼 | `program_curriculum` + `curriculum_staff` (차시·강사 통합) |
| `staff` | 강사현황 | `instructor_invitations` + `curriculum_staff` (역할별 집계) |
| `survey` | 만족도 | `surveys` 평균 + `public_forms` (form_type='survey') 응답 |
| `budget` | 예산집행 | `income`(이 프로그램의 project_id) + `expenses`(이 프로그램의 project_id) |
| `outcomes` | 결과물 | `form_applications`(form_type='application' 결과 업로드) |

### UX (박경수님 명세 그대로)

```
┌──────────────────────────────────────────────────────────┐
│ 📊 결과보고서                                              │
│   [전체 AI 초안]  [PDF 내보내기]                          │
├──────────────────────────────────────────────────────────┤
│ ☑ ≡ 1. 사업개요                                  [🤖 AI] │
│   기간: ____ ~ ____                                       │
│   장소: __________                                        │
│   대상: __________                                        │
│   ── (AI 결과 인라인) ──────────────────────────────────  │
│   "이 사업은 ..."                          [적용] [닫기]  │
├──────────────────────────────────────────────────────────┤
│ ☑ ≡ 2. 참여인원                                 [🤖 AI] │
│   신청 32명 · 승인 28명 · 완료 26명                       │
├──────────────────────────────────────────────────────────┤
│ ☑ ≡ 3. 출석현황                                 [🤖 AI] │
│   ...                                                     │
├──────────────────────────────────────────────────────────┤
│ ☐ ≡ 4. 커리큘럼  (숨김 처리됨, 회색)            [🤖 AI] │
├──────────────────────────────────────────────────────────┤
│ ...                                                       │
├──────────────────────────────────────────────────────────┤
│ [+ 항목 추가] → 제목 직접 입력 (custom 섹션)              │
└──────────────────────────────────────────────────────────┘
```

- **체크박스 ☑/☐**: `is_visible` 토글
- **드래그 ≡**: `sort_order` 변경 (HTML5 native draggable / 라이브러리 추가 X)
- **🤖 AI 버튼**: 비활성 placeholder (Q4 결정)
- **[적용] 버튼**: AI 결과를 `content`에 저장
- **[+ 항목 추가]**: 제목 입력 모달 → custom 섹션 신규 INSERT
- **자동집계 섹션**: 진입 시 SQL 집계해서 `content` 자동 생성·업데이트 (1단계엔 단순 텍스트 요약)

### V2 표준으로 새로 쓸 것

| 신규 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `pages/programs/detail/ReportBuilderTab.tsx` | ~250 | 메인 + 섹션 목록 + 액션 버튼 |
| `pages/programs/detail/report/ReportSectionCard.tsx` | ~180 | 단일 섹션 카드 (체크박스·드래그·AI 버튼) |
| `pages/programs/detail/report/CustomSectionAddModal.tsx` | ~100 | 제목 입력 모달 |
| `pages/programs/detail/report/reportAggregator.ts` | ~280 | 8 자동집계 SQL + 텍스트 변환 |

**탭 추가**: ProgramDetailPage.tsx 수정 — 5탭 → 6탭 (`결과보고서` 추가).

---

## 섹션 4 — 외부 참여의사 페이지 (`/curriculum-invite/:token`)

### 참고: V2 기존 외부 강사초대 페이지

[InstructorInvitePage.tsx](src/pages/instructor-portal/InstructorInvitePage.tsx) 280줄 — `instructor_invitations.portal_token` 검증 + 수락/거절 + 첨부 파일.

### 신규 페이지 동작

```
1. /curriculum-invite/:token 진입
2. supabase.from('curriculum_staff').select('*, curriculum:program_curriculum(*, program:programs(*))').eq('token', token).maybeSingle()
3. status === 'pending' 이면 수락/거절 버튼 활성
   status !== 'pending' 이면 결과 표시 + "이미 응답했어요"
4. 수락 → status='accepted', responded_at=now()
5. 거절 → status='rejected', responded_at=now() + 사유 입력 옵션
```

### 표시 정보 (강사초대와 동일 디자인)

- 프로그램명·기간·장소
- 차시 정보 (몇 차시·언제·어디서·몇 분)
- 매칭된 역할 (강사·FT·멘토·TA·운영진)
- 지급 금액 (있으면)
- 메모 (있으면)
- 참여 여부 버튼 [수락] [거절]

### V2 표준으로 새로 쓸 것

| 신규 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `pages/curriculum-invite/CurriculumInvitePage.tsx` | ~260 | 외부 페이지 메인 (V2 강사초대 패턴 차용) |
| `App.tsx` (수정) | +2 | `/curriculum-invite/:token` Route 추가 |

---

## 통합 영향 범위

### 파일 추가/수정 합계

| 영역 | 신규 | 수정 | 합계 줄 수 추정 |
|---|---|---|---|
| 섹션 1 (수정 풀 페이지) | 11 파일 | 1 파일 (App.tsx) | ~1,400 |
| 섹션 2 (커리큘럼) | 4 파일 | (섹션 1 안에 포함) | ~730 |
| 섹션 3 (결과보고서 빌더) | 4 파일 | 1 파일 (ProgramDetailPage 6탭) | ~810 |
| 섹션 4 (외부 참여의사) | 1 파일 | 1 파일 (App.tsx) | ~260 |
| **합계** | **20 파일** | **3 파일** | **~3,200줄** |

> ⚠️ 모두 < 400줄/파일 (V-1 통과). 단일 commit으로 관리하면 너무 큼 → **3 commit으로 분리** 권장 (Q5 참조).

### types/database.ts 추가 항목
- `ProgramCurriculum`
- `CurriculumStaff` + `CurriculumStaffRole` + `CurriculumStaffStatus`
- `ReportSection` + `ReportSectionType`

### Supabase 마이그레이션 보존본 (이미 박경수님 실행)
- `supabase/migrations/20260517_program_curriculum_staff_report.sql` — 박경수님 이미 실행한 SQL 사후 보존
- `programs.notice / notice_files / goal_text` 추가 SQL이 Q1로 결정되면 같은 파일 또는 별도 파일로 추가

---

## V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | 최대 ~280 (CurriculumCard·reportAggregator) | ✅ |
| V-2 catch + 한글 | `console.error('[program-edit] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown 미사용 | Supabase nested join은 inline anonymous type | ✅ |
| V-4 한글 메시지 | 모두 한글 | ✅ |
| V-5 cancelled 가드 | 모든 useEffect 비동기 fetch에 적용 | ✅ |
| V-6 직접 fetch | 각 카드/섹션이 자체 fetch (props는 programId·sectionId 등 메타) | ✅ |
| V-7 디자인 토큰 | violet/orange/cyan/emerald/rose 5톤 | ✅ |

---

## 박경수님 의사결정 5개 (Q1~Q5)

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| **Q1** | **`programs` 테이블에 `notice` / `notice_files` / `goal_text` 컬럼 추가?** (V7 ③④ 카드용) | ✅ **추가** (옵션 A). 박경수님이 ALTER TABLE 직접 실행 후 알려주시면 코드 진입. 안 추가하면 ③④ 카드는 description 통합 또는 제외 |
| **Q2** | **신규 등록도 풀 페이지로 승격?** | ❌ **신규는 모달 유지, 수정만 풀 페이지** — 홈/프로젝트 상세 패턴과 일관. 신규는 "기본정보만 빠르게" → 풀 페이지에서 보강 |
| **Q3** | **`curriculum_staff.token` 발급 방식** | ✅ **DB default** (`encode(gen_random_bytes(16),'hex')`) — 다른 외부 토큰과 일관. INSERT 시 자동 부여 |
| **Q4** | **🤖 AI 버튼 + [전체 AI 초안] 버튼** | ❌ **비활성 placeholder** — 클릭 시 "STEP-AI-PREP 완료 후 활성화 예정" 안내 toast. UI 흐름은 보존 |
| **Q5** | **commit 분리 단위** | **3 commit 권장**: ① 수정 풀 페이지 + 커리큘럼 (섹션 1+2) / ② 결과보고서 빌더 (섹션 3) / ③ 외부 참여의사 (섹션 4) — 각 단계 끝나면 박경수님이 검토하고 다음 진입 결정. 롤백 단위도 깔끔 |

---

## 작업 순서 (승인 후)

### Stage 1 — 수정 풀 페이지 + 커리큘럼 (섹션 1+2)
1. `types/database.ts` — `ProgramCurriculum` + `CurriculumStaff` 인터페이스 추가
2. `supabase/migrations/20260517_*.sql` — 보존본 (박경수님 실행 SQL)
3. Q1 OK이면 `programs.notice / notice_files / goal_text` 컬럼 추가 SQL 보존
4. `App.tsx` — `/programs/:id/edit` Route 추가
5. `pages/programs/edit/ProgramEditPage.tsx` 신규
6. `pages/programs/edit/cards/*` 8개 카드 컴포넌트
7. `pages/programs/edit/curriculum/*` 매칭 모달·로우
8. `ProgramDetailPage.tsx` 헤더에 [수정] 버튼
9. `tsc -b` → 검증 → commit

### Stage 2 — 결과보고서 빌더 (섹션 3)
1. `types/database.ts` — `ReportSection` 인터페이스 추가
2. `pages/programs/detail/ReportBuilderTab.tsx` 신규
3. `report/*` 섹션 컴포넌트 + 모달 + 집계 유틸
4. `ProgramDetailPage.tsx` — 6번째 탭 추가
5. `tsc -b` → 검증 → commit

### Stage 3 — 외부 참여의사 페이지 (섹션 4)
1. `App.tsx` — `/curriculum-invite/:token` Route 추가
2. `pages/curriculum-invite/CurriculumInvitePage.tsx` 신규
3. `tsc -b` → 검증 → commit

**예상 작업 시간**: 총 3~4시간 (Stage별 60~90분)
**롤백 안전성**: 각 Stage가 독립 commit. 어느 단계든 `git revert <hash>` 가능

---

## 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q5 결정 → 그 후 코드 진입

**Q1 (notice/goal 컬럼) 추가 진행 시 SQL**:
```sql
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS notice       TEXT,
  ADD COLUMN IF NOT EXISTS notice_files JSONB,
  ADD COLUMN IF NOT EXISTS goal_text    TEXT;
```
박경수님이 직접 Supabase Dashboard에서 실행해 주시고 결과 알려주시면 코드 진입할게요.
