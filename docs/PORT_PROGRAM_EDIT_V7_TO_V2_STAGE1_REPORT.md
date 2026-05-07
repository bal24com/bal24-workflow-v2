# Stage 1 이식 결과 보고 — 프로그램 수정 풀 페이지 + 커리큘럼

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_PROGRAM_EDIT_V7_TO_V2.md](./PORT_PROGRAM_EDIT_V7_TO_V2.md)
> 박경수님 결정: Q1 SQL 실행 완료 / Q2~Q5 모두 추천대로
> 범위: **Stage 1만 (수정 풀 페이지 + 커리큘럼 ⑥카드)**. Stage 2(결과보고서 빌더)·Stage 3(외부 참여의사 페이지)는 검토 후 진입.

---

## V7 → V2 매핑 요약

| 항목 | V7 (NewEducationV9) | V2 (이식 결과) |
|---|---|---|
| 형태 | 풀 페이지 1,516줄 1파일 9 카드 | 풀 페이지 + 8 카드 (⑦ 교안 제외) + 커리큘럼 자체 CRUD (총 14 신규 파일) |
| 라우트 | `/v9/educations/:id/edit` | `/programs/:id/edit` |
| 컬럼 | LS `Education.title/notice/...` | `programs.notice` / `notice_files` / `goal_text` 신규 (Q1 ALTER) |
| 차시 | LS `Education.curriculum[]` | `program_curriculum` 테이블 (자체 CRUD) |
| 인력 매칭 | LS 없음 (V7엔 강사 단일 필드) | `curriculum_staff` 테이블 + 외부 토큰 자동 발급 |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것 (V7 9 카드 → V2 8 카드)
| V7 카드 | V2 처리 |
|---|---|
| ① 교육 개요 | OverviewCard (name·type·project·description) |
| ② 시간·공개 설정 | ScheduleCard (start/end/status/venue/capacity) |
| ③ 공지사항 + ③-1 첨부 | NoticeCard (notice + notice_files JSONB) |
| ④ 성과 목표 | GoalCard (goal_text) |
| ⑤ 결과물 외부 링크 | OutcomeLinkCard (안내 + /forms 점프) |
| ⑥ 커리큘럼 + 강사 매칭 | **CurriculumCard** (program_curriculum 자체 CRUD + StaffMatchModal·StaffMatchRow) |
| ⑦ 교안 | ❌ 별도 STEP (1단계 제외) |
| ⑧ 만족도 조사 | SurveyLinkCard (안내 + /forms 점프) |
| ⑨ 분류·개인정보 | ClassificationCard (정적 안내) |

### 버린 것
- ❌ ⑦ 교안 카드 — 별도 STEP (program_files 테이블 부재)
- ❌ AI 추출 (V7 ⑥ 커리큘럼 AI 생성) — STEP-AI-PREP 후 (Q4)
- ❌ V7 자체 v9-card·다크모드·강한 그라데이션
- ❌ 신규 등록 풀 페이지 — 모달 유지 (Q2)

### 새로 작성한 것 (V2 표준)
- 카드 셸 컴포넌트 `CardShell.tsx` + `Field`·`inputClass`·`textareaClass` export
- 커리큘럼 자체 CRUD — useCallback `refresh()` + insert/update/delete + 매칭 인력 join fetch
- 매칭 모달 외부/내부 탭 전환 + 검색 + 역할·금액·메모 입력
- 매칭 로우 — 토큰 복사·새탭·삭제 + 상태 배지
- 토큰 자동 생성: DB default `encode(gen_random_bytes(16),'hex')` (Q3)
- 헤더에 [수정] 버튼 + `/programs/:id` → `/programs/:id/edit` 이동

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `src/App.tsx` (수정) | +2 | `/programs/:id/edit` Route + import |
| `src/types/database.ts` (수정) | +59 | `ProgramFile`·`Program.notice/notice_files/goal_text`·`ProgramCurriculum`·`CurriculumStaff`·`CurriculumStaffRole`·`CurriculumStaffStatus`·`ReportSection`·`ReportSectionType` |
| `src/lib/curriculumStaff.ts` (신규) | 43 | 라벨·스타일·토큰 URL 빌더 |
| `src/pages/programs/ProgramDetailPage.tsx` (수정) | +12 | 헤더 [수정] 버튼 |
| `src/pages/programs/edit/ProgramEditPage.tsx` (신규) | 162 | 메인 컨테이너 + 저장 |
| `src/pages/programs/edit/programEditUtils.ts` (신규) | 118 | 폼 타입·load·save·검증·project options |
| `src/pages/programs/edit/cards/CardShell.tsx` (신규) | 54 | 공용 카드 셸 + Field |
| `src/pages/programs/edit/cards/OverviewCard.tsx` (신규) | 87 | ① 교육 개요 |
| `src/pages/programs/edit/cards/ScheduleCard.tsx` (신규) | 78 | ② 시간·공개 |
| `src/pages/programs/edit/cards/NoticeCard.tsx` (신규) | 103 | ③ 공지 + 첨부 |
| `src/pages/programs/edit/cards/GoalCard.tsx` (신규) | 29 | ④ 성과 목표 |
| `src/pages/programs/edit/cards/OutcomeLinkCard.tsx` (신규) | 43 | ⑤ 결과물 안내 |
| `src/pages/programs/edit/cards/CurriculumCard.tsx` (신규) | 317 | ⑥ 커리큘럼 자체 CRUD |
| `src/pages/programs/edit/cards/SurveyLinkCard.tsx` (신규) | 33 | ⑧ 만족도 안내 |
| `src/pages/programs/edit/cards/ClassificationCard.tsx` (신규) | 25 | ⑨ 분류·개인정보 |
| `src/pages/programs/edit/curriculum/StaffMatchModal.tsx` (신규) | 284 | 외부/내부 탭 매칭 모달 |
| `src/pages/programs/edit/curriculum/StaffMatchRow.tsx` (신규) | 82 | 매칭 인력 한 줄 |
| `supabase/migrations/20260517_program_edit_curriculum_staff.sql` (신규) | 91 | 마이그레이션 보존본 (program_curriculum + curriculum_staff + report_sections + programs 컬럼 3개) |

**합계 신규 코드**: ~1,560줄 (15 파일) + types 59 + 마이그레이션 91 / 모두 < 400줄

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (이식 영역 최대 **317줄** = `CurriculumCard.tsx` / 신규 평균 ~104줄)
- [x] **V-2** catch/error 모두 `console.error('[program-edit] ...', err)` / `[curriculum-match] ...` + `toast.error(...)` 한글
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. Supabase nested join은 `StaffJoinRow` 명시 타입
- [x] **V-4** 사용자 노출 메시지 전부 한글 (라벨·플레이스홀더·에러·확인창·9 카드 안내문 모두)
- [x] **V-5** useEffect 비동기 fetch 4곳 모두 `cancelled` 가드 (ProgramEditPage·OverviewCard·StaffMatchModal·CurriculumCard)
- [x] **V-6** Supabase 직접 fetch — 카드별 자체 fetch (CurriculumCard·StaffMatchModal). 단순 폼 필드는 controlled (`value`+`onChange` 1-depth). props drilling 없음
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤만. 임의 HEX 0건. 카드 클래스 `rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.06)]` 일관

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 2.07s** (production 번들 정상)
- preview dev server: ✅ vite v8.0.10 ready (포트 5176 자동 fallback)
- 화면 검증 (`/programs/:id/edit`): ⚠️ 인증 + 프로그램 데이터 필요. 박경수님 로그인 후 직접 확인

---

## 짚어둘 점

### 1. Q1 SQL 박경수님 직접 실행 완료
- `programs.notice`·`notice_files`·`goal_text` 컬럼
- `program_curriculum` 테이블
- `curriculum_staff` 테이블 (CHECK 제약 + 외부 read/update RLS)
- `report_sections` 테이블 (Stage 2에서 사용)
- 보존본: `supabase/migrations/20260517_program_edit_curriculum_staff.sql`

### 2. 토큰 발급 (Q3 결정대로)
- `curriculum_staff.token` — DB default `encode(gen_random_bytes(16),'hex')`로 INSERT 시 자동 부여. 클라이언트는 토큰 생성 코드 없음
- 외부 참여의사 URL: `${origin}/curriculum-invite/${token}` — Stage 3에서 페이지 신설 예정

### 3. CurriculumCard 작동 흐름
- 진입 시 program_curriculum + curriculum_staff(+ join) 한 번에 fetch
- 차시 추가/수정/삭제 → DB 직접 호출 → `refresh()`로 재조회 (1차 단순 패턴)
- 매칭 추가 → StaffMatchModal에서 INSERT → `onAdded()` → `refresh()`

### 4. 후속 작업 (Stage 2/3 대기)
- **Stage 2** — 결과보고서 빌더 6번째 탭: `report_sections` 테이블 활용. UI는 체크박스·드래그·AI placeholder
- **Stage 3** — `/curriculum-invite/:token` 외부 페이지: V2 InstructorInvitePage 패턴 차용

### 5. 1단계 미포함 (의도)
- ⑦ 교안 카드 (program_files 테이블 부재)
- 신규 등록 풀 페이지 (Q2 — 신규는 모달 유지)
- AI 추출·AI 다음 행동 (Q4 — STEP-AI-PREP 후)
- 첨부 파일 드래그·업로드 UI (1단계는 URL 입력만 — 후속 STEP에서 Storage 통합)

### 6. 라우트·App.tsx 영향
- `/programs/:id/edit` Route 신규 추가. 기존 라우트 영향 없음.

### 7. 롤백 가능성
- 단일 commit이므로 `git revert <hash>` 한 줄로 즉시 되돌리기 가능
- 단, 박경수님이 실행한 ALTER TABLE + CREATE TABLE은 SQL revert 별도 필요 (코드만 revert해도 컬럼·테이블은 잔존, 정상 동작)

---

## 다음 액션

1. ✅ **Stage 1 화면 검증** — Netlify 배포 후 박경수님이 `/programs/<프로그램ID>/edit` 접속해 8 카드 + 커리큘럼 매칭 동작 확인
2. ✅ **Stage 2 진입 결정** — 결과보고서 빌더 6번째 탭
3. ✅ **Stage 3 진입 결정** — `/curriculum-invite/:token` 외부 참여의사 페이지
