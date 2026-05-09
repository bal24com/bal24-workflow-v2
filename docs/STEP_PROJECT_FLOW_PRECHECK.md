# STEP-PROJECT-FLOW 사전 확인 — 프로젝트 흐름도 카드 타임라인

> 작성일: 2026-05-09
> 목적: 프로젝트 상세 Overview 탭에 묶인 programs 를 `display_order` 순 카드 타임라인으로 표시
> 전제: STEP-PROGRAM-TYPE (program_type 13종 + display_order + modules) + STEP-PROGRAM-ASSIGNMENT 완료

---

## 섹션 1 — 핵심 결론 요약

1. **현재 OverviewTab (108줄)**: 3 컬럼 그리드 — 좌(재무·참여인력·**EventsTimelineCard**) / 중앙(기본정보·설명) / 우(활동·NextAction·QuickActions). 흐름도 카드 X.
2. **EventsTimelineCard (135줄) 이미 존재**: `programs + schedule_events` 통합 타임라인 (start_date 순). 박경수님 명세의 "흐름도 카드" 와 **목적·시각이 다름** — EventsTimelineCard 는 이벤트 리스트, 흐름도는 카드 시각화 (이모지·진행상태). **별개 컴포넌트로 신규 작성 권장**.
3. **`fetchProjectEvents` 가 이미 programs fetch**: `projectDetailUtils.ts:122` 에서 `id, name, type, status, start_date, end_date, venue` fetch — 단 **`program_type`·`display_order`·`modules` 미포함**. 흐름도용으로는 신규 fetch 필요 (또는 SELECT 확장).
4. **Program 컬럼 준비 완료**: `program_type` (13종 이모지 매핑 가능) · `display_order` (정렬 키) · `consortium_id` (담당사 link) 모두 STEP-PROGRAM-TYPE/MODULE-RENDER 에서 보강 완료.
5. **신규 구현 범위**: `ProgramFlowCard.tsx` (가로 스크롤 카드 타임라인) 1개 + OverviewTab 1줄 추가 + `projectDetailUtils.ts` SELECT 확장 (또는 신규 함수).

---

## 섹션 2 — 가져올 것 / 버릴 것

### V7 차용
- **V7 패턴 0건**: V7 의 EducationDetailV9 는 **단일 프로그램** 상세 페이지 (V2 ProgramDetailPage 매핑). 프로젝트 단위 "여러 프로그램 흐름도" 는 V7 에 없음 — **V2 신규 도입**.

### V2 신규
- **유형 이모지 + 컬러 토큰**: `programTypeConfig.ts` 의 `getProgramTypeConfig(programType)` 활용 → 이모지·컬러 즉시 적용 ✓
- **진행 상태 배지**: `PROGRAM_STATUS_STYLE` (`utils/statusStyles.ts`) 활용 — 준비/진행/완료/취소 4종
- **가로 스크롤 카드**: V2 표준 `overflow-x-auto` + `flex` + `shrink-0` 패턴 (CertificatePage·SettlementPage 에서 사용)
- **카드 클릭 → /programs/:id**: `react-router-dom Link` 일반 패턴

### 기존 Overview 콘텐츠 — 유지
- 3 컬럼 그리드 (좌·중앙·우) **그대로 유지**
- 흐름도는 그리드 **위 (전체 너비)** 에 추가 — 박경수님 Q1-A 추천대로

### 버릴 것
- ❌ 0건 (기존 카드 모두 유지)

---

## 모듈 ↔ 흐름도 카드 표시 정보 (제안)

| 영역 | 표시 |
|---|---|
| 좌측 | 유형 이모지 (예: 📚 교육 / 🤝 멘토링) |
| 상단 | 프로그램명 (truncate) |
| 중간 | 일정 (`start_date ~ end_date`, 또는 `start_date`만) |
| 하단 | 진행 상태 배지 (준비/진행/완료/취소) + 담당사 (Q4 결정에 따라) |
| 카드 사이 | 화살표 (lucide ChevronRight) |
| 비어 있을 때 | "프로그램을 추가해 주세요" + Plus 버튼 (→ ProgramsPage) |

---

## 섹션 3 — 파일 분할 계획

### 신규 파일 1개

| 파일 | 줄 수 (예상) | 역할 |
|---|---|---|
| `src/pages/projects/detail/overview/ProgramFlowCard.tsx` | ~150 | programs fetch + 가로 스크롤 카드 타임라인 + 빈 상태 |

### 수정 파일 2개

| 파일 | 현재 | 수정 내용 | 예상 후 |
|---|---|---|---|
| `src/pages/projects/detail/OverviewTab.tsx` | 108 | grid 위에 `<ProgramFlowCard projectId={projectId} />` 한 줄 추가 | ~115 |
| `src/pages/projects/detail/projectDetailUtils.ts` | — | (선택) `fetchProjectEvents` 의 SELECT 에 `program_type, display_order` 추가 또는 별도 `fetchProjectPrograms()` 신규 | +10 |

→ **추천**: 별도 `fetchProjectPrograms()` 신규. EventsTimelineCard 의 fetch 는 그대로 유지 (start_date 순 + schedule_events 통합) — 책임 분리.

### V-1 (400줄) 위반 risk
- ProgramFlowCard ~150 → 안전 (단일 신규)
- OverviewTab 108 → ~115 → 매우 안전
- projectDetailUtils.ts (현재 ~150 추정) → 미확인이지만 안전 범위

→ **분리 작업 불필요**. 직접 진행 가능.

---

## 섹션 4 — 의사결정 사항 Q1~Q7 (2개 보강)

### Q1. 흐름도 배치 위치

| 옵션 | 처리 |
|---|---|
| **A (추천)** | 기존 Overview 탭의 3 컬럼 grid **상단에 전체 너비** 로 추가 (grid 위) |
| B | 별도 "흐름도" 탭 신규 생성 (TabKey 5 → 6) |

**추천 A**: 흐름도 = 프로젝트 한눈 파악의 핵심. 진입 즉시 보여야 가치. 별도 탭은 한 번 더 클릭 필요.

### Q2. 카드 배치 방향

| 옵션 | 처리 |
|---|---|
| **A (추천)** | 가로 스크롤 (왼→오른쪽 흐름) — 스토리텔링 적합 |
| B | 세로 목록 (모바일 친화적) |

**추천 A**: 박경수님 명세의 핵심 메타포 ("흐름") 와 시각적으로 일치. 모바일은 자동 가로 스크롤로 대응 (`overflow-x-auto`).

### Q3. 프로그램 0건 처리

| 옵션 | 처리 |
|---|---|
| **A (추천)** | "프로그램을 추가해 주세요" 빈 상태 + Plus 버튼 (→ /programs?새 등록) |
| B | 흐름도 섹션 자체를 숨김 |

**추천 A**: PM 에게 "여기에 프로그램 추가하세요" 명확한 호출. 박경수님 패턴 (V2 의 EmptyState 헬퍼 다른 곳에도 많음).

### Q4. 담당사 표시

| 옵션 | 처리 |
|---|---|
| A | 카드에 담당사명 표시 (`program_assignments` join + lead 우선) |
| **B (추천)** | 담당사 표시 없음 — 이번 STEP 범위 최소화 |

**추천 B**: STEP-PROGRAM-ASSIGNMENT 가 완료되어 데이터는 있지만, 흐름도 카드에 너무 많은 정보가 들어가면 시각적 부담. **다음 STEP-PROJECT-FLOW-V2** 또는 카드 hover 시 툴팁으로 담당사 추가 검토 가능. 박경수님 명세 추천도 B.
**대안 A 도 합리적**: STEP-PROGRAM-ASSIGNMENT 데이터를 활용하면 더 풍부한 정보. 단 추가 fetch 비용 + 카드 layout 압박.

### Q5. 카드 클릭 시 동작

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `/programs/:id` 상세 페이지로 이동 |
| B | 모달로 프로그램 요약 표시 |

**추천 A**: 박경수님 명세대로. V2 의 다른 흐름 (ConPrograms·SettlementPage) 도 모두 카드 → 상세 이동 패턴.

### ⚠️ Q6 (보강) — 정렬 키

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `display_order ASC` (사용자 지정 순서 우선) — null/0 인 경우 `start_date` fallback |
| B | `start_date ASC` (시간순) |
| C | 두 키 동시 정렬 (`display_order, start_date`) |

**추천 A**: 박경수님이 STEP-PROGRAM-TYPE 에서 display_order 컬럼을 추가한 의도와 일치. 사용자가 직접 흐름 순서를 정한 것이 시간순보다 우선.

### ⚠️ Q7 (보강) — 진행 상태 시각화 강도

| 옵션 | 처리 |
|---|---|
| **A (추천)** | 상태 배지 (준비/진행/완료/취소) — 기존 `PROGRAM_STATUS_STYLE` 활용 |
| B | 카드 전체 컬러 변화 (예: 완료=회색 dimmed, 진행=violet 강조) |
| C | 진행률 바 (참석률/완료율) — 추가 fetch 필요 |

**추천 A**: 단순·일관성 ↑. **B 의 dimmed 도 같이 적용 권장** (완료된 프로그램은 카드 opacity 0.7) — 시각적 흐름 강조.

---

## 박경수님 답변 양식

```
Q1   (배치):       A 추천대로 (Overview 상단) / B 별도 탭
Q2   (방향):       A 추천대로 (가로 스크롤) / B 세로 목록
Q3   (빈 상태):    A 추천대로 (안내 + Plus) / B 숨김
Q4   (담당사):     A 표시 / B 추천대로 (이번엔 미표시)
Q5   (클릭):       A 추천대로 (상세 이동) / B 모달
Q6   (정렬):       A 추천대로 (display_order + fallback) / B start_date / C 둘 다
Q7   (시각화):     A 추천대로 (배지) / B 카드 dimmed / C 진행률 바

SQL 실행 여부: 없음 (이번 STEP UI만 — DB 변경 0)
```

---

## 짚어둘 점 (코드 진입 전)

1. **EventsTimelineCard 와 충돌 X**: 이번 ProgramFlowCard 는 흐름도(카드 시각), EventsTimelineCard 는 이벤트 리스트(시간순) — 목적이 달라 둘 다 유지. UX 상 OverviewTab 에서 두 컴포넌트가 어떤 위치에서 겹치지 않게 배치 (흐름도는 상단 전체 너비, EventsTimelineCard 는 좌측 컬럼 그대로).

2. **fetchProjectPrograms 신규 vs 기존 fetchProjectEvents 확장**: 후자는 EventsTimelineCard 가 이미 사용 중이라 SELECT 확장 시 영향 검토 필요. **신규 함수가 안전**.

3. **`program_type` null 처리**: STEP-PROGRAM-TYPE 의 SQL 백필로 모든 행이 채워져 있을 텐데, 안전상 `getProgramTypeConfig(p.program_type ?? p.type)` 폴백 권장. 기존 type(4종) 도 매핑 가능.

4. **`display_order` 동률 처리**: 같은 값 (예: 0, 0, 0) 일 때 `start_date` 보조 정렬 필요. SQL `.order('display_order').order('start_date')` 두 단계.

5. **카드 너비**: 280px 고정 권장 (가로 스크롤 시 한 화면에 4~5개). `min-w-[280px]` Tailwind.

6. **빈 상태 + Plus 버튼**: `<Link to="/programs">` 가 일반적이지만 더 정확하게는 `/programs?action=create&projectId={id}` (쿼리 파라미터 전달) — 단 ProgramsPage 가 쿼리 자동 처리 안 하면 그냥 `/programs` 로 가서 PM 이 수동 등록.

7. **모바일 UX**: 가로 스크롤 + 스크롤 인디케이터 (오른쪽 그라데이션 fade 마스크) 권장.

8. **롤백**: 변경 X (UI만). 단일 commit `git revert`.

9. **후속 STEP 후보**:
   - STEP-PROJECT-FLOW-V2: 담당사 표시 (Q4-A) + hover 툴팁 + 진행률 바
   - STEP-PROJECT-FLOW-DRAG: 드래그앤드롭 순서 변경 (display_order 자동 업데이트)
   - STEP-PROJECT-FLOW-AI: 흐름 자동 제안 (현재 program_type 조합 → 다음 추천 program_type)
