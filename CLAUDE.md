BalanceDot WorkFlow v2 — CLAUDE.md
Claude Code가 매 세션마다 이 파일을 먼저 읽고 작업한다.
수정 시 반드시 이 파일도 업데이트할 것.
마지막 업데이트: 2026-06-03 (Skywork 세션 분석 및 신규 인수인계 문서 생성 완료. HANDOVER.md 참고)

1. 프로젝트 개요
•	앱명: BalanceDot WorkFlow v2
•	로컬 경로: C:\workflow\bal24-workflow-v2
•	기존 v1: https://bal24-workflow.netlify.app (건드리지 말 것)
•	개발 서버: http://localhost:5173 (Vite)
•	목적: 10~30명 규모 교육·컨설팅·이벤트 운영 SaaS

2. 기술 스택
React 18 + TypeScript + Vite
Tailwind CSS
shadcn/ui + Radix UI  (컴포넌트)
Tremor                (차트·대시보드)
Supabase              (Auth + DB + Storage)
react-router-dom v6
Pretendard            (폰트)

Supabase
•	URL: https://clsljkxvgmqwenettkrz.supabase.co
•	Anon Key: sb_publishable_6TdLfJULinoVs5ijnEcOCQ_MGptHS0t
•	클라이언트: src/lib/supabase.ts

3. 절대 규칙 (위반 금지)
❌ localStorage 사용 금지 → Supabase or Context 사용
❌ catch { } 빈 블록 금지 → 반드시 에러 처리/로깅
❌ 컴포넌트 400줄 초과 금지 → 분리할 것
❌ any / unknown 타입 금지 → 명시적 타입 선언
❌ 외부 페이지는 Supabase에서 직접 fetch
❌ 영문 에러/성공 메시지 노출 금지 → 모두 한글로
❌ Google Drive 연동 불필요 (구현하지 말 것)
✅ React Hook 규칙 엄수 (Minified React error #310 방지)
✅ typecheck 수시 실행하여 새 오류 생성 방지
✅ 파일 업로드: 드래그앤드롭 + 클립보드 붙여넣기(Ctrl+V) 필수
✅ Supabase join 시 FK 명시 필수: `profiles!{table}_{column}_fkey` 형태 사용. 단축형 `:profiles(...)`는 FK 2개 이상일 때 PGRST201 에러 발생.
✅ 작업 완료 시 이 문서에 ✅ 표시


4. 디자인 시스템 (확정)
레퍼런스
레이아웃 구조   → linear.app 스타일
차트·대시보드   → tremor.so
컴포넌트        → shadcn/ui + Radix UI
폰트            → Pretendard
다크모드        → v2 제외, 추후 추가

컬러
바이올렛(Primary): #7C3AED
주황(Warning):    #F97316
민트(Success):    #06B6D4
청록(Info):       #0891b2
사이드바 배경:    #0F172A
콘텐츠 배경:      #F8FAFC
카드 배경:        #FFFFFF
텍스트 기본:      #0F172A
텍스트 보조:      #64748B

로그인 페이지 (구현 완료)
•	좌우 2분할, 좌측 바이올렛 그라데이션 (#7C3AED → #6D28D9 → #4C1D95)
•	우측 크림 배경 (#FEFCE8)
•	"시작하기" 버튼: 바이올렛→핑크 그라데이션
공통 UI 규칙
•	카드 border-radius: 12~16px, 그림자: shadow-sm
•	헤더: sticky 상단 고정, 제목 좌측, 버튼 우측
•	사이드바: #0F172A, 너비 240px
•	패딩: 24px
•	5줄 이상 리스트: 고정 프레임 + 스크롤
•	버튼: "저장하기" / "수정 완료" 표준화
•	애니메이션: 0.2초 fade-in, 스켈레톤 UI
•	상세정보: 우측 슬라이드오버 패널 (페이지 이동 없음)
•	알림: 우하단 토스트 (모달 팝업 최소화)
•	커맨드 팔레트: Ctrl+K (전체 검색)
•	인라인 편집: 클릭 시 바로 수정 가능
상태 배지 컬러
프로젝트: 제안-회색 | 진행-바이올렛 | 정산-주황 | 종료-민트
태스크:   인식-회색 | 실행-바이올렛 | 검토-주황 | 완료-초록
링크:     대기-회색 | 발송-파랑    | 완료-초록 | 만료-빨강


5. 메뉴 구조 (확정)
🏠  홈                  대시보드 (KPI + 간트 + 할일)
📅  일정                캘린더

── 업무 ──────────────────────────────
📋  프로젝트            단독 용역·사업
🤝  컨소시엄            다기관 협업 (독립 메뉴)
🎓  프로그램            교육·캠프·행사·세미나·이벤트

── 자원 ──────────────────────────────
🏢  고객사              거래처·고객사·협력사
👥  전문가              외부강사·컨설턴트·전문가 (인력풀)
🔗  공유                외부링크·QR 생성·결과물 발송

── 경영 ──────────────────────────────
💰  수입                계약금·수금·미수금
📤  지출                외부비용 집행 (강사료·숙박·교통 등)
🧾  증빙                세금계산서·영수증

── 보고 ──────────────────────────────
📊  리포트              사업보고서 자동생성

── 팀 ────────────────────────────────
👤  팀원                내부 임직원 관리
⚙️  설정                시스템 설정
🤖  AI                  AI 어시스턴트


6. DB 테이블 구조 (14개 기본)
profiles          내부 회원 (이름, 역할, 슬로건)
clients           고객사·거래처 (사업자번호, 계좌, 파일)
staff_pool        전문가·외부인력 (강사·컨설턴트, 포트폴리오)
consortiums       컨소시엄 (총금액, 기간, 참여기관)
consortium_members 컨소시엄 참여기관 (금액→비율 자동계산, 역할)
projects          프로젝트 (담당자만 수정 가능)
project_members   프로젝트 참여 인력
tasks             태스크 (그룹, D-day, AI생성여부)
educations        프로그램 (교육·캠프·행사)
curriculum        커리큘럼
instructor_info   강사 정보 (staff_pool 연동)
students          교육생
attendance        출석
surveys           설문

추후 추가 예정 테이블
external_links    외부링크 (토큰, 유형, 만료일, 단계)
result_packages   결과물 묶음 발송 패키지
incomes           수입 (계약금, 수금)
expenses          지출 (유형별 외부비용)
tax_invoices      세금계산서·증빙
reports           결과보고서
consortium_portal 컨소시엄 포털 접근 권한


7. 현재 진행 상황
완료 ✅
•	STEP 1: 프로젝트 초기 설정 (Vite+React+TS+Tailwind)
•	STEP 2: Supabase 14개 테이블 생성
•	STEP 3: .env 설정 + 서버 실행 확인
•	STEP 4: Supabase 연결 확인
•	STEP 5: 로그인 페이지 + AuthContext 구현
•	STEP 6: 대시보드 레이아웃 구현
•	STEP 6-1: 로그인 페이지 v1 디자인 구현 (251줄, 좌우 2분할)
•	STEP 6-2: 로그인 계정 생성 완료 (park8451@gmail.com / Confirm email OFF)
진행 중 ⏳
•	STEP 7: 사이드바 메뉴 확정 구조로 교체 (다음 단계)
예정 📋
•	STEP 7: 사이드바 메뉴 확정 구조로 교체
•	STEP 8: 프로젝트 페이지
•	STEP 9: 컨소시엄 페이지 + 포털
•	STEP 10: 프로그램(교육·행사) 페이지
•	STEP 11: 고객사·전문가 페이지 (AI 명함인식 포함)
•	STEP 12: 공유·외부링크 시스템
•	STEP 13: 수입·지출·증빙 페이지
•	STEP 14: 리포트 자동생성
•	STEP 15: AI 어시스턴트

8. 핵심 기능 스펙

[A] AI 태스크 자동 생성
운영안/견적서 분석 → D-day 기준 태스크 자동 생성
태스크 그룹:
📋 사전준비: D-30(교통), D-20(숙박), D-14(강사확정), D-7(준비물)
🚀 현장운영: D-day 체크리스트
📊 사후처리: D+1(사진정리), D+3(만족도), D+7(보고서), D+14(정산)

저장: tasks 테이블, ai_generated: true 표시


[B] 외부링크 — 3단계 라이프사이클
[사전]
├── 참가 신청·등록 (이력서, 계획서, 신청서 업로드)
├── 기본정보 확인·승인 링크
└── 강사 커리큘럼 입력 링크

[진행 중]
├── 중간 결과물 제출 링크
└── 중간 만족도 조사 링크

[사후]
├── 최종 산출물 제출 링크
├── 최종 만족도 조사 링크
└── 수료증 신청 링크

토큰 구조: { token, type, stage, expires_at, status }
라우트: /external/:token (로그인 불필요)


[C] 결과물 묶음 발송 (선택적 패키지 발송)
패키지 구성 UI (체크박스 선택):

발송 대상    포함 가능 항목
─────────────────────────────────────────
강사         현장사진, 강의영상, 참가자 명단
교육생       본인 제작물, 수료증, 현장사진
거래처       강사이력+만족도결과+결과보고서
발주처       전체보고서, 정산내역, 사진

→ 대상 선택 → 항목 체크 → 링크 or 이메일 일괄 발송
→ 발송 이력 저장


[D] 컨소시엄 포털 (외부 접근)
URL: /consortium/:id/portal

참여사 권한 3단계:
├── 읽기전용: 일정·회의록·공유자료 열람
├── 입력권한: 과업 진행현황 입력
└── 관리권한: 담당 파트 수정

포털 기능:
├── 과업 진행현황 (본사이트와 실시간 동기화)
├── 일정·마일스톤
├── 회의록·협의내용
├── 파일 공유함
└── 알림

본사이트에서도 동일 데이터 전체 관리 가능


[E] 고객사·전문가 등록 — AI 명함인식
등록 방법:
1. AI 명함인식: 사진 업로드 → 이름/회사/연락처/이메일 자동 추출
2. 직접 입력
3. 파일 업로드 (드래그앤드롭, Ctrl+V 붙여넣기)

파일 업로드 공통 규칙:
- 드래그앤드롭: 모든 파일 영역에 적용
- Ctrl+V 붙여넣기: 이미지/PDF 즉시 업로드
- Supabase Storage 저장


[F] 지출관리 — 외부비용 집행
유형 분류:
인건비     강사료, 외부용역비, 자문료
시설·장비  대관료, 장비사용료, 렌탈
숙박·식비  숙박비, 식비, 다과
교통       버스임차, KTX, 항공, 택시
인쇄·제작  현수막, 자료집, 굿즈
기타       직접입력

항목별 필드:
- 프로젝트/프로그램 연결 (필수)
- 지급처 (고객사·전문가 연동)
- 금액 + 부가세 여부
- 지급상태: 미지급 / 지급완료 / 보류
- 세금계산서 연결
- 증빙 파일 첨부 (드래그앤드롭, Ctrl+V)


[G] 컨소시엄 예산 배분
입력 방식: 금액으로 입력 → 비율 자동계산

예시:
참여기관A (주관): 30,000,000원 → 60.0%
참여기관B (참여): 12,000,000원 → 24.0%
참여기관C (참여):  8,000,000원 → 16.0%
합계:             50,000,000원 → 100%

→ 기관별 정산 현황 자동 집계


9. 데이터 연결 구조
고객사 ──────────────────────────────┐
전문가 ──────────────────────────┐   │
                                  ▼   ▼
컨소시엄 ──→ 프로젝트 ──→ 태스크(AI생성)
                  │
                  ├──→ 프로그램 ──→ 강사(전문가)
                  │         │        ├── 커리큘럼
                  │         │        └── 교육생
                  │         │              ├── 출석
                  │         │              └── 산출물
                  │         │
                  │         └──→ 외부링크(3단계: 사전·중간·사후)
                  │                         └── 결과물 묶음 발송
                  │
                  ├──→ 수입 (계약금·수금)
                  ├──→ 지출 (강사료·숙박·교통)
                  │         └── 증빙 (세금계산서)
                  │
                  └──→ 리포트 (자동생성)


10. 파일 구조 가이드
src/
├── contexts/
│   └── AuthContext.tsx         ✅
├── lib/
│   └── supabase.ts             ✅
├── types/                      (TypeScript 타입 — 한 곳에 모음)
│   ├── project.ts
│   ├── education.ts
│   ├── task.ts
│   ├── consortium.ts
│   └── index.ts
├── constants/
│   └── status.ts               (상태값·배지컬러 상수)
├── hooks/                      (Supabase 쿼리 훅)
│   ├── useProjects.ts
│   ├── useEducations.ts
│   ├── useTasks.ts
│   └── useConsortiums.ts
├── components/
│   ├── layout/
│   │   ├── Sidebar.tsx         ✅ (메뉴 확정 후 교체 예정)
│   │   └── Layout.tsx          ✅
│   ├── ui/                     (shadcn/ui 공통 컴포넌트)
│   └── external/               (외부링크 전용)
├── pages/
│   ├── auth/
│   │   └── LoginPage.tsx       ✅ (251줄)
│   ├── dashboard/
│   │   └── DashboardPage.tsx   ✅
│   ├── projects/               📋
│   ├── consortium/             📋 (포털 포함)
│   ├── programs/               📋
│   ├── clients/                📋
│   ├── experts/                📋
│   ├── share/                  📋
│   ├── income/                 📋
│   ├── expenses/               📋
│   ├── receipts/               📋
│   ├── reports/                📋
│   ├── team/                   📋
│   ├── external/               📋 (외부링크 /external/:token)
│   └── PlaceholderPage.tsx     ✅
└── App.tsx                     ✅


11. 개발 원칙
1. 이 파일 먼저 읽고 현재 상태 파악 후 작업 시작
2. 리서치 → 계획(plan.md) → "아직 구현하지 마" → 검토 → 구현
3. 잘못된 방향이면 git revert 후 재시작 (패치 시도 금지)
4. 컴포넌트는 150~200줄 목표, 400줄 절대 초과 금지
5. 완료 항목은 이 파일 ✅ 표시
6. 새 결정사항은 즉시 이 파일에 추가
7. 확장성 우선: 탭 구조로 설계하여 기능 추가 시 탭만 추가


13. 확정된 설계 결정사항

[결정 1] 권한·역할 시스템
type UserRole = 'ADMIN' | 'PM' | 'STAFF' | 'FINANCE' | 'PARTNER'

// 역할별 권한
ADMIN   : 전체 접근 + 설정 관리
PM      : 담당 프로젝트/프로그램 생성·수정·삭제
STAFF   : 배정된 태스크 조회·수정
FINANCE : 수입·지출·증빙 전체 + PM 역할 겸임 가능
PARTNER : 컨소시엄 포털만 접근 (외부 참여사)

// 핵심 규칙
- 한 사람이 복수 역할 가능 (예: FINANCE + PM 동시 보유)
- roles 컬럼: text[] 배열로 저장
  예) ['FINANCE', 'PM']
- 권한 체크: roles.includes('PM') || roles.includes('ADMIN')


[결정 2] 프로그램 유형별 폼 — B안 (동적 필드)
기본 구조:
- 교육과 캠프는 숙박 여부로 구분
  교육: 숙박 없음 (당일형)
  캠프: 숙박 있음 (1박 이상)

관리자가 유형별 필드를 추가/삭제 가능:
- 설정 > 프로그램 유형 관리 메뉴
- 각 유형에 커스텀 필드 추가 (텍스트/날짜/숫자/파일)
- 필드 순서 변경 가능

기본 제공 유형 + 기본 필드:
교육    : 커리큘럼, 강사, 참가자, 장소
캠프    : 커리큘럼, 강사, 참가자, 장소, 숙박정보, 식사정보
행사    : 프로그램표, 참가자, 장소, 부스정보
세미나  : 발표자, 참가자, 장소, 발표자료
이벤트  : 프로그램표, 참가자, 장소
워크숍  : 커리큘럼, 강사, 참가자, 장소, 준비물


[결정 6] 관리자 수정 가능 항목 (설정 메뉴)
⚙️ 설정 메뉴 안에 ADMIN만 접근 가능한 관리 섹션:

[명칭 관리]
- 프로젝트 상태명 수정 (제안→계약→실행→정산→종료 등)
- 태스크 상태명 수정
- 역할명 수정 (PM → 프로젝트매니저 등)
- 프로그램 유형명 수정/추가/삭제

[분류 관리]
- 지출 유형 추가/삭제/순서변경
  (기본: 인건비/시설·장비/숙박·식비/교통/인쇄·제작/기타)
- 전문가 분야 태그 추가/삭제
- 고객사 업종 분류 추가/삭제
- 프로젝트 태그 추가/삭제

[필드 관리]
- 프로그램 유형별 커스텀 필드 추가/삭제/순서변경
- 필드 유형: 텍스트/숫자/날짜/파일/선택지

구현 방식:
- DB 테이블: system_settings (key, value, category, updated_by)
- 하드코딩 금지 → 모든 상태값/유형은 DB에서 fetch
- 변경 시 즉시 반영 (앱 재시작 불필요)


[결정 3] 리포트 자동생성 — 전체 지원
우선순위 순서로 개발:
1. 최종결과보고서  ← 1순위 (가장 많이 씀)
2. 중간보고서
3. 착수보고서
4. 월간공정보고

공통 자동집계 항목:
- 프로젝트/프로그램 기본정보
- 참여 인력 및 역할
- 예산 집행 현황 (지출 데이터 연동)
- 참가자 통계 (학생 데이터 연동)
- 만족도 결과 (설문 데이터 연동)
- 사진 첨부 (파일 연동)


[결정 4] 컨소시엄 포털 접근
URL 구조: /consortium/:id/portal
- 같은 도메인, 별도 라우트
- 로그인 불필요 (토큰 기반 접근)
- 권한: PARTNER 역할 부여


[결정 5] 로그인 페이지 문구 (최종)
좌측 (바이올렛 그라데이션):
  태그라인 : "✦ 스마트한 업무 운영"
  헤드라인 : "팀의 모든 업무를 한 흐름으로."
  설명     : "당신의 성장을 돕습니다."
  기능 3줄 : 프로젝트 & 태스크 관리
             미팅일지 & AI 자동 요약
             정산 & 사업보고

우측 (크림 #FEFCE8):
  헤드라인  : "안녕하세요 👋"
  서브텍스트: "WorkFlow로 오늘도 스마트하게 시작하세요."
  버튼      : "시작하기"
  하단      : "계정 관련 문의는 관리자에게 연락해 주세요."
  카피라이트: "© 2026 (주)밸런스닷 · WorkFlow v2"


1. "이름 기억하기" 체크박스
   - 현재: 클라이언트 상태로만 관리
   - 향후: persistSession 옵션 연동 가능

2. "이름 또는 이메일" 로그인
   - 현재: 이메일만 지원 (Supabase 기본)
   - 향후: STEP 11 팀원 구현 시 이름→이메일 룩업 추가

3. 실시간 협업 커서 — v2 안정화 후 추가
4. 드래그앤드롭 칸반 — v2 안정화 후 추가
5. 문자/카카오 발송 — 현재는 URL 복사로 대체


최종 업데이트: 2026-06-03
프로젝트: BalanceDot WorkFlow v2 by 박경수

---

## 📌 현재 진행 상황 (2026-05-07 기준)

> ⚠️ STEP 번호는 git commit 메시지 기준. 실제 구현 순서가 1~17 선형이 아니고, sub-step(11-B/C/D/E·11-옵션B)이 본 STEP 12 이후에 진행되었음.
> STEP 22 는 비어 있음(skip) — 디자인 시스템(stage 1~2-D) → STEP 23(토스트) 순서.

### ✅ 완료된 STEP (commit 기준)

| STEP | 내용 | commit |
|------|------|------|
| 1 | 프로젝트 초기 설정 (Vite + React + TS + Tailwind) | `87dce5d` |
| 2 | Supabase 14 테이블 + RLS | `5d0bf65` / `ad5bba2` |
| Phase 1 | 로그인 + 사이드바 + UI 컴포넌트 | `820d2c0` / `2914022` |
| 8 | 프로젝트 상세 4탭 + 파일업로드 + 태스크 (start_date·모달·FK 모호성 fix) | `2fc9bc5` / `0bdb645` / `19175f7` / `95b907f` |
| 9 | 프로그램 페이지 + Supabase join FK 가이드 | `978d65b` |
| 10-A | 고객사 + client_contacts 정규화 + 재사용 FileDropZone | `e29c33c` / `24339ab` |
| 10-B | 전문가 + Claude API 명함 인식 | `645a679` |
| 11 | 컨소시엄 페이지 + 동적 참여사 + 상세 (FK 명시 fix) | `a1fbaa6` / `4819095` |
| 12 | 수입/지출/증빙 + 원천징수 GENERATED 컬럼 + /vouchers→/receipts 정렬 | `6f81b0d` / `9493474` |
| 11-B | 출석체크 시스템 (attendance_sessions + attendance_records + 외부 /checkin/:token) | `58e743a` |
| 11-C | 수료증·강의확인서 PDF 발급 (certificate_templates + issued_certificates) | `c727863` |
| 11-D | 통합 일지 시스템 (activity_logs) | `4c8d1e1` |
| 11-E | 외부 공개 폼 시스템 (public_forms + form_applications + 외부 /form/:token) | `a0aa040` |
| 13 | 결과보고서 자동 생성 + 정산 5단계 워크플로우 (project_reports + project_settlements) | `47b4e5e` |
| 14 | 정산 워크플로우 UI (SettlementPage + SettlementActionModal) | `92f99b4` |
| 15 | 고객 문서 포털 (project_portals + portal_items + portal_responses + portal_templates + portal_template_items + 외부 /portal/:token) | `fcca93a` |
| 16 | 강사 초대 수락 링크 (instructor_invitations.portal_token + 외부 /invitation/:token) | `640444a` |
| 17 | 일정·캘린더 (월/주/목록 뷰 + Tailwind grid 자체 구현 + 5종 데이터 통합 + schedule_events) | `3f767c4` |
| 18 | 팀원 관리 (3열 카드·5종 role·아바타 업로드·`/team`→`/members` redirect) | `63beea9` |
| 19 | 공유 링크 통합 뷰 (4종 외부 토큰 한 화면·복사·새탭) | `5f60462` |
| 20 | 재무 리포트 (KPI+SVG 막대/도넛+미지급 + 항목 커스터마이징 layout DB 저장) | `b424d5f` |
| 21 | AI 어시스턴트 (대화 목록 + 채팅 + Edge Function `ai-chat` Mock fallback + ai_conversations/ai_messages) | `61f0b86` |
| 디자인 1 | 15개 페이지 헤더 통일 + `EmptyState`/`statusStyles` 헬퍼 신규 | `6a79d4c` |
| 디자인 2-A | 페이지별 개선 — 프로그램 유형 배지·전문가 specialty pill·수입/지출 hover·프로젝트 상태 배지 통일 | `fddde56` |
| 디자인 2-B | 빈 상태 EmptyState 헬퍼로 14 페이지 일괄 통일 | `4ccf6f9` |
| 디자인 2-C | 상태 배지 `statusStyles` 일괄 통일 — 컨소시엄·프로그램·강사초대 | `b7ba728` |
| 디자인 2-D | Modal에 `brand` size variant 추가 (max-w-560 + rounded-20 + 강한 shadow) | `9b3d064` |
| 23 | 토스트 알림 시스템 (`ToastContext` + `ToastContainer`) + AiPage·ProjectsPage 시범 적용 | `1bd9df1` |
| 23-B | 8개 메인 페이지 fetch 에러 `toast.error` 일괄 교체 | `60de9b8` |
| 11-옵션B | 교육생 신청 + 강사·TA 모집 시스템 (participant_applications + recruit_forms + recruit_applications + 외부 `/apply/:programId`·`/recruit/:token`) | `eff2efc` |
| Stage 3 | HomePage KPI Supabase 실데이터 + 최근 프로젝트/지출 (dashboardUtils) | `5602702` |
| 출석/일지 외부 | 출석 QR 다운로드 + 외부 `/attend/:token`·`/log/:token` 라우트 + 통합일지 외부 발송 링크 + SignaturePad | `78e726e` |
| 캘린더 개선 | 다일 이벤트 시작일 텍스트 + 한국 공휴일(`utils/holidays.ts`) + 색상 매핑 정리 | `776f3bd` |
| **STEP-CON** | 컨소시엄 독립 홈 7탭 구조 (개요·프로그램·태스크·인력·재무·외부공유·포털 + consortium_staff/consortium_links/consortium_portal_permissions + tasks·income·expenses에 consortium_id 추가) | `2f367f4` |
| **STEP-ACCOUNTING-ALL** | P1 DB·사이드바·타입 / P2 수입·계약 페이지 (income_contracts + 청구단계 jsonb) / P3 외주·급여 페이지 (payroll_expenses + GENERATED subtotal·net) / P4 회계사무소 외부 포털 (accounting_reviews + /accounting-review/:token) | `다수` |
| **STEP-ACCOUNTING-FOLLOWUP1~7 + Phase2.5/3** | 계약 파일 업로드·주민번호 외부 차단·프로그램 연동·부가세 10%·카테고리 자유·검색·계약명 강제 동기화·컨소시엄 단위·기본정보 자동 채움·콤보박스 고도화·거래처 담당자(세금계산서)·외주↔계약 FK + prefill·program_staff_fees→payroll 변환·AI 견적서 분석 | `다수` |
| **STEP-CONTRACT-AUTO** | 프로젝트/프로그램 생성 시 income_contracts 자동 생성 (lifecycle 5단계·auto_created·doc_request_pending·portal_id FK). ContractsPage 라이프사이클 5탭 + 자동/서류 미업로드 배지. ContractDetailDrawer 주관기관 서류 요청 → PortalCreateModal 직결 + 자동 portal_id 연결 + 업로드 시 자동 해제 | `15e1843` ~ `5e81534` |
| **STEP-TAGS** | clients/staff_pool.tags (text[]) + tag_categories + GIN 인덱스 + RLS. useTagFilter / TagFilterTabs / TagsSelector 공용 컴포넌트. ClientsPage·ExpertsPage 필터 탭 + 등록 모달 다중 선택. /admin 에 태그 분류 CRUD (scope=client/staff) | `e503a31` · `469b863` |
| **박경수님 보고 4건** | 1.프로젝트 수정 메뉴 (ProjectEditModal) / 2.OverviewTab 재무요약 신 회계 합산 (income_contracts + payroll_expenses + expectedIncomeTotal + payrollTotal) / 3.PortalCreateModal 프로젝트명 prefill / 4.MembersTab projects.pm_id 자동 합류 (synthesizePm) | `d96dc60` 등 |

---

### 🎉 사이드바 메뉴 구현 완료 (STEP-CON 시점)

22개 사이드바 메뉴 모두 실제 페이지 동작. PlaceholderPage 사용처 없음.

| 그룹 | 메뉴 (라우트) |
|---|---|
| **운영** | 홈 (`/home`) · 일정 (`/schedule`) · 프로젝트 (`/projects`) · 컨소시엄 (`/consortium`) · 프로그램 (`/programs`) · 고객사 (`/clients`) · 전문가 (`/experts`) · 공유 (`/shares`) · 출석체크 (`/attendance`) · 수료증 (`/certificates`) · 일지 (`/activity-logs`) · 폼 관리 (`/forms`) · **신청 관리 (`/applications`)** · **모집 공고 (`/recruit-manage`)** · 포털 (`/portals`) |
| **재무** | 수입 (`/income`) · 지출 (`/expense`) · 증빙 (`/receipts`) · 정산 (`/settlements`) · 리포트 (`/reports`) |
| **기타** | 팀원 (`/members`) · AI (`/ai`) |

### 🎯 컨소시엄 상세 — 7탭 구조 (STEP-CON)

`/consortium/:id` 진입 시 7개 탭으로 독립 홈 형태 운영. 본 프로젝트(`/projects/:id`) 와 동일한 깊이의 탭 분리.

| 탭 | 컴포넌트 | 핵심 |
|---|---|---|
| 개요 | `ConOverviewTab` | 참여기관·예산 배분 (금액→비율 자동) |
| 프로그램 | `ConProgramsTab` | 컨소시엄에 묶인 programs 목록 |
| 태스크 | `ConTasksTab` | tasks.consortium_id 로 필터, 기관별 share_pct |
| 인력 | `ConStaffTab` | consortium_staff (instructor/ta/facilitator/mentor/coordinator) |
| 재무 | `ConFinanceTab` | 기관별 수입·지출·잔액 집계 |
| 외부공유 | `ConLinksTab` | consortium_links (token 기반 4종 외부) |
| 포털 | `ConPortalTab` | consortium_portal_permissions (PARTNER 권한) |

---

### 📋 실제 사용 중 Supabase 테이블 (핵심 컬럼)

| 테이블 | 핵심 컬럼 |
|---|---|
| `projects` | id, name, status, start_date, end_date, client_id |
| `tasks` | id, title, status, due_date, start_date, project_id |
| `programs` | id, name, type, status, start_date, end_date, project_id |
| `program_curriculum` | id, program_id, session_date, title, start_time, end_time |
| `staff_pool` | id, name, phone, email, role |
| `instructor_invitations` | id, program_id, expert_id, role, status, portal_token |
| `attendance_sessions` | id, program_id, title, session_date, start_time, end_time, learner_token, instructor_token, ta_token |
| `attendance_records` | id, session_id, role, name, phone, checked_in_at |
| `clients` | id, name, business_name, client_type |
| `consortiums` | id, name, status, project_id |
| `income` | id, project_id, account_code, amount, ledger_type |
| `expenses` | id, project_id, account_code, gross_amount, withholding_type, ledger_type |
| `receipts` | id, expense_id, receipt_type, file_url |
| `schedule_events` | id, title, event_date, start_time, end_time, category, all_day |
| `report_layouts` | id, user_id, ledger_type, layout (jsonb), unique(user_id, ledger_type) |
| `ai_conversations` | id, user_id, title, context, updated_at |
| `ai_messages` | id, conversation_id, role, content, created_at |
| `profiles` | id, email, name, role, position, department, joined_at, is_active |
| `participant_applications` | id, program_id, name, phone, status, privacy_agreed, attendance_rate (STEP 11 옵션 B) |
| `recruit_forms` | id, program_id, recruit_type, form_token, deadline, max_count (STEP 11 옵션 B) |
| `recruit_applications` | id, form_id, name, phone, career, portfolio_url, status (STEP 11 옵션 B) |
| `consortiums` | id, name, status, project_id, lead_client_id, total_budget (STEP-CON 컬럼 추가) |
| `consortium_members` | id, consortium_id, client_id, member_type, task_share_pct, allocated_budget, portal_enabled |
| `consortium_staff` | id, consortium_id, expert_id, program_id, role, fee_type (STEP-CON 신규) |
| `consortium_links` | id, consortium_id, link_type, token (STEP-CON 신규) |
| `consortium_portal_permissions` | id, consortium_id, member_id, permission_level (STEP-CON 신규) |

> ℹ️ 위 표는 자주 사용하는 핵심 컬럼만. 부수 테이블(`client_contacts`, `program_applicants`, `files`, `certificate_templates`, `issued_certificates`, `activity_logs`, `public_forms`, `form_applications`, `project_reports`, `project_settlements`, `project_portals`, `portal_items`, `portal_responses`, `portal_templates`, `portal_template_items`)도 코드에서 사용 중 — 컬럼은 코드 grep으로 확인.

> ✅ supabase/migrations/ 폴더 보존 파일 — `20260510_schedule_events.sql`·`20260511_profiles_extend.sql`·`20260512_report_layouts.sql`·`20260513_ai_chat.sql`·`20260514_applications_recruit.sql`·`20260515_consortium_extend.sql`.
> tasks·income·expenses 에 `consortium_id` 컬럼 추가됨 (STEP-CON 마이그레이션에 포함).
> STEP 11-B/C/D/E·13·14·15·16 은 박경수님이 Supabase Dashboard 에서 직접 실행 (마이그레이션 파일 미보존).

---

### 🚩 외부 공개 라우트 (인증 불필요 — token 기반)

| 라우트 | 컴포넌트 | 용도 |
|---|---|---|
| `/checkin/:token` | CheckInPage | 출석 체크인 (STEP 11-B) |
| `/form/:token` | PublicFormPage | 외부 공개 폼 응답 (STEP 11-E) |
| `/portal/:token` | ClientPortalPage | 고객 문서 포털 응답 (STEP 15) |
| `/invitation/:token` | InstructorInvitePage | 강사 초대 수락 (STEP 16) |
| `/apply/:programId` | ApplyPage | 교육생 신청 (STEP 11 옵션 B) |
| `/recruit/:token` | RecruitApplyPage | 강사·TA 모집 지원 (STEP 11 옵션 B) |
| `/attend/:token` | AttendCheckPage | 출석 외부 체크 (출석 QR) |
| `/log/:token` | LogWritePage | 통합일지 외부 작성 + 서명 (SignaturePad) |

---

### 🚩 프로젝트 정보

| 항목 | 값 |
|------|-----|
| 로컬 경로 | `C:\workflow\bal24-workflow-v2` |
| GitHub | `https://github.com/bal24com/bal24-workflow-v2` |
| 배포 | `https://bal24-workflow-v2.netlify.app` / `https://bal24.kr` |
| Supabase | `https://clsljkxvgmqwenettkrz.supabase.co` |
| 최근 커밋 | `cb9da04` (CLUB-15 강사진 섹션에 동아리 멘토 포함) — 동아리·외부공유 줄기 |
| 인수인계 | `HANDOVER.md` (2026-06-03 최신, 동아리·역할별 외부공유 반영) / `HANDOVER_2026-05-25.md` (회계 줄기 구버전) |
| 이전 프로젝트 | `C:\workflow\workflow_v7_full` → **폐기, 사용 안 함** |

---

## 코드 품질 추가 규칙

### 최소 코드 원칙 (Simplicity First)
- 요청받은 것만 구현한다. 추측성 기능 추가 금지.
- 단일 사용 코드에 추상화 레이어 추가 금지.
- 200줄로 작성했다면 50줄로 줄일 수 없는지 먼저 자문한다.
- 요청받지 않은 유연성/설정 가능성 추가 금지.

### 외과적 수정 (Surgical Changes)
- 요청과 직접 관련 없는 코드는 건드리지 않는다.
- 관련 없는 포맷팅/주석/스타일 정리 금지.
- 동작하는 코드를 리팩토링하지 않는다.
- 기존 스타일이 마음에 들지 않더라도 맞춘다.
- 내 변경으로 생긴 미사용 import/변수만 제거한다. 기존 dead code 삭제 금지.
- 기준: 변경된 모든 줄이 사용자 요청과 직접 연결되어야 한다.

### 한국어 문장 끝 콜론 금지
- 한국어 출력 시 문장 끝을 콜론(:)으로 끝내지 않는다.
- 목록이나 예시 앞이라도 마침표(.)로 끝낸다.
- 예시 위반: "변경 사항:" → 올바른 예시: "변경 사항."
- 콜론은 코드, key-value 쌍, 레이블 안에서만 허용한다.

### 새 파일 한국어 헤더 주석
- 새로 생성하는 모든 소스 파일의 첫 줄에 해당 파일의 역할을 한국어 한 줄 주석으로 작성한다.
- TypeScript: // 프로그램별 집행완료보고서 작성·제출 탭 컴포넌트
- 위치: 'use client' 등 지시어 바로 아래.
- config 파일(*.config.ts, package.json 등)은 제외한다.

### 에러는 읽고 진단한다 (Read Errors, Don't Guess)
- 에러 발생 시 전체 메시지와 스택 트레이스를 읽는다.
- "자주 보던 패턴"으로 추측해서 수정하지 않는다.
- 원인을 확인하기 전에 수정 코드를 작성하지 않는다.
- 불분명하면 console.log/print를 추가해서 상태를 먼저 확인한다.

### 한글 우선 (2026-05-26 박경수님 지시)
- UI·에러·성공 메시지·toast·confirm·alert·placeholder·label·tooltip 모두 한글 우선.
- 영문 메시지(에러 raw 포함)는 사용자에게 그대로 노출하지 않는다. console.error 로만 남기고 사용자에게는 한글 안내로 전환한다.
- 코드 주석은 한글/영문 자유. 단 박경수님이 읽을 가능성이 있는 위치는 한글 우선.

### 모달은 드래그로 닫히지 않는다 (2026-05-26 박경수님 지시)
- 사용자가 모달 내부에서 텍스트를 드래그 선택하다가 마우스를 백드롭 위에서 떼면 onClick 이 발동해 모달이 닫히는 버그가 흔히 발생한다.
- 모든 모달·드로어·팝오버에서 mousedown 이 백드롭에서 시작된 경우에만 백드롭 클릭으로 인정해 닫는다.
- 공용 `components/ui/Modal.tsx` 는 이미 처리됨. 신규 모달 작성 시 `mouseDownOnBackdropRef` 패턴을 따른다.

�� 인정해 닫는다.
- 공용 `components/ui/Modal.tsx` 는 이미 처리됨. 신규 모달 작성 시 `mouseDownOnBackdropRef` 패턴을 따른다.

