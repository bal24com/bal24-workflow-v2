# BalanceDot WorkFlow v2 세션 인수인계 (HANDOVER.md)
// 이 파일은 다음 AI 세션(Claude·Skywork 등)이 프로젝트의 현재 상태를 즉시 파악하도록 작성됨.
// 최종 갱신: 2026-06-03 (Claude 세션 — 동아리 운영 + 역할별 외부공유 시스템 반영)

## 0. ⚠️ 먼저 읽기 — 최근 작업 줄기 (중요)
이 프로젝트는 두 갈래로 발전해 왔음. 아래 B 갈래가 가장 최신이며 git 에 모두 반영됨.

- **갈래 A (회계·컨소시엄, ~2026-05-25)** — 지급요청·견적·리포트. 일부 미완성 (5번 참고).
- **갈래 B (외부공유·동아리, ~2026-06-03)** — 강사 포털 → 역할별 외부공유 4종 → 동아리 운영 시스템.
  최근 커밋 `cb9da04` (CLUB-15)까지 전부 main 에 push 완료.

→ 작업 이어갈 때 git log 로 실제 최신 커밋부터 확인할 것 (`git log --oneline -15`).

## 1. 프로젝트 기본 정보
- 앱 명칭: BalanceDot WorkFlow v2
- 로컬 경로: `C:\workflow\bal24-workflow-v2` (Vite 환경)
- 기술 스택: React 18 + TypeScript + Vite / Tailwind + shadcn/ui + Radix + Pretendard / Supabase (Auth·DB·Storage·Edge Functions)
- GitHub: `https://github.com/bal24com/bal24-workflow-v2` (기본 브랜치 main)
- 배포: `https://bal24.kr` (netlify)
- Supabase: `https://clsljkxvgmqwenettkrz.supabase.co`
- 타입체크: `cd /c/workflow/bal24-workflow-v2 && npx tsc -b --noEmit` (반드시 exit 0 확인 후 커밋)

## 2. 외부 공유 시스템 전체 구조 (갈래 B 핵심 — 토큰 경로가 여러 갈래라 혼동 주의)
프로그램 단위로 외부에 공유하는 경로가 3종류 있음. 각각 용도·인증이 다름.

### (1) 역할별 외부공유 — `/share/{role}/:token` (무인증)
- 4역할 — `supporter`(지원기관)·`beneficiary`(수혜기관)·`team`(참여팀/개인)·`staff`(강사/멘토)
- 컴포넌트 `src/pages/share-portal/RoleSharePage.tsx` (role prop 만 다르게 4라우트)
- 단계 탭 — `before·pre·ready·progress·result` (program_share 날짜로 자동 판별)
- 노출 항목은 `src/pages/programs/detail/share/visibilityCatalog.ts` 의 `STAGE_ITEMS[role][stage]` 매트릭스 + `program_share.visibility` 토글(기본 true)로 결정.
- 지원·수혜기관은 단계 무관 **종합 현황(ClubDashboardItem)** 을 상단 고정.

### (2) 동아리(팀) 페이지 — `/share/club/:token` (무인증)
- 컴포넌트 `src/pages/share-portal/ClubSharePage.tsx`
- 동아리 1개당 토큰 1개 (`program_clubs.club_token`). 멘토·선생님·팀이 같은 링크 사용.
- 기능 — 멘토링 차수 일정 입력·확정 + 활동 등록(사진·파일) + 활동 목록.

### (3) 강사 포털 — `/portal`(PIN 로그인) · `/staff-portal/:token`(영구 링크)
- 강사 본인이 일지·자료·강사료를 본격 관리하는 곳. 사이드바 메뉴에는 의도적으로 없음(외부 전용).
- PM 은 `강사·멘토`(`/experts`) 목록에서 링크 복사로 강사에게 전달.
- PIN 인증 — Edge Function `verify-staff-pin` / `change-staff-pin` (해시 저장).
- 탭 — 개요·멘토링·강의·일지·자료 (`src/pages/staff-portal/tabs/`).

### PM(관리자) 측 노출 관리
- 프로그램 상세 `외부 공유` 탭 — 4역할 × 항목 한 표로 on/off (SHARE-UX-2).
- 외부는 읽기 위주. 데이터는 PM 이 본 시스템에서 등록하면 자동 노출.
  · 강사·멘토 → `강사` 탭 / 보고서 → `결과보고서` 탭 / 진행률 차시 → `강의 계획` 탭.

## 3. 동아리 운영 시스템 (CLUB-1~15, 가장 최근 작업)
여수 해양·창업 학생 동아리 운영 사업 (5개교·8팀) 용으로 구축. 범용 동아리 관리로 재사용 가능.

### 신규 DB 테이블·컬럼
- `program_clubs` — 동아리 마스터 (school_name·club_name·teacher_name·mentor_name·student_count·club_type·예산·club_token·pin 등).
- `program_club_sessions` — 동아리 차수별 멘토링 일정 (session_no·session_label·wish_date_1·wish_time_1·confirmed_date·confirmed_time·status[wish/confirmed/done]·decided_by).
- `activity_logs.club_id` 추가 — 동아리 활동을 기존 일지 테이블 재사용. `log_type='club'`(동아리 활동)·`'upload'`(진행 중 파일 제출).
- `program_report_sections.file_urls` (jsonb) — 보고서 첨부 파일.

### PM 측 (프로그램 상세 `동아리` 탭)
- `src/pages/programs/detail/club/` — ClubManageTab(목록·카드·멘토 요약 뷰)·ClubBulkModal(엑셀 일괄등록 13열)·ClubSessionSchedule(차수 일정)·ClubCardGrid·ClubMentorSummary.

### 외부 측
- `ClubSharePage` (동아리 토큰) + RoleSharePage 의 ClubDashboardItem(지원·수혜기관 종합 진행률).

### 차수 일정 권한 규칙 (CLUB-11·12)
- 날짜·시간 **수정은 누구나** (PM·멘토·선생님). **확정은 PM·담당 선생님만**(`canConfirm`).
- 외부 동아리 페이지에 "담당 선생님이세요?" 토글 → 켜면 확정 버튼 노출. 1·2순위 없이 날짜 1개+확정.

### 강사진에 멘토 포함 (CLUB-15)
- `InstructorsItem` — 강사(curriculum_staff '강사'·'FT') + 멘토(`program_clubs.mentor_name`) 한 카드에. 멘토는 이름·담당 동아리만 (연락처 비노출).

## 4. 신규 외부 공개 라우트 (인증 불필요 — token 기반, 갈래 B 추가분)
| 라우트 | 컴포넌트 | 용도 |
|---|---|---|
| `/share/supporter/:token` | RoleSharePage(role=supporter) | 지원기관 |
| `/share/beneficiary/:token` | RoleSharePage(role=beneficiary) | 수혜기관 |
| `/share/team/:token` | RoleSharePage(role=team) | 참여팀(개인) |
| `/share/staff/:token` | RoleSharePage(role=staff) | 강사/멘토 |
| `/share/club/:token` | ClubSharePage | 동아리(팀) 활동·일정 |
| `/portal` · `/staff-portal/:token` | StaffPortalLoginPage·StaffPortalPage | 강사 포털 |
> 기존 갈래 A 라우트(`/checkin`·`/form`·`/portal/:token`·`/invitation`·`/apply`·`/recruit`·`/attend`·`/log`·`/accounting-review`)도 유지됨.

## 5. 진행 중 및 미완성 기능
### 갈래 A (회계 — Skywork 영역, 미확인)
- ⏳ 지급요청(PaymentRequestTab) — 특정 환경 행 삭제 시 오류 (재현 정보 필요).
- ⏳ 견적 가져오기 모달 — datalist 템플릿·prefill 강화.
- ⏳ 리포트 자동화 — 최종 결과보고서 데이터 집계 고도화.

### 갈래 B (외부공유·동아리)
- ⏳ 수혜기관이 자기 학교 동아리를 한 곳에서 일정 확정·관리 (현재는 동아리별 토큰). 학교↔토큰 매핑 설계 필요.
- ⏳ approval(동의)·tax_invoice(세금계산서) 외부 입력 흐름 (현재 안내문만, 지원기관에 tax_invoice 노출).
- ⏳ 보고서 단계 구분 (착수/중간/결과) — 현재 결과보고서 1종을 진행·결과 양쪽에 노출.
- 🔵 AI 자동 채우기 (PDF·이미지 → 폼 자동 생성) — 박경수님 "추후 검토".

## 6. 핵심 코딩 규칙 (CLAUDE.md 절대 준수)
- 컴포넌트 단일 파일 **400줄 초과 금지** (목표 150~200줄). 커밋 전 `wc -l` 확인.
- 모든 UI·toast·에러·placeholder **무조건 한국어**. 영문 raw 에러는 console.error 로만, 사용자엔 한글 안내.
- 한국어 문장 끝 **콜론(:) 금지** — 마침표로. 콜론은 코드·레이블 안에서만.
- 새 소스 파일 첫 줄에 **한국어 한 줄 역할 주석**.
- Supabase Join FK 명시 필수 — `profiles!{table}_{column}_fkey` (단축형은 FK 2개↑ 시 PGRST201).
- `localStorage` 금지(Context·Supabase). 단 PIN/팀코드 인증만 sessionStorage 예외.
- `catch {}` 빈 블록 금지. `any`/`unknown` 금지.
- 모달 백드롭 — `mouseDownOnBackdropRef` 패턴 (드래그로 안 닫히게).
- 파일 업로드 — 드래그앤드롭 + Ctrl+V (공용 `MultiFileUpload`, bucket `satisfaction-files`).
- 에러는 추측 말고 **실제 메시지·콘솔·Network 확인 후 진단**.
- 외과적 수정 — 요청과 직접 관련된 줄만 변경. 기존 dead code·스타일 건드리지 않음.
- 커밋 푸터 — `Co-Authored-By: Claude Opus 4.7 (1M context) <noreply@anthropic.com>`.
- 완료 보고 — 소스코드 본문 첨부 금지. 경로·줄수·요약·검증결과만.

## 7. 자주 발생하는 이슈 패턴
- **PGRST201** — FK 2개↑ 모호성. 조인 시 FK명 명시.
- **Minified React error #310** — 렌더 중 상태 변경·Hook 규칙 위반.
- **컬럼 누락 에러** — 마이그레이션 SQL 을 박경수님이 Supabase Dashboard 에서 직접 실행해야 하는 경우 많음. "schema cache" 에러 시 SQL 미실행 의심.
- **anon RLS** — 외부(`/share/*`) 페이지는 anon 권한. 신규 테이블 조회·삽입 시 anon policy 필요.

---
**인수인계 확인:** git log 로 최신 커밋 확인 → CLAUDE.md 규칙 숙지 → 작업 시작. CLAUDE.md 규칙은 절대적임.
