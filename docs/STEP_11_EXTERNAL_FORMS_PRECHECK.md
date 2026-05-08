# STEP 11 사전 확인 문서 — 외부 폼 시스템 통합 (출석·수료증·일지·신청·모집)

> 작성일: 2026-05-08
> 범위: 5 외부 페이지 + 4 내부 관리 탭 + 보강 데이터 모델
> 다음 단계: **Q1~Q5 결정 + 승인 → 코드 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| 5 외부 페이지 | /attend / /log / /cert(신규) / /apply / /recruit |
| 4 내부 관리 | 출석 / 수료증 / 신청 / 모집 |
| 기존 V2 자산 | 사이드바 5 메뉴 + 외부 라우트 4개 + 테이블 7개 이미 운영 중 |
| 신규 영역 | /cert/:token + 수료 자동 판정 + 일괄 발급 + 4 내부 탭 |

---

## 섹션 1 — V2 현재 상태 vs 박경수님 명세 비교

### 1-A. 외부 라우트 5종

| 박경수님 명세 | V2 현재 | 격차 |
|---|---|---|
| `/attend/:token` 역할별 출석체크 | ✅ `AttendCheckPage` (학생만) | ⚠️ **역할별 분기 미흡** — token 1개 / 학생/강사/TA 별도 토큰 X |
| `/log/:token` 멘토링·출강·TA보고서 | ✅ `LogWritePage` (5종 log_type) | ✅ V2가 더 풍부 (mentoring·lecture·business_trip·ta·operation·dispatch) |
| `/cert/:token` 수료증·강의확인서 | ❌ **없음** | 🆕 **신규 페이지 + 토큰 컬럼 추가** |
| `/apply/:programId` 신청 + 홍보 | ✅ `ApplyPage` | ⚠️ **홍보 영역 미흡** — 폼만 있음, 프로그램 소개·강사·일정 노출 X |
| `/recruit/:token` 강사·TA·전문가 모집 | ✅ `RecruitApplyPage` | ✅ V2 기능 충분 |

### 1-B. 사이드바 관리 메뉴 5종 (이미 운영 중)
- `/attendance` (AttendancePage)
- `/certificates` (CertificatePage)
- `/activity-logs` (ActivityLogsPage)
- `/applications` (ApplicationPage)
- `/recruit-manage` (RecruitPage)

박경수님 명세 "프로그램 상세 탭 추가"는 사이드바 메뉴와 **별개로 프로그램 단위 임베드** 의미.

### 1-C. V2 schema vs 박경수님 명세 격차 (Q1 결정 필요)

| 테이블 / 컬럼 | V2 현재 | 박경수님 명세 | 처리 |
|---|---|---|---|
| `attendance_sessions.session_token` (1개) | ✅ 1개 | student_token + instructor_token + ta_token (3개) | ⚠️ **컬럼 2개 추가** 또는 1개 토큰으로 역할 분기 |
| `attendance_records.status` | ❌ 없음 (check_in_at만) | O / △ / X | ⚠️ **컬럼 추가** 또는 check_in_at NULL/지각 자동 판정 |
| `issued_certificates.token` | ❌ 없음 | token (외부 /cert/:token 접근용) | 🆕 **컬럼 추가 필수** |
| `participant_applications.id_number_masked` | ✅ 있음 | id_number 마스킹 저장 | ✅ V2 ID로 일치 |
| `recruit_applications.attachment_urls[]` | ✅ 배열 | file_url (단일) | ✅ V2가 더 풍부 |
| `certificate_templates.template_type` | ✅ `cert_type` (completion/lecture) | template_type | ✅ 의미 동일 (이름만 다름) |
| `attendance_sessions.session_no` | ❌ 없음 | session_no | ⚠️ 정렬·표시용으로 추가 검토 |

### 1-D. 패키지 / Storage
- ✅ qrcode, @types/qrcode (V2에 `qrcode.react` 이미 있음 — 호환)
- ✅ jspdf, html2canvas (이미 V2 package.json 등록)
- ✅ seals 버킷 (수료증 직인) — 박경수님 명세대로

---

## 섹션 2 — 외부 페이지 설계

### 2-A. /attend/:token 역할별 분기 (Q1 옵션 결정 후)

**옵션 X (3 토큰)**: student_token / instructor_token / ta_token 3개 컬럼 → URL `/attend/:token` 진입 시 어느 컬럼과 매칭되는지로 역할 자동 판별
**옵션 Y (1 토큰 + 역할 select)**: 기존 session_token 1개 그대로 + 진입 시 사용자가 본인 역할 선택 (학생/강사/TA)

**제 추천: 옵션 X** — 박경수님 명세대로. URL만으로 역할 식별 (혼동 없음, 보안 명확)

### 2-B. /cert/:token 신규 페이지 (수료증·강의확인서 조회)
- token으로 issued_certificates 조회 → recipient_name·cert_number·issue_date 표시
- pdf_url 있으면 다운로드 버튼 / 없으면 jspdf+html2canvas로 즉석 생성 (Q4)
- 직인 이미지 (certificate_templates.seal_image_url, seals 버킷) 적용

### 2-C. /apply/:programId 홍보 페이지 강화
박경수님 명세 "홍보 페이지" — 현재 V2 ApplyPage는 폼만. 강화 항목:
- 프로그램 소개 (programs.description·notice·goal_text)
- 강사진 카드 (curriculum_staff 강사·FT)
- 커리큘럼 미리보기 (program_curriculum)
- 신청 폼 (기존)

→ Stage 3-B-2-① ClientSharePage 패턴 일부 차용 가능 (BasicInfoItem·CurriculumItem·InstructorsItem)

### 2-D. /log/:token, /recruit/:token
V2 기존 그대로 유지 (격차 없음).

---

## 섹션 3 — 내부 관리 탭 (Q2 결정 필요)

### 옵션 A — 7탭 → 11탭 (4탭 추가)
개요 / 커리큘럼 / 강사·교육생 / **출석** / 일지 / **수료증** / 결과·만족도 / **신청** / **모집** / 외부공유 / 결과보고서
→ ⚠️ 탭 너무 많음 (11개), 모바일·작은 화면에서 가로 스크롤 부담

### 옵션 B — 7탭 유지 + 기존 탭 강화 (제 추천)
- **출석·일지** 탭 → **출석·일지·수료증** 으로 확장 (3 sub 섹션)
- **강사·교육생** 탭 → **강사·교육생·신청·모집** 으로 확장 (4 sub 섹션)
→ ✅ 기존 사용자 멘탈 모델 유지, sub 영역으로 확장

### 옵션 C — 외부 폼 1탭 + sub 4 탭
- 신규 "외부 폼" 7탭 → 8탭, 안에 출석/수료증/신청/모집 4 sub
→ ⚠️ "외부 폼"은 사이드바와 의미 중복. 박경수님 명세 "프로그램 상세 탭 추가"와도 결 다름

**제 추천: 옵션 B** — 7탭 유지하면서 기존 탭 안에 sub 섹션 추가

---

## 섹션 4 — 자동 판정·중복 방지 (Q3 결정 필요)

### 4-A. 출석률 80% 이상 → 수료 자동 판정
**계산 단위**: 학생별 (attendance_records.attendee_role='student')
- 분모: program_id의 모든 attendance_sessions 수
- 분자: 해당 학생이 attendance_records에 등록된 (status='O' 또는 NULL이지만 check_in_at 있음) 세션 수
- 출석률 = 분자 / 분모

### 4-B. 자동 판정 트리거 위치 (Q3)
- 옵션 X: **수료증 탭 [일괄 발급] 버튼 클릭 시** 한 번에 계산 (배치)
- 옵션 Y: 매 attendance_records INSERT 시 즉시 재계산 (DB trigger 또는 클라 호출)
- 옵션 Z: cron / Edge Function (V2 Realtime 미도입이라 무리)

**제 추천: 옵션 X** — 일괄 발급 버튼 시점 계산. 박경수님이 검토 후 발급. 수동 통제 명확.

### 4-C. 출석 status — V2엔 컬럼 없음
박경수님 명세 O / △ / X. V2엔 check_in_at 시점만. 처리 방법:

| 옵션 | 동작 | 추천 |
|---|---|---|
| A | `attendance_records.status` 컬럼 추가 (text, O/△/X) | ✅ **추천** — 박경수님 명세 그대로 |
| B | check_in_at 시점 기반 자동 판정 (예: 시작 후 10분 내 = O, 30분 내 = △, 그 외 = X) | ⚠️ 정확도 떨어짐 |
| C | session_no 단위 카운트만 사용 (O/X 이진) | ❌ 명세 △ 누락 |

**제 추천: 옵션 A**

### 4-D. 중복 제출 방지
- attendance_records: UNIQUE (session_id, attendee_phone) 제약 + 클라이언트 status 체크
- participant_applications: ✅ 이미 UNIQUE (program_id, phone) 적용됨
- recruit_applications: ✅ 이미 UNIQUE (form_id, phone) 적용됨

→ attendance_records UNIQUE 제약 점검 필요 (V2 schema 확인)

### 4-E. 주민번호 마스킹
- 신청 폼에서 입력 받은 주민번호 → 클라이언트에서 앞 6자리만 추출 → `id_number_masked` 컬럼에 저장
- DB에는 절대 원본 저장 X

---

## 섹션 5 — 신규/수정 파일 명세

### 5-A. 추가 SQL (Q1 옵션 X 채택 시)

```sql
-- 1) attendance_sessions: 역할별 토큰 3개
ALTER TABLE attendance_sessions
  ADD COLUMN IF NOT EXISTS student_token   TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  ADD COLUMN IF NOT EXISTS instructor_token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  ADD COLUMN IF NOT EXISTS ta_token         TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex'),
  ADD COLUMN IF NOT EXISTS session_no       INTEGER;
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_student_token   ON attendance_sessions(student_token);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_instructor_token ON attendance_sessions(instructor_token);
CREATE INDEX IF NOT EXISTS idx_attendance_sessions_ta_token         ON attendance_sessions(ta_token);

-- 2) attendance_records: status 컬럼 추가
ALTER TABLE attendance_records
  ADD COLUMN IF NOT EXISTS status TEXT NOT NULL DEFAULT 'O'
    CHECK (status IN ('O', '△', 'X'));
-- UNIQUE 점검
CREATE UNIQUE INDEX IF NOT EXISTS uniq_attendance_records_session_phone
  ON attendance_records(session_id, attendee_phone);

-- 3) issued_certificates: token 추가
ALTER TABLE issued_certificates
  ADD COLUMN IF NOT EXISTS token TEXT UNIQUE DEFAULT encode(gen_random_bytes(16),'hex');
CREATE INDEX IF NOT EXISTS idx_issued_certificates_token ON issued_certificates(token);

-- 4) issued_certificates RLS — 외부 /cert/:token 조회 허용
DROP POLICY IF EXISTS "public_read_by_token" ON issued_certificates;
CREATE POLICY "public_read_by_token" ON issued_certificates FOR SELECT USING (true);
```

### 5-B. 신규 파일 (옵션 X·B·A 채택 시)

**외부 페이지**:
| 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `pages/public-cert/CertViewPage.tsx` (신규) | ~200 | /cert/:token 외부 — 수료증 표시·PDF 다운로드 |
| `pages/public-attend/AttendCheckPage.tsx` (수정) | +50 | 역할 자동 판별 (3 토큰 매칭) |
| `pages/public-apply/ApplyPage.tsx` (수정) | +120 | 홍보 영역 (소개·강사·커리큘럼) 추가 |

**내부 관리 (옵션 B — 7탭 유지 + sub 섹션)**:
| 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `programs/detail/AttendanceLogTab.tsx` (강화) | 172 → ~300 | 출석 sub + 일지 sub + 수료증 sub 3 sub 섹션 |
| `programs/detail/attendance/SessionManagePanel.tsx` (신규) | ~250 | 세션 생성·QR·링크·O/△/X 매트릭스 |
| `programs/detail/attendance/CertificateIssuePanel.tsx` (신규) | ~280 | 출석률 자동 산출 + 일괄 발급 |
| `programs/detail/StaffStudentsTab.tsx` (강화) | 214 → ~340 | 강사·교육생 sub + 신청 sub + 모집 sub 4 sub |
| `programs/detail/applications/ApplicationsPanel.tsx` (신규) | ~200 | 신청 목록·상태 |
| `programs/detail/applications/RecruitsPanel.tsx` (신규) | ~200 | 모집 지원자 목록·합격/불합격 |
| `programs/detail/programDetailUtils.ts` (강화) | 355 → ~440 ⚠️ | fetch 함수 추가 — 분리 검토 |

⚠️ programDetailUtils.ts 400줄 초과 위험 → `attendanceUtils.ts` / `certificateUtils.ts` 분리 추천

**유틸·라이브러리**:
| 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `lib/certificatePdf.ts` (신규) | ~180 | jspdf·html2canvas 기반 PDF 생성 |
| `lib/attendanceCalculator.ts` (신규) | ~120 | 출석률 자동 계산·수료 판정 |

### 5-C. 합계 추정
- 외부 페이지: ~370줄 (3 파일 신규/수정)
- 내부 관리: ~1,570줄 (5 신규 + 2 강화)
- 유틸: ~300줄
- **총 ~2,240줄 / 12 신규 + 4 수정**

→ Q5 분할 결정에 따라 1~4 commit

---

## 섹션 6 — V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | StaffStudentsTab 340줄 / AttendanceLogTab 300줄 — 위험 시 sub 패널 추가 분리 | ⚠️ 분할 필요 |
| V-2 catch + 한글 | `console.error('[step-11/<area>] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown | nested join inline anonymous type | ✅ |
| V-4 한글 메시지 | 모두 한글 | ✅ |
| V-5 cancelled 가드 | 모든 useEffect 비동기 fetch | ✅ |
| V-6 직접 fetch | 각 sub 패널 자체 fetch | ✅ |
| V-7 디자인 토큰 | violet/orange/cyan/emerald/rose 5톤 | ✅ |

---

## 섹션 7 — 박경수님 의사결정 5개 (Q1~Q5)

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| **Q1** | **schema 격차 처리 (3 토큰·status·token·session_no)** | ✅ **ALTER TABLE 4건 SQL 박경수님 직접 실행** — 박경수님 명세 그대로 가는 게 가장 정합. 섹션 5-A SQL 일괄 |
| **Q2** | **내부 관리 탭 위치** — A(11탭) / **B(기존 7탭 강화 + sub)** / C(외부 폼 1탭) | ✅ **옵션 B** — 사용자 멘탈 모델 유지. AttendanceLogTab + StaffStudentsTab 안에 sub 섹션 |
| **Q3** | **출석 status & 수료 자동 판정** | ✅ **A안**: status 컬럼 추가 + **X안**: 수료증 탭 [일괄 발급] 시점 자동 계산 (배치) |
| **Q4** | **수료증 PDF 발급 방식** | ✅ **즉석 생성** (jspdf+html2canvas) — pdf_url 캐시 X. 다운로드 시점에 매번 생성. 향후 STEP-PDF-CACHE에서 캐싱 |
| **Q5** | **Stage 분할** | ✅ **3 commit 분할**: ① 외부 페이지 3종(/cert 신규 + /attend 강화 + /apply 홍보) ② 출석·수료증 내부 (AttendanceLogTab 확장) ③ 신청·모집 내부 (StaffStudentsTab 확장) — 각 60~90분 |

---

## 섹션 8 — 작업 순서 (승인 후)

### Stage 11-① — 외부 페이지 (60~90분)
1. **Q1 SQL 박경수님 직접 실행** (4 ALTER TABLE)
2. `migrations/20260523_step_11_columns.sql` 보존본
3. `types/database.ts` — AttendanceSession·AttendanceRecord·IssuedCertificate 보강
4. `lib/certificatePdf.ts` 신규 (jspdf 기반)
5. `pages/public-cert/CertViewPage.tsx` 신규 (/cert/:token)
6. `pages/public-attend/AttendCheckPage.tsx` 강화 (3 토큰 분기)
7. `pages/public-apply/ApplyPage.tsx` 강화 (홍보 영역)
8. App.tsx — `/cert/:token` 라우트 추가
9. tsc -b → V-1~V-7 → 보고서 → commit

### Stage 11-② — 출석·수료증 내부 (60~90분)
1. `lib/attendanceCalculator.ts` 신규 (출석률 계산)
2. `programs/detail/attendance/SessionManagePanel.tsx` 신규
3. `programs/detail/attendance/CertificateIssuePanel.tsx` 신규
4. `AttendanceLogTab.tsx` → 3 sub 섹션 (출석·일지·수료증)
5. `programDetailUtils.ts` 분리 (`attendanceUtils.ts` / `certificateUtils.ts`)
6. tsc -b → V-1~V-7 → 보고서 → commit

### Stage 11-③ — 신청·모집 내부 (60~90분)
1. `programs/detail/applications/ApplicationsPanel.tsx` 신규
2. `programs/detail/applications/RecruitsPanel.tsx` 신규
3. `StaffStudentsTab.tsx` → 4 sub 섹션 (강사·교육생·신청·모집)
4. tsc -b → V-1~V-7 → 보고서 → commit

**롤백**: 각 commit 별도 revert. SQL revert만 별도.

---

## 섹션 9 — 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q5 결정 → 그 후 Stage 11-① 코드 진입

**Q1 (4 ALTER TABLE) 진행 시 SQL** — 섹션 5-A 전체. 박경수님이 Supabase Dashboard에서 직접 실행하시고 결과 알려주시면 코드 진입할게요.

특히 박경수님이 결정해 주실 핵심:
- **3 토큰 vs 1 토큰**: 박경수님 명세 3 토큰이 ✅면 SQL 진행
- **status 컬럼**: 'O', '△', 'X' enum이 ✅면 SQL 진행
- **수료 자동 판정 시점**: 배치(일괄 발급 버튼) vs 실시간(매 INSERT 시)

다른 의견 있으면 알려주세요.
