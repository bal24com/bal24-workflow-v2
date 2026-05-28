# 00. 시스템 개요

## 사이드바 구조 — 8그룹

| 그룹 | 메뉴 | 라우트 | 핵심 역할 |
|---|---|---|---|
| **홈** | 홈 | `/home` | KPI 대시보드 + 미션·비전 + 단계별 진행 + 태스크 알림 |
| | 일정 | `/schedule` | 캘린더 (프로그램·태스크 2종만, 공휴일 제외) |
| **업무** | 프로젝트 | `/projects` | 단독 용역·사업 (계약 자동 생성) |
| | 컨소시엄 | `/consortium` | 다기관 협업 (의뢰기관·운영사·참여사) |
| | 프로그램 | `/programs` | 교육·캠프·행사·세미나·멘토링 |
| **자원** | 고객사 | `/clients` | 주관기관·수혜기관·참여사·거래처 (한글 4종) |
| | 전문가 | `/experts` | 외부 강사·컨설턴트·멘토 (인력풀) |
| | 공유 | `/shares` | 외부 토큰 링크 통합 뷰 |
| | 출석체크 | `/attendance` | 세션별 출석 + 외부 체크인 토큰 |
| | 수료증 | `/certificates` | 수료증·강의확인서 PDF 발급 |
| | 일지 | `/activity-logs` | 통합 일지 (활동·멘토링·강의) |
| | 폼 관리 | `/forms` | 외부 공개 폼 |
| | 신청 관리 | `/applications` | 교육생 신청자 검토 |
| | 모집 공고 | `/recruit-manage` | 강사·TA 모집 |
| | 포털 | `/portals` | 고객 문서 포털 발급 |
| **경영** | 수입 | `/income` | 계약·청구·수금 |
| | 지출 | `/expense` | 외부비용 집행 |
| | 증빙 | `/receipts` | 세금계산서·영수증 |
| | 정산 | `/settlements` | 5단계 정산 워크플로우 |
| | 외주·급여 | `/payroll` | 강사료·외주비 (`payroll_expenses`) |
| | 직원 급여 | `/payroll-mgmt` | 내부 직원 급여명세서·지출결의서 |
| | 회계검토 | `/accounting-portal` | 회계사무소 외부 검토 |
| **보고** | 리포트 | `/reports` | 재무 리포트 (KPI·차트) |
| **팀** | 팀원 | `/members` | 내부 임직원 관리 |
| | 설정 | `/admin` | 시스템 룰·태그·필드 관리 (ADMIN 전용) |
| | AI | `/ai` | AI 어시스턴트 |
| | 내 페이지 | `/mypage` | 본인 계정·서명·도장 |

## 권한 (5종)

| 역할 | 권한 |
|---|---|
| `ADMIN` | 전체 접근 + 설정 메뉴 |
| `PM` | 담당 프로젝트·프로그램 생성·수정·삭제 |
| `STAFF` | 배정된 태스크·일지 조회·수정 |
| `FINANCE` | 수입·지출·증빙 전체 (PM 겸임 가능) |
| `PARTNER` | 컨소시엄 포털만 접근 (외부 참여사) |

- **복수 역할 가능** (`['FINANCE', 'PM']`)
- `profiles.role` 컬럼 (소문자 저장) — 권한 체크는 `hasRole(role, 'pm')`

## 외부 토큰 라우트 — 인증 불필요

| 라우트 | 누가 사용 | 어디서 발급 |
|---|---|---|
| `/portal` | 강사 본인 PIN 로그인 | (자동) |
| `/checkin/:token` | 교육생 출석 체크 | 출석 세션 등록 시 자동 |
| `/attend/:token` | 외부 출석 체크 | 동상 |
| `/form/:token` | 외부 폼 응답자 | `/forms` |
| `/portal/:token` | 고객 (서류 제출) | `/portals` |
| `/invitation/:token` | 강사 (초빙 수락) | 프로그램 상세 → 강사 |
| `/apply/:programId` | 교육생 신청 | 프로그램 생성 시 자동 |
| `/recruit/:token` | 강사·TA 지원자 | `/recruit-manage` |
| `/log/:token` | 외부 일지 작성자 | 일지 → 외부 공유 |
| `/accounting-review/:token` | 회계사무소 검토자 | `/accounting-portal` |
| `/audit/:token` | 감사용 외부 검토 | 별도 발급 |
| `/share/client/:token` | 고객사 결과물 공유 | `/shares` |
| `/share/student/:token` | 교육생 결과물 공유 | `/shares` |
| `/share/expert/:token` | 강사 결과물 공유 | `/shares` |
| `/yeosu-marine-startup-survey/:token` | 여수 사전 수요조사 | 박경수님 수동 발급 |
| `/school-portal/:token` | 수혜학교 PM 발급 | `/admin` → 포털 발급 |
| `/team-portal/:token` | 학교 동아리 팀 | 같음 (학교 포털 안에서) |
| `/supervisor-portal/:token` | 교육지원청 | 같음 |
| `/survey/:token` | 학교·팀·전체 설문 | 같음 |

## 데이터 흐름 — 핵심

```
clients ──────────────┐
staff_pool ────────┐  │
                   ▼  ▼
consortiums ──→ projects ──→ tasks
                  │
                  ├──→ programs ──→ curriculum
                  │         │        ├── instructor_invitations (강사 초빙)
                  │         │        ├── program_participants (교육생)
                  │         │        ├── attendance_sessions·records
                  │         │        ├── mentoring_assignments·logs (멘토링)
                  │         │        ├── curriculum_logs (강의 일지)
                  │         │        ├── performance_reports (성과 보고서)
                  │         │        └── participant_applications (신청자)
                  │
                  ├──→ income_contracts (계약 자동 생성)
                  │         └── payroll_expenses (외주·강사료)
                  │         └── receipts (증빙)
                  │
                  └──→ project_reports (결과보고서)
```

## 디자인 시스템

- **메인 컬러**. 바이올렛 `#7C3AED`
- **상태 컬러**. 주황 (`#F97316`) · 민트 (`#06B6D4`) · 청록 (`#0891b2`) · 회색 (`#64748B`)
- **카드 radius**. 12~16px
- **모달**. 백드롭 mousedown 시작 시에만 닫힘 (드래그 닫힘 방지)
- **토스트**. 우하단 (`useToast()` 훅)
- **로딩**. `Loader2` 스피너
- **이모지 룰**. UI 에서 이모지 자제, 박경수님 명시 요청 시에만 사용

## 핵심 단축키

| 키 | 기능 |
|---|---|
| `Ctrl+K` | 커맨드 팔레트 (전체 검색, 일부 페이지) |
| `Ctrl+V` | 이미지·PDF 붙여넣기 업로드 (PortalPhotoUpload·FileDropZone) |
| `Ctrl+Shift+R` | 강제 새로고침 (Netlify 신규 배포 반영) |
| `F12` | 개발자도구 (Console·Network 로그) |

## 메뉴별 진입 시 자주 확인할 것

| 메뉴 | 진입 시 확인 |
|---|---|
| 홈 | KPI 6개 + 단계별 진행 + 태스크 알림 새로 떴는지 |
| 프로젝트 | 라이프사이클 5탭 — 자동/제안/계약/진행/종료 |
| 컨소시엄 | 참여사 지분율 합계 = 100% 인지 |
| 프로그램 | 개요 흐름도 카드 (제안→계약→운영→종료) |
| 강사 포털 | 우상단 강사명·소속 + 사이드바 5탭 (개요·멘토링·강의·일지·자료·강사료) |
| 외주·급여 | 통계 4종 (총건수·운영비 대기/완료·인건비 대기/완료) |
| 증빙 | 영수증 미수합 일괄 첨부 |
