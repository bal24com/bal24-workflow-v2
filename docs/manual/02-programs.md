# 02. 프로그램 · 커리큘럼 · 강사 · 교육생

## 프로그램 (`/programs`)

### 페이지 구조

| 영역 | 기능 |
|---|---|
| 상단 | [+ 등록] + [+ 일괄 등록] + 검색 |
| 목록 | 프로그램 카드 (이름·유형·상태·기간·장소·인원) |
| 클릭 | `/programs/:id` 상세 (탭 14+개) |

### 14종 유형 (`program_type` 컬럼, 영문 키 + 한글 라벨)

| 영문 키 | 한글 라벨 |
|---|---|
| `education` | 교육 |
| `support_grant` | 지원·보조금 |
| `mentoring` | 멘토링 |
| `event` | 행사 |
| `experience` | 체험 |
| `market` | 장터·축제 |
| `marketing` | 홍보·마케팅 |
| `delivery` | 납품·운영 |
| `planning` | 기획·컨설팅 |
| `recruitment` | 모집·선정 |
| `fieldwork` | 현장 답사·조사 |
| `report` | 보고서·연구 |
| `research` | 연구·분석 |
| `general` | 일반 |

`application_type` 으로 `'open' / 'evaluation'` 구분.

### 상세 페이지 — 탭 구조

| 탭 | 컴포넌트 | 핵심 |
|---|---|---|
| 개요 | `OverviewTab` | **흐름도 카드 (제안→계약→운영→종료)** + KPI + 빠른 액션 |
| 커리큘럼 | `CurriculumTab` | 회차별 등록 + 강사 배정 (`program_curriculum` + `curriculum_staff`) |
| 강사 | `AssignmentTab` | 강사 초빙 (`instructor_invitations`) + 토큰 발급 |
| 멘토링 | `MentoringTab` | `mentoring_assignments` + 멘토 일지 + 강사료 |
| 교육생 | `ApplicationTab` + `ParticipantManageTab` | 신청자 검토 + 승인 → 참여자 |
| 출석 | `AttendanceLogTab` | 세션별 출석 + 외부 토큰 |
| 일지 | (외부 일지·강의 일지·멘토링 일지 통합) |
| 평가 | `EvaluatorModal` | 평가위원 등록·평가 진행 |
| 강사료 | `StaffFeeTab` | 강사료 정산 + PDF (`payroll_expenses` 연동) |
| 정산 요청 | `PaymentRequestTab` | 견적서 → 지급요청 변환 |
| 결과보고 | `ReportBuilderTab` + `ReportReviewTab` | 성과보고서 작성·검토 (`performance_reports`) |
| 문서 | `docs/*` | 출석 import·결과물·최종보고 AI |

### 신규 등록 흐름

```
1. [+ 등록]
2. 기본정보 — 이름·유형·신청방식·기간·장소
3. 보조금 사용 여부 (사용 시 grant_budget 입력)
4. 신청 방식 (open=공개모집 / evaluation=평가선발)
5. 저장
   → /apply/:programId 자동 토큰 발급
   → 흐름도 카드에 '제안' 단계로 시작
```

---

## 커리큘럼 (`CurriculumTab`)

### 두 가지 모드

| 모드 | 의미 |
|---|---|
| `planned` (제안) | 계약 전 최초 안. 기본값 |
| `actual` (실제 운영) | 실제 진행된 회차 |

같은 차시도 두 행 둘 수 있음 — 비교용.

### 강사 배정 (`curriculum_staff`)

차시 행 → 우측 [강사 배정] → 강사 검색 → 선택. `staff_pool_id` 또는 `profile_id` 로 연결.

### 자주 하는 일

| 상황 | 어디서 |
|---|---|
| 차시 일괄 등록 | [엑셀 붙여넣기] (Ctrl+V 표 데이터) |
| 강사 변경 | 차시 행 → 강사 칸 → 인라인 편집 |
| 교안 업로드 | 차시 행 → [자료] → 드래그앤드롭 |

---

## 강사 (`AssignmentTab` → `instructor_invitations`)

### 초빙 흐름

```
1. [+ 강사 초빙]
2. 기존 staff_pool 검색 또는 직접 입력 (이름·소속·연락처)
3. 역할 (강사·TA·코디네이터·멘토)
4. 저장 → portal_token 자동 발급
5. [링크 복사] → 강사에게 카톡·이메일 전송
6. 강사가 `/invitation/:token` 진입 → 수락 → status='accepted'
```

### 자주 하는 일

| 상황 | 어디서 |
|---|---|
| 초빙 링크 재발급 | 강사 행 → [...] → [링크 재발급] |
| 강사 본인 정보 수정 | 강사 본인이 `/portal` 로그인 → [프로필] 탭 |
| PIN 초기화 | `/experts` → 강사 → [PIN 초기화] (ADMIN 만) |

---

## 멘토링 (`MentoringTab`)

### 구조

```
mentoring_assignments  ── 멘토 ↔ 멘티 ↔ 프로그램 연결
       │
       └── mentoring_logs (일지)
              ├── photo_urls JSONB (사진)
              ├── mentor_signature_url (서명)
              └── status: draft / submitted / approved / rejected
```

### 흐름

```
1. 멘토 배정 (PM)
   - 멘토 선택 (staff_pool 또는 profiles)
   - 멘티 선택 (program_participants 다중)
   - 멘토 ↔ 멘티 매칭
2. 멘토가 강사 포털 (`/portal`) 로그인
3. [멘토링] 탭 → 멘티 chip 클릭 → 일지 작성 폼
4. 사진 첨부 + 본문 입력 + 서명 → 제출
5. PM 가 [승인] 또는 [반려]
6. 승인 후 PDF 다운로드 가능
```

### 자주 하는 일

| 상황 | 어디서 |
|---|---|
| 일지 사진 안 보임 | [99-troubleshooting ③](./99-troubleshooting.md#③-storage-사진이-일지-조회pdf-에서-안-보임) |
| PDF 백지 | [99-troubleshooting ④](./99-troubleshooting.md#④-pdf-다운로드-백지-멘토링-일지) |
| 멘토 → 멘티 매칭 보기 | 멘토 카드 펼침 → 담당 멘티 chip |
| AI 초안 사용 | 일지 작성 폼 → [✨ AI 초안] (mentoring-log-ai) |

---

## 교육생 (`ApplicationTab` + `ParticipantManageTab`)

### 흐름

```
1. /apply/:programId 외부 토큰 → 신청자 제출 (개인정보 동의 필수)
   → participant_applications 행 생성 (status='검토중')
2. PM /applications 또는 프로그램 상세 → [신청 관리]
3. 검토 후 [승인] 클릭
   → status='승인' + program_participants 자동 생성
4. 출석률·결과물 등 자동 집계
```

### 자주 하는 일

| 상황 | 어디서 |
|---|---|
| 신청자 일괄 승인 | 신청 관리 → 체크박스 다중 선택 → [일괄 승인] |
| 출석 import | 프로그램 → 문서 → 출석 import (엑셀) |
| 수료증 발급 | `/certificates` → 템플릿 선택 → 발급 |

### 외부 폼 — 박경수님 수동 발급

특수 외부 폼 (여수 해양·창업 사전 수요조사 등). `/yeosu-marine-startup-survey/:token` 형태. 박경수님이 외부 공유 시 토큰 직접 발급.

---

## AI 자동 생성 기능

| 기능 | Edge Function | 어디서 |
|---|---|---|
| 멘토링 일지 초안 | `mentoring-log-ai` | 강사 포털 → 멘토링 → AI 파일 모달 |
| 강의 일지 초안 | `curriculum-log-ai` (2026-05-28 신규) | 강사 포털 → 강의일지 폼 → [✨ AI 초안] |
| 최종보고서 초안 | `ai-chat` 호출 | 프로젝트 → 문서 → [최종보고 AI] |
| 명함 인식 | Claude API 직접 | 고객사·전문가 등록 |
| 견적서 분석 | `ai-chat` | 견적 탭 → 파일 업로드 |
| 컨소시엄 자동채우기 | `consortium-autofill` | 컨소시엄 등록 → 문서 업로드 |
| 설문 분석 | `analyze-survey` | 설문 결과 → AI 분석 |

ANTHROPIC_API_KEY 등록 필수 (Edge Functions → Secrets).
