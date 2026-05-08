# STEP 11 Stage 11-② 이식 결과 보고 — 출석·수료증 내부 탭

> 작업일: 2026-05-08
> 박경수님 결정: 학생 토큰 옵션 A (learner_token DROP COLUMN) + Stage 11-② 진입
> 범위: AttendanceLogTab → 3 sub 섹션 (출석·일지·수료증) + 출석률 자동 계산 + 일괄 발급

---

## 매핑 요약

| 항목 | 사전 확인 | 이식 결과 |
|---|---|---|
| 학생 토큰 통일 | learner_token DROP | ✅ DROP SQL 보존본 + 코드 4 곳 정리 |
| 7탭 구조 (Q2) | 기존 7탭 + sub 섹션 | ✅ AttendanceLogTab → 3 sub 탭 (출석/일지/수료증) |
| 출석률 자동 판정 (Q3) | [일괄 발급] 버튼 시점 배치 | ✅ calculateAttendanceForProgram() — 80% 이상 후보 |
| 수료증 PDF (Q4) | 즉석 생성 | ✅ Stage 11-① CertViewPage에서 처리 (cert_number 자동 발급) |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것
- 박경수님 명세 출석·수료증 내부 탭 (Q2 옵션 B 7탭 sub 섹션)
- 출석률 80% 이상 자동 수료 판정 (COMPLETION_THRESHOLD)
- 일괄 발급 → cert_number 자동 (CERT-YYYYMMDD-NNNN)
- O/△/X 매트릭스 미리보기 (세션 펼침)

### 버린 것 (Stage 11-③ 예정)
- ❌ 신청·모집 내부 탭 (StaffStudentsTab → 4 sub) — 다음 commit

### 새로 작성한 것
- `migrations/20260524_drop_learner_token.sql` — 컬럼 DROP 보존본
- `lib/attendanceCalculator.ts` — calculateAttendanceForProgram() + COMPLETION_THRESHOLD
- `programs/detail/attendance/SessionManagePanel.tsx` — 세션 추가/삭제/체크인 토글 + 3 토큰 링크 + O/△/X 매트릭스
- `programs/detail/attendance/CertificateIssuePanel.tsx` — 출석률 산출 + 후보 + 일괄 발급 + 발급 목록 + 링크 복사
- `programs/detail/AttendanceLogTab.tsx` 재작성 — 3 sub 탭 (출석/일지/수료증)
- 기존 4 곳에서 learner_token 제거 (types·AttendCheckPage·sharesUtils 2 곳)

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/migrations/20260524_drop_learner_token.sql` (신규) | 6 | DROP COLUMN 보존본 |
| `src/types/database.ts` (수정) | -2 | learner_token 필드 제거 |
| `src/lib/attendanceCalculator.ts` (신규) | 119 | 출석률 계산·수료 판정 |
| `src/pages/programs/detail/attendance/SessionManagePanel.tsx` (신규) | **345** | 세션 관리 + 3 토큰 + 매트릭스 |
| `src/pages/programs/detail/attendance/CertificateIssuePanel.tsx` (신규) | 274 | 일괄 발급 |
| `src/pages/programs/detail/AttendanceLogTab.tsx` (재작성) | 157 | 3 sub 탭 |
| `src/pages/public-attend/AttendCheckPage.tsx` (수정) | -2 | learner_token OR 매칭 제거 |
| `src/pages/shares/sharesUtils.ts` (수정) | +0 | learner_token → student_token |

**합계 신규 코드**: ~900줄 (3 신규 + 4 수정 + 1 SQL) / 모두 < 400줄 (최대 345)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (최대 **345줄** = `SessionManagePanel.tsx`)
- [x] **V-2** catch / error 모두 `console.error('[step-11/attendance] ...', err)` / `[step-11/cert]` / `[attendance-calc]` + 한글 toast
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건
- [x] **V-4** 사용자 노출 메시지 전부 한글 (sub 탭·세션 관리·매트릭스·발급 흐름 모두)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 (SessionManagePanel·CertificateIssuePanel·SessionMatrix·ActivityLogSection)
- [x] **V-6** Supabase 직접 fetch — 각 sub 섹션이 자체 fetch
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤 + amber (지각 △)

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 2.71s**
- preview dev server: ✅ console 에러 0건, /login redirect 정상

---

## 짚어둘 점

### 1. 출석률 계산 로직
- 분모: 프로그램의 모든 출석 세션 수 (학생 role 무관)
- 분자: 해당 학생이 'O' 또는 '△' 로 등록된 세션 수
- 동일 학생 식별: phone 우선, 없으면 name
- 80% 이상 → `isCompletion: true`
- 중복 등록(같은 phone으로 같은 세션 여러번) 은 Set으로 자동 제거

### 2. 수료증 일괄 발급 흐름
- `[일괄 발급]` 클릭 → `newCandidates` (= `isCompletion: true` && 아직 발급 안 된 학생) 만 INSERT
- `cert_number` 자동: `CERT-YYYYMMDD-NNNN` (lastNo + idx + 1)
- `template_id`는 program의 cert_type='completion' template (없으면 발급 차단 + 안내)
- 발급 후 즉시 목록 갱신 + 토큰 복사·새 탭 가능

### 3. SessionManagePanel
- 세션 추가 시 default: title="N차시 출석", session_no=다음 번호, session_date=오늘, check_in_open=true
- 펼침: 3 토큰 (student/instructor/ta) URL 표시 + 복사·새 탭
- 매트릭스: 펼침 시 attendance_records 자체 fetch → status별 색상 배지로 표시

### 4. learner_token DROP COLUMN
- 박경수님이 SQL 직접 실행 필요 (보존본 `20260524_drop_learner_token.sql`)
- 기존 발급된 learner_token URL은 무효화됨 (옵션 A 결정)
- AttendCheckPage·sharesUtils 모두 student_token만 사용

### 5. 라우트·App.tsx 영향
- 변경 없음. AttendanceLogTab 재작성만.

### 6. 롤백 가능성
- 단일 commit이라 `git revert <hash>` 한 줄
- learner_token DROP은 되돌릴 수 없음 (데이터 보존 X) — 박경수님 결정 옵션 A 명시

---

## 다음 액션

1. ✅ **Stage 11-② 화면 검증** — 박경수님이 프로그램 상세 → 출석·일지 탭 → 3 sub 확인:
   - [ ] **출석 sub**: [세션 추가] → 펼침 → 3 토큰 (student/instructor/ta) 복사·새 탭 → 외부에서 체크인 → 매트릭스에 O/△/X 색상 배지 표시
   - [ ] **일지 sub**: 활동 일지 최근 12건 표시 + [+ 새 일지] 링크
   - [ ] **수료증 sub**: [다시 계산] → 학생별 출석률 표시 → 80% 이상 후보 emerald 강조 → [일괄 발급 (N)] 클릭 → 발급된 목록에 추가 → 수료증 링크 복사·새 탭
2. ✅ **Stage 11-③ 진입 결정** — 신청·모집 내부 탭 (StaffStudentsTab → 4 sub) 60~90분, 1 commit
3. ⚠️ **learner_token DROP SQL 실행 필요** — 박경수님 Supabase Dashboard에서 직접 (`migrations/20260524_drop_learner_token.sql`)
