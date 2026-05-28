# 05. 보고서 — 결과보고서 · 재무리포트 · 통계

## 두 가지 보고서 시스템

| 종류 | 경로 | 대상 | 양식 |
|---|---|---|---|
| **재무 리포트** | `/reports` | 전체 사업 KPI·차트 | SVG 막대·도넛 + 항목 커스터마이징 |
| **결과보고서** | `/programs/:id` → 결과보고 탭 | 프로그램·프로젝트 단위 | 4단 구성 (운영계획·진행결과·만족도·총평) |
| **재무 보고서 (PDF)** | `/reports/project/:id` | 프로젝트 종합 | 자동 집계 + 사진 + 차트 |

---

## 재무 리포트 (`/reports`)

### KPI 6개

| 카드 | 값 | 전월 대비 |
|---|---|---|
| 총 수입 | `income_contracts` 합계 | 변화율 % |
| 총 지출 | `expenses + payroll_expenses` | 같음 |
| 미수금 | 청구 - 수금 | 같음 |
| 미지급 | 지출 대기 + 강사료 대기 | 같음 |
| 사업 수 | active projects | 같음 |
| 프로그램 수 | active programs | 같음 |

### 차트

| 차트 | 데이터 |
|---|---|
| 월별 수입·지출 막대 | 최근 12개월 |
| 비목별 지출 도넛 | account_code 기준 |
| 프로젝트별 잔액 | 상위 10개 |

### 항목 커스터마이징 (`report_layouts`)

사용자별 보고서 레이아웃을 DB 에 저장. 카드 순서·차트 추가/제거 자유.

`unique(user_id, ledger_type)` — own / consortium 별로 별도 레이아웃.

---

## 결과보고서 (`ReportBuilderTab` + `ReportReviewTab`)

### 4단 구성 (program-report-builder 스킬 패턴)

```
1️⃣ 운영계획서
   - 사업 개요·목적·기간·장소·예산
2️⃣ 진행 결과
   - 회차별 결과·참가자 통계·사진
3️⃣ 만족도
   - 설문 결과 + 그래프 (analyze-survey 활용 가능)
4️⃣ 총평
   - 종합 평가·개선점·후속 제안
```

### 자동 집계 항목

| 항목 | 소스 |
|---|---|
| 기본정보 | `programs` + `projects` |
| 참여 인력 | `program_members` + `instructor_invitations` |
| 예산 집행 | `expenses` + `payroll_expenses` |
| 참가자 통계 | `program_participants` + `attendance_records` |
| 만족도 | `surveys` + 응답 |
| 사진 | `mentoring_logs.photo_urls` + `curriculum_logs.photos` |

### 작성 흐름

```
1. 프로그램 상세 → [결과보고] 탭
2. ReportBuilderTab — 자동 채움 데이터 확인
3. [+ 섹션 추가] — placeholder 빈칸 보강
4. [AI 초안] — analyze-survey + ai-chat 조합
5. [미리보기] → PDF 다운로드 또는 [제출]
6. PM 검토 → ReportReviewTab → [승인]/[반려]
```

### `performance_reports` 핵심 컬럼

| 컬럼 | 의미 |
|---|---|
| `status` | draft / submitted / approved / rejected |
| `business_summary` | 사업 개요 서술 |
| `sales_method` | 판매·홍보 방법 |
| `achievement_notes` | 성과 서술 |
| `photo_urls` | 홍보사진 (최대 6장) |
| `mentor_feedback` | 멘토 검토 의견 |

### 자주 하는 일

| 상황 | 어디서 |
|---|---|
| 결과보고 자동 채움 | 결과보고 탭 → [자동 채움 새로고침] |
| AI 초안 생성 | [AI 생성] 버튼 (있는 경우) |
| placeholder 빈칸 확인 | 빨간 동그라미 ▢ 표시된 곳 |
| PDF 다운로드 | [PDF] 버튼 (최종 승인 후) |

---

## 프로젝트 종합 보고서 (`/reports/project/:id`)

전체 프로젝트 종합 — 모든 프로그램 + 재무 + 사진 통합. 결과보고서가 1차 자료, 이건 2차 통합.

### 활용

- 발주처 최종 제출용
- 정산 시 동봉
- 차년도 사업 기획 참조

---

## 통계 페이지·위젯

### 홈 대시보드 (`DashboardPage`)

| 위젯 | 데이터 |
|---|---|
| 미션·비전 | 하드코딩 (`MissionVisionSection`) |
| KPI 6개 | `fetchDashboardKpis` |
| 인사말 | 사용자 + 현재 시간대 |
| 단계별 진행 | 프로젝트 lifecycle 카운트 |
| 태스크 알림 | 마감 임박·지연 태스크 |
| 최근 지출 | `fetchRecentExpenses` |
| 빠른 액션 | 4개 바로가기 |
| 긴급 위젯 | 결재·서류 미제출 등 |
| 재무 대시보드 | 하단 통합 |

### 프로그램 상세 → 개요 탭

| 위젯 | 데이터 |
|---|---|
| 흐름도 카드 (제안→계약→운영→종료) | program.status |
| KPI 4개 | 신청·출석·일지·만족도 |
| 단계 시작일 (PhaseDateSection) | 자동 추론 |
| 빠른 액션 4개 | 출석·외부 폼·신청 검토·일지 |
| 수정요청 배지 | `editRequests` |

---

## 알아둘 점

- ⚠️ **결과보고서 사진은 `performance_reports.photo_urls` 별도 컬럼** — 멘토링 일지 사진과 다른 위치
- ⚠️ **재무 리포트 KPI 는 `income_contracts` 가 정확** — 구 `income` 테이블은 일부 누락 가능
- ⚠️ **만족도 분석 AI 는 `analyze-survey` Edge Function** — ANTHROPIC_API_KEY 등록 필요
- ⚠️ **결과보고서 자동 채움은 K 묶음 (대규모 행사) 패턴 활용** — 9개 결과보고서 사례 반영

---

## 다음 추가 가능한 보고서 (선택)

| 보고서 | 우선순위 |
|---|---|
| 중간 보고서 | 2순위 |
| 착수 보고서 | 3순위 |
| 월간 공정 보고 | 4순위 |
| 회계·세무 보고서 | 추후 |
