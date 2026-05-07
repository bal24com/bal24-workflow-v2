# Stage 3-B-2-① 이식 결과 보고 — 공통 셸 + 고객용 외부 페이지

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_PROGRAM_SHARE_EXTERNAL_V7_TO_V2.md](./PORT_PROGRAM_SHARE_EXTERNAL_V7_TO_V2.md)
> 박경수님 결정: Q1~Q5 모두 추천대로 + 추가 명세 3건
> 범위: 공통 셸 + ClientSharePage + 7 항목 + 수정요청 PM 배지 (개요탭)

---

## 매핑 요약

| 항목 | 사전 확인 | 이식 결과 |
|---|---|---|
| 응답 데이터 모델 (Q1) | 분리 2 테이블 | ✅ `program_edit_requests` + `program_share_comments` |
| 학생 결과물 (Q3) | URL 입력 (3-B-2-②) | 다음 단계 예정 |
| 강의확인서 (Q4) | issued_certificates 조회 (3-B-2-②) | 다음 단계 예정 |
| Stage 분할 (Q5) | 공통+고객 / 학생·전문가 | ✅ ① 완료, ② 다음 |
| 추가 #1 survey_open_at | 컬럼 추가 | ✅ 마이그레이션 + 타입 반영 (학생용에서 사용 예정) |
| 추가 #2 수정요청 PM 배지 | 개요탭 배지 + 모달 | ✅ EditRequestsBadge 신규 (별도 페이지 X) |
| 추가 #3 활동일지 dispatch | log_type 'dispatch' 기본값 | 📌 Stage 3-B-2-② 진입 시 처리 (ActivityLogType enum 확장 + DB CHECK 변경 필요) |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것
- 박경수님 명세 7 항목 (고객용 — 사전·준비·결과 단계)
- token 검증 → program_share + program 조회 → 단계 자동 판별 → visibility 기준 렌더 흐름
- 모바일 반응형 레이아웃 (max-w-md → max-w-2xl)

### 버린 것 (Stage 3-B-2-② 예정)
- ❌ StudentSharePage (학생) — 다음 commit
- ❌ ExpertSharePage (전문가) + 전화번호 식별 게이트 — 다음 commit
- ❌ outcome_upload·activity_log·invite_response·lecture_certificate — 다음 commit
- ❌ V7 PublicEducation·PublicInstructorIntake 분석 — 박경수님이 V7 분석 옵션을 선택 안 하고 명세 + 추가 명세대로 진입

### 새로 작성한 것 (V2 표준)
- 신규 2 테이블 (program_edit_requests + program_share_comments) + program_share.survey_open_at 컬럼
- ProgramEditRequest·ProgramShareComment·EditRequestStatus·ShareCommentRole 인터페이스
- `share-portal/sharePortalUtils.ts` — token fetch + 공개 데이터 fetch (커리큘럼·강사·만족도 통계)
- `share-portal/SharePortalShell.tsx` — 공통 헤더 + 단계 배지 + loading/notfound/before 분기
- `share-portal/items/ItemCard.tsx` — 공용 카드 셸
- 항목 7개 컴포넌트 (BasicInfo·Curriculum·Instructors·Materials·SurveyView·EditRequest·FeedbackComments)
- `ClientSharePage.tsx` — 단계별 visibility 렌더
- `App.tsx` `/share/client/:token` 라우트
- `EditRequestsBadge.tsx` — OverviewTab 배지 + 모달 (4 상태 변경)
- `OverviewTab.tsx` — EditRequestsBadge 통합

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/migrations/20260521_share_responses.sql` (신규) | 76 | 2 테이블 + survey_open_at 컬럼 + RLS |
| `src/types/database.ts` (수정) | +35 | survey_open_at·ProgramEditRequest·ProgramShareComment·status enum |
| `src/pages/share-portal/sharePortalUtils.ts` (신규) | 230 | token fetch + 강사 join + 만족도 통계 + 수정요청 INSERT |
| `src/pages/share-portal/SharePortalShell.tsx` (신규) | 100 | 공통 셸 + 단계 배지 + loading/notfound/before |
| `src/pages/share-portal/items/ItemCard.tsx` (신규) | 27 | 공용 카드 |
| `src/pages/share-portal/items/BasicInfoItem.tsx` (신규) | 53 | 일정·장소·공지 |
| `src/pages/share-portal/items/CurriculumItem.tsx` (신규) | 86 | 차시 read-only |
| `src/pages/share-portal/items/InstructorsItem.tsx` (신규) | 86 | 강사 사진·약력 (연락처·계좌 X) |
| `src/pages/share-portal/items/MaterialsItem.tsx` (신규) | 54 | notice_files 다운로드 |
| `src/pages/share-portal/items/SurveyViewItem.tsx` (신규) | 78 | 만족도 통계 read-only |
| `src/pages/share-portal/items/EditRequestItem.tsx` (신규) | 130 | 수정요청 INSERT 폼 |
| `src/pages/share-portal/items/FeedbackCommentsItem.tsx` (신규) | 221 | 댓글 + 답글 1단계 |
| `src/pages/share-portal/ClientSharePage.tsx` (신규) | 91 | 7 항목 단계별 합성 |
| `src/App.tsx` (수정) | +2 | `/share/client/:token` Route |
| `src/pages/programs/detail/share/EditRequestsBadge.tsx` (신규) | 216 | OverviewTab 배지 + 모달 (status 4종 변경) |
| `src/pages/programs/detail/OverviewTab.tsx` (수정) | +3 | EditRequestsBadge 통합 |

**합계 신규 코드**: ~1,570줄 (12 신규 + 4 수정 + 1 SQL) / 모두 < 400줄 (최대 230)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (최대 **230줄** = `sharePortalUtils.ts`)
- [x] **V-2** catch / error 모두 `console.error('[share-portal/client] ...', err)` + 한글 안내
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. nested join은 inline anonymous type
- [x] **V-4** 사용자 노출 메시지 전부 한글 (loading·notfound·before·항목 라벨·폼 안내·완료 메시지)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 (각 항목 컴포넌트 + 페이지)
- [x] **V-6** Supabase 직접 fetch — 각 항목 컴포넌트가 자체 fetch (props는 programId·program 메타만)
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤. 임의 HEX 0건

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 2.03s** (production 번들 정상)
- preview dev server: ✅ vite v8.0.10 ready, console 에러 0건
- 외부 라우트 진입 (`/share/client/test-token-404`): ✅ login redirect 안 됨 (무인증 동작 확인) — 잘못된 토큰은 "접근할 수 없는 링크" 화면 정상 출력
- 화면 검증: ⚠️ 박경수님 실제 토큰으로 직접 확인 부탁드려요

---

## 짚어둘 점

### 1. 보안 룰 — 강사정보 제한
- `InstructorsItem`은 staff_pool/profiles에서 **이름·career_summary·profile_image_url·avatar_url** 만 select
- 연락처(phone)·이메일(email)·계좌(bank_*)·주민번호(id_number) 는 **쿼리에서 자체 제외**
- ⚠️ 보안은 RLS만 의존하지 않고 SELECT 컬럼 명시로 이중 보호

### 2. 단계별 자동 노출
- ClientSharePage 진입 시 `STAGE_ITEMS.client[stage]` 매트릭스에서 현재 단계 항목 가져와서
- `isItemVisible(visibility, 'client', item)` 체크 후 실제 렌더
- visibility off 항목은 화면에서 완전히 사라짐 (관리자가 끈 경우)

### 3. 댓글 답글 1단계
- parent_id로 답글 트리 — 1단계만 (대댓글의 댓글은 안 됨)
- author_role은 'client' (외부에서 작성) — 'staff'는 관리자가 V2 내부에서 작성 시 사용 (다음 STEP)
- is_deleted=true 는 fetch에서 자동 제외 (논리 삭제만)

### 4. 수정요청 PM 배지 (추가 명세 #2)
- OverviewTab 진입 시 미확인(pending+reviewing) 카운트 fetch
- 0건이면 배지 자체를 안 그림 (clean UX)
- 클릭 시 모달 열려서 [검토 시작] [처리 완료] [반려] 3 액션
- 별도 페이지 X — 박경수님 명세대로 모달로 끝

### 5. 추가 명세 #1 survey_open_at
- program_share에 컬럼 추가됨 + 타입 반영 완료
- Stage 3-B-2-② 학생용 페이지에서 활용 — 현재 시각이 survey_open_at 이후일 때만 만족도 응답 노출
- 관리자 탭(StageDateBar)에 입력 UI 추가는 다음 단계 또는 별도 commit

### 6. 추가 명세 #3 dispatch (다음 단계)
- ActivityLogType enum에 'dispatch' 추가 필요
- DB CHECK 제약 변경 필요 (`activity_logs.log_type` 기존 5종 → 6종)
- Stage 3-B-2-② 진입 시 박경수님 SQL 실행 후 진행 예정

### 7. 라우트·App.tsx 영향
- `/share/client/:token` 라우트 추가 (인증 X 영역)
- 향후 `/share/student/:token`·`/share/expert/:token` 추가 예정

### 8. 롤백 가능성
- 단일 commit이라 `git revert <hash>` 한 줄
- 2 테이블 + program_share.survey_open_at 컬럼은 SQL revert 별도

---

## 다음 액션

1. ✅ **Stage 3-B-2-① 화면 검증** — 박경수님이 실제 프로그램의 외부공유 탭에서 고객 토큰 발급 → `/share/client/<token>` 진입 → 다음 동작 확인:
   - [ ] 잘못된 토큰: "접근할 수 없는 링크" 화면
   - [ ] 시작 전 (모든 단계 시작일 미도래): "아직 시작 전" 화면
   - [ ] 사전·준비 단계 진입 시: 기본정보·커리큘럼·강사·교재 4 항목 노출 (visibility off 항목은 사라짐)
   - [ ] 결과 단계 진입 시: 만족도 확인·수정요청 폼·의견회신 댓글 3 항목 노출
   - [ ] 수정요청 작성·전송 → 프로그램 상세 개요탭에 빨간 배지 N건 표시
   - [ ] 배지 클릭 → 모달 → [검토 시작]/[처리 완료]/[반려]
   - [ ] 의견회신 댓글 작성·답글 1단계
   - [ ] 모바일 (휴대폰 또는 DevTools 모바일 뷰)에서 단일 컬럼 정상

2. ✅ **Stage 3-B-2-② 진입 결정** — 학생·전문가 페이지 + 전화번호 식별 + 활동일지 dispatch + 강의확인서 조회 + 결과물 URL 입력 (90~120분, 1 commit)

   진입 전 박경수님이 실행해야 할 SQL (추가 명세 #3):
   ```sql
   ALTER TABLE public.activity_logs
     DROP CONSTRAINT IF EXISTS activity_logs_log_type_check;
   ALTER TABLE public.activity_logs
     ADD CONSTRAINT activity_logs_log_type_check
     CHECK (log_type IN ('mentoring', 'lecture', 'business_trip', 'ta', 'operation', 'dispatch'));
   ```
