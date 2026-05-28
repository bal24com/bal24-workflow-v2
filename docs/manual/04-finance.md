# 04. 재무 — 수입 · 계약 · 지출 · 강사료 · 증빙 · 정산

## 재무 메뉴 한눈에

```
사이드바 "경영" 그룹 (5+개)
├── 수입 (/income)          ← 계약·청구·수금
├── 지출 (/expense)         ← 외부비용 (강사·대관·교통·인쇄)
├── 외주·급여 (/payroll)    ← 강사료·외주비 (payroll_expenses)
├── 직원 급여 (/payroll-mgmt)← 내부 직원 급여명세서
├── 증빙 (/receipts)        ← 세금계산서·영수증
├── 정산 (/settlements)     ← 5단계 정산 워크플로우
└── 회계검토 (/accounting-portal) ← 회계사무소 외부 포털
```

---

## 수입·계약 (`/income`, `/contracts`)

### 라이프사이클 5탭

```
[자동]   auto_created=true (사용자 입력 전 자동 생성)
[제안]   proposal
[계약]   contract
[진행]   operation
[종료]   closing
```

### 자동 생성 흐름

```
프로젝트 생성 → income_contracts 자동 생성 (lifecycle_stage='proposal', auto_created=true)
              ↓
       사용자가 계약 정보 보강 (계약명·금액·청구일정)
              ↓
       lifecycle_stage 진행 (proposal → contract → operation → closing)
              ↓
       청구단계(jsonb) 별 청구·수금 기록
```

### 페이지 구조

| 영역 | 기능 |
|---|---|
| 상단 | 라이프사이클 5탭 + 검색 |
| 목록 | 계약 행 (이름·고객사·금액·단계) + 자동/서류 미업로드 배지 |
| 행 클릭 | 우측 `ContractDetailDrawer` |

### 자주 하는 일

| 상황 | 어디서 |
|---|---|
| 계약 단계 변경 | 행 → drawer → [단계] select |
| 청구 단계 추가 | drawer → [+ 청구 단계] → 일자·금액 입력 |
| 수금 기록 | 청구 행 → [수금 완료] |
| 주관기관 서류 요청 | drawer → [서류 요청] → PortalCreateModal 직결 |

### 부가세 (2026-05-25 분리)

- `gross_amount` (공급가액)
- `vat_amount` (부가세, 보통 10%)
- `total_amount` (합계, GENERATED)

부가세 여부 토글로 분리. 면세 사업도 지원.

---

## 외주·급여 (`/payroll`) — `payroll_expenses`

### 통계 4종 (2026-05-28 정비)

| 통계 | 의미 |
|---|---|
| **총 건수** | 전체 행 (active 만) |
| **운영비 — 대기** | 비인건비 (대관·교통·인쇄) 중 미지급 |
| **운영비 — 완료** | 같음 + 지급 완료 |
| **인건비 — 대기** | 인건비 (강사료·외주) 중 미지급 |
| **인건비 — 완료** | 같음 + 지급 완료 |

### 상태 표준화 (2026-05-28)

| `payment_status` | 한글 라벨 | 색 |
|---|---|---|
| `draft` / `submitted` | 대기 | 회색 |
| `received` | 대기 | 황색 |
| `processing` | 처리중 | 파랑 |
| `paid` | 완료 | 민트 |
| `cancelled` / `rejected` | 반려 | 빨강 |

### 등록 흐름

```
1. [+ 등록] 또는 견적서 → [지급요청]
2. PayrollExpenseFormModal
   - 지급처 (강사·외주처) — staff_pool 검색 또는 직접 입력
   - 프로젝트·프로그램 연결
   - 금액 + 세금 유형 (3.3 / 8.8 / 면세)
   - GENERATED: tax_amount, net_amount 자동 계산
   - 증빙 파일 (receipt_urls JSONB)
3. 저장
4. payment_status 진행 (draft → submitted → received → processing → paid)
```

### 견적서 → 지급요청 변환 (STEP-ACCOUNTING-FOLLOWUP)

견적 [종합·프로그램별] 탭 → [지급요청에서 가져오기] → 선택·수정·전송 → 행별 [↑↓ 수정 삭제].

### 강사료 PDF 발급

```
사이드바 외주·급여 → 행 → [PDF]   (개별)
프로그램 상세 → 강사료 탭 → [일괄 PDF]   (배치)
강사 포털 → 자료 → 강사료 → [PDF]   (강사 본인)
```

PDF 유틸 — `src/utils/feeFormPDF.ts` + `feeFormHTML.ts`. 양식 표준화.

---

## 지출 (`/expense`)

### 유형 분류 (6+종 자유 추가)

| 기본 분류 | 예시 |
|---|---|
| 인건비 | 강사료·외주용역비·자문료 |
| 시설·장비 | 대관료·장비사용료·렌탈 |
| 숙박·식비 | 숙박비·식비·다과 |
| 교통 | 버스임차·KTX·항공·택시 |
| 인쇄·제작 | 현수막·자료집·굿즈 |
| 기타 | 직접 입력 |

⚙️ `/admin` 에서 분류 추가·삭제·순서 변경 가능.

### 항목별 필드

- 프로젝트·프로그램 연결 (필수)
- 지급처 (clients 또는 staff_pool 연동)
- `gross_amount` + 부가세 여부
- 원천징수 `withholding_type` (none / business_3_3 / other_8_8)
- 지급 상태 (대기 / 출금완료 / 반려)
- 세금계산서 연결 (`receipts`)
- 증빙 파일 (드래그앤드롭, Ctrl+V)

### 사이드바 흐름

```
사이드바 "지출" → 프로젝트별 필터 → 행 등록·수정 → [출금완료]
                                              ↓
                                       receipts 연결
```

---

## 증빙 (`/receipts`)

### 페이지 구조

영수증·세금계산서를 종류별로 모아 보는 페이지. 지출 행 → 증빙 연결로 자동 노출.

### 자주 하는 일

| 상황 | 어디서 |
|---|---|
| 영수증 일괄 첨부 | 지출 행 → 우측 [영수증] → 다중 업로드 |
| 세금계산서 발행처 등록 | 고객사 → 담당자 → 세금계산서 정보 |
| 회계사 전달 | `/accounting-portal` → 토큰 발급 |

---

## 정산 (`/settlements`) — 5단계 워크플로우

### `SettlementStep` 5종

```
1: 정산 요청     (PM 시작)
2: 정산 검토     (FINANCE 확인)
3: 회계 검토     (회계사무소 외부)
4: 지급 처리     (실제 송금)
5: 종료          (완료 + 보관)
```

### 흐름

```
PM → 정산 요청 (지출 행들 일괄 선택)
  ↓
FINANCE → 검토·승인 또는 [반려]
  ↓
회계사무소 (외부 토큰) → 검토 코멘트
  ↓
FINANCE → [지급 처리] (은행 송금 실행)
  ↓
종료 → 보관·통계
```

---

## 직원 급여 (`/payroll-mgmt`) — STEP-PAYROLL-SYSTEM (2026-05-28)

내부 직원 (`profiles`) 의 급여명세서 + 지출결의서.

### 탭 구조

| 탭 | 컴포넌트 | 역할 |
|---|---|---|
| 직원 | `EmployeeTab` | 직원 등록·기본급·수당 설정 |
| 급여명세서 | `PayrollSlipTab` | 월별 자동 계산 + PDF |
| 지출결의서 | `PayrollRegisterTab` + `ExpenseClaimTab` | 출장·복지 등 |

본인 시점은 `/my-payroll` — 본인 명세서만.

---

## 핵심 SQL 패턴

### 미지급 강사료 합계

```sql
SELECT
  COUNT(*) AS 미지급건수,
  SUM(subtotal) AS 합계금액
FROM payroll_expenses
WHERE payment_status IN ('draft','submitted','received','processing')
  AND expense_type ~ '강사|컨설팅|멘토|TA';
```

### 프로젝트별 수입·지출 잔액

```sql
WITH income AS (
  SELECT project_id, SUM(amount) AS in_total
    FROM income WHERE project_id IS NOT NULL GROUP BY project_id
), expense AS (
  SELECT project_id, SUM(gross_amount) AS out_total
    FROM expenses WHERE project_id IS NOT NULL GROUP BY project_id
)
SELECT p.name, COALESCE(i.in_total,0) AS 수입,
       COALESCE(e.out_total,0) AS 지출,
       COALESCE(i.in_total,0) - COALESCE(e.out_total,0) AS 잔액
  FROM projects p
  LEFT JOIN income i  ON i.project_id = p.id
  LEFT JOIN expense e ON e.project_id = p.id;
```

---

## 알아둘 점

- ⚠️ **자사 (`is_own_company=true`) 는 거래처 분류 아님** — 별도 표시. 컨소시엄 운영사 또는 참여사 위치 자유.
- ⚠️ **부가세 분리 (2026-05-25)** — 모든 신규 수입·지출 행은 공급가액 + 부가세 + 합계 3개 컬럼 보유.
- ⚠️ **payroll_expenses 컬럼명 매핑** — 명세는 `expense_category` 인데 실제는 `expense_type`. 같은 의미.
- ⚠️ **`status` 컬럼은 `payment_status`** — payroll 한정.
