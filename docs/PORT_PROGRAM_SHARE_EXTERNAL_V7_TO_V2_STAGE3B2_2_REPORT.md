# Stage 3-B-2-② 이식 결과 보고 — 학생·전문가 외부 페이지

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_PROGRAM_SHARE_EXTERNAL_V7_TO_V2.md](./PORT_PROGRAM_SHARE_EXTERNAL_V7_TO_V2.md)
> 박경수님 SQL 실행 완료: `activity_logs.log_type` CHECK 제약 'dispatch' 추가
> 범위: StudentSharePage + ExpertSharePage + 전화번호 식별 게이트 + 6 항목

---

## 매핑 요약

| 항목 | 사전 확인 | 이식 결과 |
|---|---|---|
| 학생 결과물 (Q3) | URL 입력 + form_applications | ✅ OutcomeUploadItem (URL + 메모, 파일 직접 업로드는 추후 안내) |
| 전문가 본인 식별 (Q2) | 전화번호 입력 게이트 | ✅ PhoneIdentityGate (curriculum_staff 매칭) |
| 강의확인서 (Q4) | issued_certificates 조회 | ✅ LectureCertificateItem (cert_type='lecture' + expert_id) |
| 추가 명세 #1 survey_open_at | 학생 만족도 노출 시점 | ✅ SurveySubmitItem에서 `notYetOpen()` 체크 |
| 추가 명세 #3 dispatch | log_type 기본값 | ✅ ActivityLogItem fixed `log_type='dispatch'` 표시 |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것
- 박경수님 명세 6 항목 (학생 3 + 전문가 3)
- token 검증 → 단계 자동 판별 → visibility 기준 렌더 흐름 (Stage 3-B-2-① 패턴)
- 모바일 반응형 (max-w-md → max-w-2xl)

### 버린 것
- ❌ 파일 직접 업로드 (Q3 옵션 B/C — STEP-STORAGE 후) — 안내문만 표시
- ❌ 강의확인서 즉석 발급 (Q4 옵션 B — STEP-PDF-GEN 후) — 발급된 PDF만 다운로드

### 새로 작성한 것 (V2 표준)
- `PhoneIdentityGate` — 전화번호 → curriculum_staff 매칭 → IdentifiedExpert 반환
- 학생 항목 3개:
  - `CheckinItem` — attendance_sessions → /attend/:token 점프
  - `SurveySubmitItem` — public_forms (form_type='survey') + survey_open_at 시점 체크
  - `OutcomeUploadItem` — URL 입력 + form_applications INSERT
- 전문가 항목 3개:
  - `InviteResponseItem` — 본인 매칭 차시별 [수락]/[거절]
  - `ActivityLogItem` — activity_logs INSERT (`log_type='dispatch'` 고정)
  - `LectureCertificateItem` — issued_certificates 조회 + PDF 다운로드
- `StudentSharePage` + `ExpertSharePage`
- App.tsx: `/share/student/:token` + `/share/expert/:token` 라우트
- 기존 4 곳 ActivityLogType 매핑 보강 (Record 강제로 'dispatch' 키 추가)

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/migrations/20260522_activity_log_dispatch.sql` (신규) | 7 | log_type CHECK 제약 변경 보존본 |
| `src/types/database.ts` (수정) | +1 | ActivityLogType 'dispatch' 추가 |
| `src/pages/share-portal/identity/PhoneIdentityGate.tsx` (신규) | 147 | 본인 식별 게이트 |
| `src/pages/share-portal/items/CheckinItem.tsx` (신규) | 110 | 출석 세션 → /attend 점프 |
| `src/pages/share-portal/items/SurveySubmitItem.tsx` (신규) | 117 | 만족도 응답 + survey_open_at 체크 |
| `src/pages/share-portal/items/OutcomeUploadItem.tsx` (신규) | 214 | 결과물 URL 입력 + form_applications |
| `src/pages/share-portal/items/InviteResponseItem.tsx` (신규) | 206 | 차시별 수락/거절 |
| `src/pages/share-portal/items/ActivityLogItem.tsx` (신규) | 228 | 활동일지 INSERT (dispatch 고정) |
| `src/pages/share-portal/items/LectureCertificateItem.tsx` (신규) | 129 | 강의확인서 다운로드 |
| `src/pages/share-portal/StudentSharePage.tsx` (신규) | 85 | 학생 페이지 (3 항목 합성) |
| `src/pages/share-portal/ExpertSharePage.tsx` (신규) | 127 | 전문가 페이지 (식별 + 3 항목) |
| `src/App.tsx` (수정) | +4 | 2 라우트 + import |
| `src/pages/programs/detail/programDetailUtils.ts` (수정) | +1 | dispatch 라벨 |
| `src/pages/programs/detail/AttendanceLogTab.tsx` (수정) | +1 | dispatch 스타일 |
| `src/pages/projects/detail/overview/ActivityTimelineCard.tsx` (수정) | +1 | dispatch 스타일 |
| `src/pages/activity-logs/ActivityLogsPage.tsx` (수정) | +0 | counts 초기값에 dispatch |
| `src/pages/activity-logs/activityLogTypes.ts` (수정) | +2 | dispatch 라벨·values |
| `src/pages/public-log/LogWritePage.tsx` (수정) | +1 | dispatch 라벨 |

**합계 신규 코드**: ~1,470줄 (10 신규 + 8 수정 + 1 SQL) / 모두 < 400줄 (최대 228)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (이식 영역 최대 **228줄** = `ActivityLogItem.tsx`)
- [x] **V-2** catch / error 모두 `console.error('[share-portal/student] ...', err)` / `[share-portal/expert] ...` + 한글 안내
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. nested join은 inline anonymous type
- [x] **V-4** 사용자 노출 메시지 전부 한글 (식별 안내·폼·완료·placeholder·확인서·일지 모두)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 (각 항목 + 페이지 + 식별 후 refresh)
- [x] **V-6** Supabase 직접 fetch — 각 항목 자체 fetch (props는 programId·expertId·메타만)
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤. 임의 HEX 0건

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 1.95s**
- preview dev server: ✅ console 에러 0건
- `/share/student/test-token-404`: ✅ "접근할 수 없는 링크" 정상 (무인증 동작)
- `/share/expert/test-token-404`: ✅ 동일
- 화면 검증: ⚠️ 박경수님 실제 토큰으로 직접 확인 부탁드려요

---

## 짚어둘 점

### 1. 전화번호 식별 (Q2)
- 입력 시 normalize (공백·하이픈 제거)
- curriculum_staff inner join에서 program_id 필터
- staff_pool.phone (외부) 또는 profiles.phone (내부) 매칭
- 매칭된 차시들의 row id를 InviteResponseItem 등에 전달

### 2. 학생 만족도 시점 체크 (추가 명세 #1)
- `program_share.survey_open_at`가 미래면 SurveySubmitItem이 "아직 응답 시점 아님" 화면
- 시점 도래 후 활성 form_token 표시

### 3. 활동일지 (추가 명세 #3)
- `log_type='dispatch'` 고정 (사용자 변경 불가)
- 외부 페이지에서 dispatch는 "파견·외부 활동" 한글로 통일
- 외부 강사(staff_pool)만 작성 가능 — 내부 직원은 V2 내부 메뉴 사용 안내

### 4. 결과물 업로드 (Q3)
- URL 검증: `^https?://` 필수
- form_applications.data jsonb에 outcome_url + memo + submitted_via 저장
- form_type='application' 활성 폼이 있어야 활성화. 없으면 "담당자 발행 후" 안내

### 5. 강의확인서 (Q4)
- `issued_certificates` 컬럼명 V2 실제 사용 (cert_type / expert_id / issue_date / cert_number)
- pdf_url null 시 "준비 중" 안내
- 외부 강사만 — 내부 직원은 V2 내부 메뉴 사용 안내

### 6. 라우트·App.tsx
- `/share/student/:token` + `/share/expert/:token` 추가
- 기존 라우트 영향 없음

### 7. 기존 코드 4 곳 보강
- ActivityLogType 'dispatch' 추가로 Record 타입 강제 매핑 4 곳 (`activityLogTypes.ts`·`projectDetailUtils.ts`·`LogWritePage.tsx`·`ActivityLogsPage.tsx` counts) + 스타일 2 곳

### 8. 롤백 가능성
- 단일 commit이라 `git revert <hash>` 한 줄
- log_type CHECK 제약은 SQL revert 별도 (5종으로 되돌림 — 단, 이미 dispatch로 INSERT된 row가 있으면 충돌)

---

## 다음 액션 (Stage 3-B 전체 완료)

✅ **3 페이지 완성**: ClientSharePage / StudentSharePage / ExpertSharePage
✅ **13 항목 모두 구현**: 7 + 3 + 3
✅ **무인증 + 모바일 반응형**

박경수님이 실제 프로그램으로 확인 부탁드려요:

### 학생 페이지
1. 외부공유 탭에서 학생 토큰 발급 → `/share/student/<token>`
2. 진행 단계 → CheckinItem (출석 세션 클릭 → /attend/:token 새 탭)
3. 결과 단계 → SurveySubmitItem + OutcomeUploadItem
4. survey_open_at 미래면 "아직 응답 시점 아님" 화면
5. 결과물 URL 제출 → form_applications에 저장

### 전문가 페이지
1. 외부공유 탭에서 전문가 토큰 발급 → `/share/expert/<token>`
2. 본인 확인 게이트 → 전화번호 입력
3. 사전·준비 단계 → InviteResponseItem (차시별 수락/거절)
4. 진행 단계 → ActivityLogItem (dispatch 고정 일지 작성)
5. 결과 단계 → LectureCertificateItem (PDF 다운로드)

확인 후:
- ✅ **다음 STEP** — 외부공유 시스템 완료. 다른 영역으로 이동
- 🔧 **수정 사항 반영**
- 🔙 **롤백** — `git revert <hash>` (단, log_type CHECK는 SQL revert 별도)
