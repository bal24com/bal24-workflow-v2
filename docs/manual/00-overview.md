# 00. 시스템 개요

## 사이드바 — 업무 프로세스 5단계 + 시스템 (2026-05-29)

> 그룹 순서 = 사업 진행 순서. 위에서 아래로 내려가면 사업이 진행돼요.

| 그룹 | 메뉴 | 라우트 | 핵심 역할 |
|---|---|---|---|
| **🏠 홈** | 대시보드 | `/home` | KPI + 미션·비전 + 단계별 진행 + 태스크 알림 |
| | 달력 | `/schedule` | 캘린더 (프로그램·태스크 2종) |
| **① 수주·기획** | 프로젝트 | `/projects` | 단독 사업 (계약 자동 생성) |
| | 컨소시엄 | `/consortium` | 다기관 협업 (의뢰기관·운영사·참여사) |
| | 수입·계약 | `/contracts` | 라이프사이클 5탭 (자동·제안·계약·진행·종료) |
| | 거래처 | `/clients` | 주관기관·수혜기관·참여사·거래처 (한글 4종) |
| **② 사업 준비** | 프로그램 | `/programs` | 교육·캠프·행사·세미나·멘토링 (14종 유형) |
| | 전문가 | `/experts` | 외부 강사·컨설턴트·멘토 (인력풀) |
| **③ 사업 운영** | 강사 포털 | `/portal` ↗ | 강사 본인 로그인 (외부 새 탭) |
| | AI 초안 | `/ai` | AI 어시스턴트 (Claude API) |
| **④ 정산·보고** | 외주·급여 | `/payroll` | 강사료·외주비 (`payroll_expenses`) |
| | 재무 대시보드 | `/reports` | KPI·차트·미수금·미지급 |
| **⚙️ 시스템** | 팀원 관리 | `/members` | 내부 임직원 관리 |
| (ADMIN) | 휴지통·관리 | `/admin` | 휴지통 + 시스템 룰·태그·필드 관리 |

### 역할별 사이드바 분기

| 역할 | 사이드바 구성 |
|---|---|
| `admin` | 전체 6그룹 + 관리 그룹 |
| `finance` | 홈 / 재무 (4메뉴) / 도구 — 별도 단순 구성 |
| `partner` | 홈 / 사업 / 도구 — 외부 참여사용 |
| `member` | 내 사업 (홈·일정·사업보고) — 수혜기업용 |
| 그 외 | 전체 6그룹 (팀원 관리 메뉴 제외) |

## 사이드바에 없지만 라우트는 살아있는 메뉴 (직접 URL 진입)

| 메뉴 | 라우트 | 언제 |
|---|---|---|
| 출석체크 | `/attendance` | 출석 세션 관리 |
| 수료증 | `/certificates` | 수료증 발급 |
| 일지 | `/activity-logs` | 통합 일지 |
| 폼 관리 | `/forms` | 외부 공개 폼 |
| 신청 관리 | `/applications` | 교육생 신청 검토 |
| 모집 공고 | `/recruit-manage` | 강사·TA 모집 |
| 포털 관리 | `/portals` | 고객 문서 포털 발급 |
| 직원 급여 | `/payroll-mgmt` | 내부 직원 급여명세서 |
| 회계 검토 | `/accounting-portal` | 회계사무소 외부 |
| 정산 | `/settlements` | 5단계 정산 워크플로우 |
| 지출 | `/expense` | 운영비 외부비용 |
| 증빙 | `/receipts` | 세금계산서·영수증 |
| 견적 | `/estimates` | 견적서 작성 |
| 내 페이지 | `/mypage` | 본인 계정·서명 |
| 내 급여명세서 | `/my-payroll` | 본인 명세서 (직원) |
| 내 사업보고 | `/my-report` | 수혜기업 본인 보고 |

→ 자주 안 쓰는 메뉴는 사이드바에서 숨겼지만 URL 직접 입력 또는 다른 화면의 링크로 접근 가능.

## 권한 (5종)

| 역할 | 권한 |
|---|---|
| `admin` | 전체 접근 + 설정 메뉴 |
| `pm` | 담당 프로젝트·프로그램 생성·수정·삭제 |
| `staff` | 배정된 태스크·일지 조회·수정 |
| `finance` | 수입·지출·증빙 전체 (PM 겸임 가능) |
| `partner` | 컨소시엄 포털만 접근 (외부 참여사) |
| `member` | 수혜기업 (내 사업·일정·보고만) |

- **복수 역할 가능** (`['finance', 'pm']`)
- `profiles.role` 컬럼 (소문자 저장) — 권한 체크는 `hasRole(role, 'pm')`

## 외부 토큰 라우트 — 인증 불필요

| 라우트 | 누가 사용 | 어디서 발급 |
|---|---|---|
| `/portal` | 강사 본인 PIN 로그인 | (자동) |
| `/checkin/:token` | 교육생 출석 체크 | 출석 세션 등록 시 자동 |
| `/attend/:token` | 외부 출석 체크 | 동상 |
| `/form/:token` | 외부 폼 응답자 | `/forms` |
| `/portal/:token` | 고객 (서류 제출) | `/portals` |
| `/invitation/:token` | 강사 (초빙 수락) | 프로그램 → 강사 |
| `/apply/:programId` | 교육생 신청 | 프로그램 생성 시 자동 |
| `/recruit/:token` | 강사·TA 지원자 | `/recruit-manage` |
| `/log/:token` | 외부 일지 작성자 | 일지 → 외부 공유 |
| `/accounting-review/:token` | 회계사무소 검토자 | `/accounting-portal` |
| `/audit/:token` | 감사용 외부 검토 | 별도 발급 |
| `/share/client(student/expert)/:token` | 결과물 공유 | `/shares` |
| `/school-portal/:token` | 수혜학교 PM | `/admin` → 포털 발급 |
| `/team-portal/:token` | 학교 동아리 팀 | 같음 |
| `/supervisor-portal/:token` | 교육지원청 | 같음 |
| `/survey/:token` | 학교·팀·전체 설문 | 같음 |
| `/yeosu-marine-startup-survey/:token` | 여수 사전 수요조사 | 박경수님 수동 발급 |
| `/my/:my_token` | PARTNER/MEMBER 본인 페이지 | 자동 |

## 작업 흐름 — 새 사업 시작 시

```
1️⃣ 수주·기획
   ├─ 거래처 등록   →  /clients
   ├─ 컨소시엄 생성  →  /consortium (필요 시)
   ├─ 프로젝트 생성  →  /projects (계약 자동 생성)
   └─ 계약 보강     →  /contracts (라이프사이클 5탭)

2️⃣ 사업 준비
   ├─ 프로그램 등록  →  /programs
   ├─ 커리큘럼      →  프로그램 상세 → 커리큘럼 탭
   ├─ 강사 초빙     →  프로그램 상세 → 강사 탭
   └─ 교육생 신청   →  외부 /apply/:programId

3️⃣ 사업 운영
   ├─ 강사 일지·사진  →  강사 포털 (/portal)
   ├─ 출석 관리      →  /attendance
   └─ AI 초안        →  강사 포털 또는 /ai

4️⃣ 정산·보고
   ├─ 강사료 정산   →  /payroll
   ├─ 결과보고서    →  프로그램 상세 → 결과보고 탭
   ├─ 회계 검토     →  /accounting-portal 외부 토큰
   └─ 재무 대시보드  →  /reports
```

## 데이터 흐름 — 핵심

```
clients ──────────────┐
staff_pool ────────┐  │
                   ▼  ▼
consortiums ──→ projects ──→ tasks
                  │
                  ├──→ programs ──→ curriculum
                  │         │        ├── instructor_invitations
                  │         │        ├── program_participants
                  │         │        ├── attendance_sessions·records
                  │         │        ├── mentoring_assignments·logs
                  │         │        ├── curriculum_logs
                  │         │        └── performance_reports
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

## 핵심 단축키

| 키 | 기능 |
|---|---|
| `Ctrl+K` | 커맨드 팔레트 (일부 페이지) |
| `Ctrl+V` | 이미지·PDF 붙여넣기 업로드 |
| `Ctrl+Shift+R` | 강제 새로고침 (Netlify 신규 배포 반영) |
| `F12` | 개발자도구 (Console·Network 로그) |
