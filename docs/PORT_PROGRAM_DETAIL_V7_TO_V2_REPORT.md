# 이식 결과 보고 — 프로그램 상세 (1단계) V7 → V2

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_PROGRAM_DETAIL_V7_TO_V2.md](./PORT_PROGRAM_DETAIL_V7_TO_V2.md)
> 박경수님 결정:
> - **Q1: ② program_id 컬럼 추가** (curriculum + surveys)
> - Q2: program_curriculum 미사용 (Q1로 자동 해결)
> - Q3·Q4·Q5: 추천대로 (제외 / 사이드바 유지 / AI 제외)

---

## V7 → V2 매핑 요약

| 항목 | V7 (원본) | V2 (이식 결과) |
|---|---|---|
| 파일 | `EducationDetailV9.tsx` 2,441줄 1파일, 17 카드 | 신규 9 파일 + 수정 3 파일, 5 탭 (V-1 < 400 모두 준수) |
| 단일 엔티티 | `Education` (LS) | `programs` (Supabase) |
| 자식 테이블 매핑 | `Curriculum`/`Survey`/`Students` 등 (LS) | `curriculum.program_id` ✅·`surveys.program_id` ✅ (신규 컬럼)·`participant_applications.program_id`·`recruit_forms.program_id`·`attendance_sessions.program_id`·`activity_logs.program_id`·`public_forms.program_id`·`instructor_invitations.program_id` |
| 17 카드 | 한 화면 통합 | 5 탭 임베드 + 사이드바 메뉴 점프 (Q4 결정) |
| AI 추천·브리핑 | callClaude | 정적 안내 / STEP-AI-PREP 후 동적화 (Q5) |
| 단계 | 영업·제안·계약·실행·정산·종료 6단계 | 프로그램 status: 준비·진행·완료·취소 (V2 표준 유지) |
| 카드 클래스 | `v9-card`·다크모드·강한 그라데이션 | `rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.06)]` 5 톤 |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것 (V7 로직·UI 패턴)
- 5 탭 구성: 개요 / 강사·교육생 / 출석·일지 / 결과·만족도 / 외부 공유
- 통계 KPI 4종: 신청·출석 세션·활동 일지·만족도 평균 평점
- 강사 초빙·교육생 신청·모집 공고 통합 표시
- 출석 세션·활동 일지 임베드
- 외부 폼 (설문·피드백) + 만족도 응답 평균 집계
- 외부 공개 링크 모음 (신청 / 모집 / 출석 / 폼) + 복사·새탭

### 버린 것 (V2 부적합 또는 별도 STEP)
- ❌ `localStorage` 인프라 전부 (V2 절대 규칙)
- ❌ `program_curriculum` 테이블 (Q2 자동 해결 — `Curriculum.program_id` 사용)
- ❌ AI callClaude 호출 (Q5 — 정적 안내, STEP-AI-PREP 후 동적화)
- ❌ 단계 클릭 즉시 변경 — 프로그램은 status 4종, ProgramFormModal에서만 수정
- ❌ 사이드바 메뉴 흡수 (Q4 — 임베드 + 점프 방식)
- ❌ 헤더 QR 발행 버튼 (Q3 — 3단계로 미루기. 1단계는 외부 공유 탭에 발행된 토큰 모음)
- ❌ 멘토링 / 프로그램 분류 / 교안 / 단계별 자료 폴더 (별도 STEP)
- ❌ 다크모드·자체 v9-card·강한 그라데이션

### 새로 작성한 것 (V2 표준)
- `programDetailUtils.ts` — 8 fetch 함수 + 4 라벨 함수 + 통계 집계
- `ProgramDetailPage.tsx` — 5 탭 라우팅 + 헤더 (유형·상태·기간·정원·프로젝트 링크)
- 5 탭 컴포넌트 각각 자체 fetch (props는 `programId`만)
- `App.tsx` — `/programs/:id` Route 추가
- `ProgramsPage.tsx` — 카드/리스트 → 상세 이동 Link 감싸기
- `types/database.ts` — `Curriculum.program_id`, `Survey.program_id` 추가
- `supabase/migrations/20260516_curriculum_survey_program_id.sql` — 마이그레이션 보존본

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `src/App.tsx` (수정) | +2 | `/programs/:id` Route + import |
| `src/types/database.ts` (수정) | +4 | `Curriculum.program_id` + `Survey.program_id` |
| `src/pages/programs/ProgramsPage.tsx` (수정) | 358 | 카드/리스트 → 상세 Link |
| `src/pages/programs/ProgramDetailPage.tsx` (신규) | 206 | 5 탭 라우팅 메인 |
| `src/pages/programs/detail/programDetailUtils.ts` (신규) | 355 | 8 fetch + 라벨 + 통계 집계 |
| `src/pages/programs/detail/OverviewTab.tsx` (신규) | 216 | 설명·KPI·커리큘럼·빠른 액션 |
| `src/pages/programs/detail/StaffStudentsTab.tsx` (신규) | 214 | 초빙 + 신청 + 모집 |
| `src/pages/programs/detail/AttendanceLogTab.tsx` (신규) | 172 | 출석 세션 + 활동 일지 |
| `src/pages/programs/detail/SurveyResultTab.tsx` (신규) | 151 | 외부 폼 + 만족도 요약 |
| `src/pages/programs/detail/ShareTab.tsx` (신규) | 207 | 외부 공개 링크 모음 + 복사·새탭 |
| `supabase/migrations/20260516_curriculum_survey_program_id.sql` (신규) | 14 | program_id 컬럼 추가 보존본 |
| `docs/PORT_PROGRAM_DETAIL_V7_TO_V2.md` (사전 확인) | 215 | — |
| `docs/PORT_PROGRAM_DETAIL_V7_TO_V2_REPORT.md` (본 문서) | — | — |

**합계 신규 코드**: ~1,521줄 (10 파일) / 모두 < 400줄

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (이식 영역 최대 **358줄** = ProgramsPage 수정본. 신규 파일 최대 **355줄** = `programDetailUtils.ts`)
- [x] **V-2** catch / `if (error)` 모두 `console.error('[program-detail] ...', err)` + `toast.error(...)` 한글 메시지
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. Supabase nested join은 inline anonymous type
- [x] **V-4** 사용자 노출 메시지 전부 한글 (탭 라벨·빈 상태·에러·KPI·라벨 함수 5종)
- [x] **V-5** useEffect 비동기 fetch 5곳 모두 `cancelled` 가드 (5 탭 + 메인)
- [x] **V-6** Supabase 직접 fetch — 각 탭이 자체 useEffect로 utils 호출. props는 `programId`·`description`만
- [x] **V-7** 디자인 토큰 일관성 — 임의 HEX 0건. violet/orange/cyan/emerald/rose 5톤만

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 1.95s** (production 번들 정상)
- preview dev server: ✅ vite v8.0.10 ready (포트 5175 자동 fallback)
- 화면 검증 (`/programs/:id`): ⚠️ 인증 + 프로그램 데이터 필요. 박경수님 로그인 후 직접 확인

---

## 짚어둘 점

### 1. V2 스키마 차이로 조정한 항목
- **Curriculum / Survey 컬럼 추가** (Q1 ②안): `alter table curriculum add column program_id`·`alter table surveys add column program_id`. 박경수님이 Supabase Dashboard에서 직접 실행. 보존본은 `20260516_curriculum_survey_program_id.sql`.
- **출석 기록 카운트**: Supabase JS의 inner-join filter 문법 한계로 2단계 fetch (세션 ID 목록 → records `in` 카운트).
- **만족도 평균 평점**: `Survey.answers` jsonb 안의 `rating` 값을 클라이언트에서 평균 계산.

### 2. 후속 작업 후보
- **2단계 — 수정 풀 페이지** (`/programs/:id/edit`): NewEducationV9 9 카드 차용. 박경수님 결정 대기.
- **3단계 — 메인 강화**: QR 모달, 공개 링크 헤더 버튼.
- **별도 STEP — AI 추천**: STEP-AI-PREP 완료 후 OverviewTab에 callClaude 기반 다음 행동 안내.
- **별도 STEP — 일지 외부 작성 토큰**: ShareTab 마지막 안내 참조.

### 3. 추가 작업 (이번 이식 외)
- 사이드바 메뉴(`/attendance`·`/activity-logs` 등)는 그대로 유지 — Q4 결정. 사용자 멘탈 모델 변경 없음.
- ProgramsPage의 InvitationManagePanel은 그대로 — 카드/리스트 항목 펼침 동작 유지. 클릭은 상세로 이동 (Link 추가).

### 4. 라우트·App.tsx 영향
- `/programs/:id` Route 신규 추가. 다른 라우트 영향 없음.

### 5. 롤백 가능성
- 단일 commit으로 묶이므로 `git revert <hash>` 한 줄로 즉시 되돌리기 가능. 단, **Curriculum/Survey 의 `program_id` 컬럼은 SQL revert 별도 필요** (코드만 revert하면 컬럼은 잔존).

---

## Git Commit/Push (예정)

```bash
cd C:\workflow\bal24-workflow-v2
git add docs/PORT_PROGRAM_DETAIL_V7_TO_V2.md \
        docs/PORT_PROGRAM_DETAIL_V7_TO_V2_REPORT.md \
        supabase/migrations/20260516_curriculum_survey_program_id.sql \
        src/App.tsx \
        src/types/database.ts \
        src/pages/programs/
git commit -m "feat: V7 이식 — 프로그램 상세 5탭 (1단계)"
git push origin main
```
