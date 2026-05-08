# STEP 11 Stage 11-① 이식 결과 보고 — 외부 페이지 3종

> 작업일: 2026-05-08
> 사전 확인 문서: [STEP_11_EXTERNAL_FORMS_PRECHECK.md](./STEP_11_EXTERNAL_FORMS_PRECHECK.md)
> 박경수님 결정: Q1 SQL 실행 완료 / Q1~Q5 모두 추천대로
> 범위: /cert 신규 + /attend 강화 + /apply 홍보 영역

---

## 매핑 요약

| 항목 | 사전 확인 | 이식 결과 |
|---|---|---|
| schema 격차 (Q1) | 4 ALTER TABLE | ✅ 박경수님 SQL 실행 완료, 보존본 작성 |
| /cert/:token | 신규 페이지 + jspdf+html2canvas | ✅ CertViewPage + certificatePdf.ts |
| /attend 3 토큰 분기 | student_token / instructor_token / ta_token | ✅ V2 transition 호환 (student + learner 둘 다 매칭) |
| /apply 홍보 영역 | 강사·커리큘럼·공지·목표 | ✅ PromoSection 신규 (share-portal 유틸 재사용) |
| 출석 status (Q3) | O / △ / X 컬럼 | ✅ AttendanceCheckStatus enum + 매핑 (present→O / late→△ / absent→X) |

---

## ⚠️ 박경수님께 전달드릴 학생 토큰 호환 이슈

**V2 schema 정리**: 박경수님 Q1 SQL은 `student_token` 컬럼을 ADD COLUMN IF NOT EXISTS로 실행 → V2엔 기존 `learner_token`이 이미 있어서 **두 컬럼 공존** 상태가 됨.

**현재 처리 (transition 호환)**:
- 새 코드는 `student_token` 우선
- AttendCheckPage `.or()`에 `student_token + learner_token + instructor_token + ta_token` 4개 모두 매칭
- 기존 발급된 learner_token URL도 한동안 살아 있음

**향후 결정 필요**:
- 옵션 A: `learner_token` DROP COLUMN — 통일. 단, 기존 발급 URL 일괄 무효화
- 옵션 B: 그대로 두 컬럼 공존 — 안전, 하지만 schema 산만
- 옵션 C: `UPDATE attendance_sessions SET student_token = learner_token` — 같은 값으로 정렬, 그 후 learner_token DROP

**제 추천**: 옵션 C (Stage 11-② 진입 시 SQL로 처리). 박경수님이 production에서 외부 학생 토큰 URL을 발송한 게 있다면 옵션 B 안전.

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것
- 박경수님 명세 5 외부 페이지 중 3종 (Stage 11-①)
- jspdf + html2canvas 패키지 활용
- share-portal sharePortalUtils의 fetchPublicCurriculum / fetchPublicInstructors 재사용

### 버른 것 (Stage 11-②·③ 예정)
- ❌ 출석 관리 내부 탭 (Stage 11-②)
- ❌ 수료증 일괄 발급 + 출석률 자동 계산 (Stage 11-②)
- ❌ 신청·모집 관리 내부 탭 (Stage 11-③)

### 새로 작성한 것
- `migrations/20260523_step_11_columns.sql` — 4 ALTER TABLE 보존본
- `types/database.ts` — AttendanceSession (3 토큰 + session_no) / AttendanceRecord (status) / IssuedCertificate (token)
- `lib/certificatePdf.ts` — elementToPdfBlob + downloadBlob + formatIssueDateKo
- `pages/public-cert/CertViewPage.tsx` (/cert/:token) — 토큰 조회 + 미리보기 + PDF 다운로드
- `pages/public-attend/AttendCheckPage.tsx` 강화 — 4 토큰 OR 매칭 + status enum 매핑
- `pages/public-apply/PromoSection.tsx` 신규 — 강사·커리큘럼·공지·목표
- `pages/public-apply/ApplyPage.tsx` — Hero 아래 PromoSection 통합
- App.tsx — `/cert/:token` 라우트
- 기존 attendance 페이지 보강 — session_token optional 호환

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/migrations/20260523_step_11_columns.sql` (신규) | 41 | 4 ALTER TABLE 보존본 |
| `src/types/database.ts` (수정) | +25 | AttendanceCheckStatus / 3 토큰 / cert token |
| `src/lib/certificatePdf.ts` (신규) | 70 | jspdf + html2canvas PDF 생성 |
| `src/pages/public-cert/CertViewPage.tsx` (신규) | **219** | /cert/:token 외부 페이지 |
| `src/pages/public-attend/AttendCheckPage.tsx` (수정) | 277 | 4 토큰 OR + status 매핑 |
| `src/pages/public-apply/PromoSection.tsx` (신규) | 169 | 강사·커리큘럼·공지·목표 |
| `src/pages/public-apply/ApplyPage.tsx` (수정) | 292 | PromoSection 통합 |
| `src/App.tsx` (수정) | +2 | `/cert/:token` 라우트 |
| `src/pages/attendance/AttendanceDetailPage.tsx` (수정) | +0 | session_token nullable 호환 |
| `src/pages/attendance/AttendancePage.tsx` (수정) | +0 | 동일 |

**합계 신규 코드**: ~900줄 (4 신규 + 5 수정 + 1 SQL) / 모두 < 400줄 (최대 292)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (이식 영역 최대 **292줄** = `ApplyPage.tsx`)
- [x] **V-2** catch / error 모두 `console.error('[public-cert] ...', err)` / `[attend]` / `[apply]` + 한글 toast
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건
- [x] **V-4** 사용자 노출 메시지 전부 한글
- [x] **V-5** useEffect 비동기 fetch 에 `cancelled` 가드 (CertViewPage / PromoSection / AttendCheckPage)
- [x] **V-6** Supabase 직접 fetch — 각 페이지·컴포넌트 자체 fetch
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤. 임의 HEX 0건

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 3.79s**
- preview dev server: ✅ console 에러 0건
- `/cert/test-token-404`: ✅ "수료증을 찾을 수 없어요" notfound 정상
- 화면 검증: ⚠️ 박경수님 실제 토큰으로 직접 확인 부탁드려요

---

## 짚어둘 점

### 1. 수료증 PDF 생성 (Q4)
- jsPDF + html2canvas — DOM 영역(`printRef`)을 캔버스 캡처 → A4 가로 PDF
- pdf_url 캐시 X — 매번 클라이언트에서 즉석 생성
- 직인 이미지(`certificate_templates.seal_file_url`)는 `crossOrigin="anonymous"`로 로드

### 2. /apply 홍보 영역
- PromoSection: 공지·성과목표·강사진(2열 카드)·커리큘럼(최대 10차시) 4 카드
- 11차시 이상은 "+N차시 더 — 신청 후 안내" 표시
- 강사 정보는 share-portal 보안 룰 동일 (이름·약력·사진만)

### 3. AttendCheckPage status 매핑
- UI: present / late / absent (3 버튼)
- DB: O / △ / X (CHECK 제약)
- `CHECK_STATUS_TO_DB` 매핑으로 INSERT

### 4. 라우트·App.tsx
- `/cert/:token` 추가 (인증 X 영역)
- 기존 `/attend/:token`·`/apply/:programId` 영향 없음

### 5. 롤백 가능성
- 단일 commit이라 `git revert <hash>` 한 줄
- 4 ALTER TABLE은 SQL revert 별도 (인터페이스에 추가된 필드도 revert)

---

## 다음 액션

1. ✅ **Stage 11-① 화면 검증** — Netlify 배포 후 박경수님이 확인:
   - [ ] 잘못된 토큰: `/cert/<랜덤>` → notfound 화면
   - [ ] 실제 발급된 수료증: `/cert/<token>` → 미리보기 + PDF 다운로드
   - [ ] `/attend/<student_token>` 학생 진입 (또는 기존 `learner_token`도 매칭)
   - [ ] `/attend/<instructor_token>` 강사 / `/attend/<ta_token>` TA
   - [ ] 출석 상태 O / △ / X DB 저장 확인
   - [ ] `/apply/<programId>` 홍보 영역 (강사·커리큘럼·공지·목표) 표시
   - [ ] 신청 폼 정상 작동
2. ✅ **Stage 11-② 진입 결정** — 출석 + 수료증 내부 탭 (60~90분, 1 commit)
   - AttendanceLogTab → 3 sub 섹션 (출석·일지·수료증)
   - 출석률 자동 계산 + 수료 자동 판정 + 일괄 발급
3. ✅ **Stage 11-③ 진입 결정** — 신청 + 모집 내부 탭 (60~90분, 1 commit)

박경수님 학생 토큰 호환(learner_token vs student_token) 결정 + Stage 11-② 진입 결정 알려주세요.
