# 03. 외부 포털 7+종 운영

## 외부 토큰 전체 지도

| 포털 | URL 패턴 | 누가 사용 | 어디서 발급 | 핵심 테이블 |
|---|---|---|---|---|
| **강사 포털** | `/portal` | 강사 (이름+PIN 로그인) | `staff_pool.portal_pin_hash` | `staff_pool` |
| **강사 초빙** | `/invitation/:token` | 강사 (수락 전) | 프로그램 → 강사 탭 | `instructor_invitations` |
| **고객 문서 포털** | `/portal/:token` | 고객사 담당자 | `/portals` → [신규 발급] | `project_portals` + `portal_items` |
| **수혜학교 포털** | `/school-portal/:token` | 학교 PM | `/admin` → [포털 발급] | `project_portals` (scope='school') |
| **학교 동아리팀 포털** | `/team-portal/:token` | 학교 내 동아리·담당 | 학교 포털 안 → 팀 발급 | `project_portals` (scope='team') |
| **교육지원청 포털** | `/supervisor-portal/:token` | 교육지원청 | `/admin` 또는 `/portals` | `project_portals` (scope='supervisor') |
| **설문 외부 폼** | `/survey/:token` | 학교·팀·전체 응답자 | 포털 안 → 설문 발급 | `surveys` |
| **교육생 신청** | `/apply/:programId` | 신청자 | 프로그램 생성 시 자동 | `participant_applications` |
| **출석 체크인** | `/checkin/:token` · `/attend/:token` | 교육생·강사 | 출석 세션 등록 시 자동 | `attendance_sessions` |
| **일지 외부 작성** | `/log/:token` | 외부 작성자 | 일지 → [외부 공유] | `activity_logs` |
| **모집 폼** | `/recruit/:token` | 강사·TA 지원자 | `/recruit-manage` | `recruit_forms` |
| **외부 폼** | `/form/:token` | 응답자 | `/forms` | `public_forms` |
| **회계사무소 포털** | `/accounting-review/:token` | 회계사무소 | `/accounting-portal` | `accounting_reviews` |
| **결과물 공유** | `/share/client(student/expert)/:token` | 고객·교육생·강사 | `/shares` | `consortium_links` 등 |
| **감사 포털** | `/audit/:token` | 감사 담당 | 별도 발급 | (별도) |
| **여수 사전 수요조사** | `/yeosu-marine-startup-survey/:token` | 응답자 | 박경수님 수동 | (이벤트 한정) |

---

## ⭐ 강사 포털 (`/portal`)

### 진입 흐름

```
1. 강사가 `/portal` 접속
2. 이름 입력 → 6자리 PIN 입력 (PinInputBlock)
3. verify-staff-pin Edge Function 호출
   → portal_pin_hash 비교 (bcrypt)
   → 성공 시 staff_pool 행 반환
4. /staff-portal/:staffId 로 이동 (메인 화면)
```

### 사이드바 (강사 본인 시점)

| 탭 | 컴포넌트 | 역할 |
|---|---|---|
| 개요 | `StaffOverviewTab` | 인사말 + 최근 참여 프로그램 카드 |
| 멘토링 | `StaffMentoringTab` | 담당 멘티 chip + 일지 작성 폼 |
| 강의 | `StaffLectureTab` | 담당 차시 테이블 + 일지 빠른 작성 |
| 일지 | `StaffLogTab` | 멘토링 일지 / 강의일지 서브탭 |
| 자료 | `StaffMaterialsTab` | 프로필 / 강사료 / 기타 서브탭 |
| 일정 | `StaffScheduleTab` | 본인 일정 |

### 강사가 자주 하는 일

| 상황 | 어디서 |
|---|---|
| 일지 작성 | [일지] 탭 → 차시 클릭 → 인라인 폼 (자동저장 2초) |
| 사진 첨부 | 폼 안 PortalPhotoUpload (드래그·붙여넣기·카메라) |
| 서명·도장 | [자료] → 프로필 → 서명 업로드 → 자동 반영 |
| AI 초안 | 일지 폼 → [✨ AI 초안] 버튼 |
| PDF 다운로드 | [강사료] 서브탭 → [PDF] |
| PIN 변경 | 우상단 [정보 수정] → PIN 6자리 입력 |

### PM 시점 발급·관리

| 상황 | 어디서 |
|---|---|
| 강사 등록 + PIN 발급 | `/experts` → [+ 등록] → PIN 자동 발급 |
| PIN 초기화 | `/experts` → 강사 행 → [PIN 초기화] (ADMIN) |
| 일지 승인·반려 | 프로그램 → 멘토링 → 일지 카드 → [승인]/[반려] |
| 일지 PDF | 같은 위치 → [PDF] |
| 강사료 정산 | 프로그램 → 강사료 → 개별·일괄 PDF |

⚠️ **PIN 잠금** — 5회 이상 실패 시 `pin_locked_until` 시간 자동 설정. SQL 로 해제 (99-troubleshooting ⑤).

---

## 수혜학교 + 동아리팀 + 교육지원청 — 3레이어 (2026-05-28)

### 구조

```
교육지원청 (1)
  └── 수혜학교 (다수)
       └── 동아리팀 (다수, 학교 안)
            └── 멘토 (다수, 팀 안)
            └── 멘티 (다수)
```

### 설문 3 레이어

| `target_scope` | 발급 위치 | 응답자 |
|---|---|---|
| `all` | 교육지원청 | 모든 학교·팀 |
| `school` | 학교 포털 | 그 학교 안 모든 팀 |
| `team` | 팀 포털 | 그 팀의 멘토·멘티 |

### 발급 흐름

```
1. PM /admin 또는 /portals 진입
2. [포털 발급] 모달
3. scope 선택 (school / team / supervisor)
4. 대상 선택 (학교명 / 팀명 / 교육지원청명)
5. portal_intro JSONB (소개·연락처) 입력
6. 저장 → 토큰 자동 발급
7. [QR 카드 다운로드] 또는 [이메일 발송 미리보기]
8. 외부에 전달
```

### 포털 발급 컴포넌트 (PM 측)

| 컴포넌트 | 역할 |
|---|---|
| `PortalIssueSection` | 발급 진입 카드 |
| `PortalIssueModal` | 발급 모달 (대상·소개) |
| `PortalQRCard` | QR + URL 인쇄용 카드 |
| `PortalMailPreview` | 이메일 본문 미리보기 |
| `PortalIntroEditor` | portal_intro JSONB 편집 |

---

## 고객 문서 포털 (`/portal/:token`)

### 흐름

```
1. PM 프로젝트 상세 → [포털] 탭 → [+ 발급]
2. 템플릿 선택 (계약서 요청·서류 제출 등)
3. portal_items 자동 생성
4. [링크 복사] → 고객에게 전달
5. 고객 진입 → 파일 업로드 / 폼 응답
   → portal_responses 저장
6. PM 상태 자동 갱신
```

### 포털 아이템 7종 (`PortalItemType`)

| 타입 | 의미 |
|---|---|
| `file_download` | 파일 다운로드 (고객이 내려받음) |
| `file_upload` | 파일 업로드 (고객이 올려줌) |
| `feedback` | 의견 입력 |
| `approval` | 승인·반려 |
| `auto_data` | 자동 채움 데이터 |
| `tax_invoice` | 세금계산서 요청 |
| (그 외) | |

---

## 회계사무소 포털 (`/accounting-portal`)

회계사무소가 외부에서 수입·지출 행을 검토하고 코멘트 다는 외부 포털. 박경수님이 토큰 발급 → 회계사 진입 → 행별 [확인] / [수정 요청].

---

## 외부 토큰 보안 룰

- 토큰은 **UUID v4** (`gen_random_uuid()`)
- RLS — anon SELECT 만 허용 (테이블별 필요한 행만)
- INSERT/UPDATE 는 토큰 검증 거친 Edge Function 또는 SECURITY DEFINER 함수로
- 만료일 (`expires_at`) 설정 권장
- 사용 이력 (`portal_responses`) 자동 기록

---

## 자주 하는 운영 작업

| 상황 | 어디서 |
|---|---|
| 토큰 재발급 | 각 포털 발급 화면 → [재발급] |
| 만료된 포털 정리 | (수동) — 별도 운영 작업 |
| 응답 통계 | 포털 카드에 응답률·미응답 카운트 |
| 강사 PIN 분실 | `/experts` → [PIN 초기화] → 새 PIN 안내 |
