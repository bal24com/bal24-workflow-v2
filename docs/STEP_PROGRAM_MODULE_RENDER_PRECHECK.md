# STEP-PROGRAM-MODULE-RENDER 사전 확인 — 프로그램 상세 탭 동적 렌더

> 작성일: 2026-05-09
> 목적: `programs.modules` 배열 기반으로 ProgramDetailPage 의 탭을 동적으로 표시
> 전제: STEP-PROGRAM-TYPE 완료 (DB·types·ProgramFormModal·Selector 적용 완료)

---

## 섹션 1 — 핵심 결론 요약

1. **현재 탭 구조**: `ProgramDetailPage.tsx` 의 `TabKey` (8종) + `TABS` 배열 + 8 개 조건부 렌더 모두 **하드코딩** (라인 30-41 + 184-218). 동적 분기 0건.
2. **8 탭 vs 28 modules**: 박경수님 명세의 28 종 modules 중 V2 가 실제 컴포넌트로 구현한 건 **8 종만**. 나머지 **20 종은 UI 미구현** (탭 컴포넌트 없음).
3. **`programs.modules` 컬럼**: STEP-PROGRAM-TYPE 에서 추가됨 (jsonb). `Program.modules?: string[] \| null` 타입 보강도 완료. 현재 ProgramDetailPage 의 `SELECT_COLUMNS` 는 `*` 포함이라 자동으로 가져옴 — but 코드에서 사용 안 함.
4. **`SELECT_COLUMNS` 변경 불필요**: `'*, project:projects(...)'` 가 이미 `modules`·`program_type` 자동 포함.
5. **수정 범위**: `ProgramDetailPage.tsx` 1 파일 — TABS 동적 필터링 + 미구현 모듈 placeholder + 공통 탭 강제 표시. 신규 파일 0~1개 (`programModuleConfig.ts` 권장 — modules id ↔ TabKey 매핑 표).

---

## 섹션 2 — 가져올 것 / 버릴 것

### V7 에서 차용 (참고만)
V7 `pages/PublicEducation.tsx:350-590` 의 동적 노출 패턴:
- **`canShowBlock(blockId): boolean`** 헬퍼 — template + role 기반 노출 결정
- **`inClientTab(tabId)`** — 탭 단위 노출
- **`showsToStudent('showXxx')`** — 학생 권한 노출
- 블록·탭 분리 (블록은 한 탭 안의 섹션 단위)

→ V7 의 패턴은 **외부 페이지의 항목 노출** 용. V2 STEP-PROGRAM-MODULE-RENDER 는 **내부 PM 페이지의 탭 노출** 이라 직접 차용은 X. 단 **`canShowBlock` 같은 단일 함수 + 미리 정의된 매핑** 구조는 차용 가능.

### V2 신규 (V7 에 없는 것)
- **modules id (28종) ↔ TabKey (8종) 매핑 표**: 28 종 중 8 종만 실제 탭 보유. 나머지 20 종은 "준비 중".
- **공통 탭 (always-on)** 개념: `overview`·`files`·`report` 는 modules 와 무관하게 항상 표시 (전제 조건)
- **placeholder 탭** (Q4=A): 미구현 모듈도 탭 자체는 보여주되 안내 문구 + "준비 중" 표시

### 버릴 것
- 현재 하드코딩된 8 탭 무조건 표시 정책 (modules 와 무관) → 동적 필터링으로 대체

---

## 모듈 ↔ 탭 매핑 (28 modules vs 8 + α 탭)

| 모듈 ID | 한글 라벨 | 매핑 탭 | 현재 컴포넌트 | 상태 |
|---|---|---|---|---|
| **overview** | 개요 | overview | `OverviewTab.tsx` (219줄) | ✅ 공통 (항상 표시) |
| **files** | 파일 | files | `ProgramFilesTab.tsx` (17줄) | ✅ 공통 (항상 표시) |
| **report** | 결과보고서 | report | `ReportBuilderTab.tsx` (396줄) | ✅ 공통 (항상 표시 권장) |
| **curriculum** | 커리큘럼 | curriculum | `CurriculumTab.tsx` (277줄) | ✅ 조건부 |
| **staff** | 강사 | staff | `StaffStudentsTab.tsx` (217줄) | ✅ 조건부 |
| **attendance** | 출석·일지 | attendance | `AttendanceLogTab.tsx` (157줄) | ✅ 조건부 |
| **survey** | 만족도 | survey | `SurveyResultTab.tsx` (151줄) | ✅ 조건부 |
| **participants** | 참여자 | (staff 통합 중) | — | ⚠️ 매핑 결정 필요 |
| **mentoring** | 멘토링 | (없음) | — | ❌ 준비 중 |
| **domestic_travel** | 국내 이동 | (없음) | — | ❌ 준비 중 |
| **flight** | 항공·탑승수속 | (없음) | — | ❌ 준비 중 |
| **overseas_travel** | 해외 이동 | (없음) | — | ❌ 준비 중 |
| **event_schedule** | 행사 일정 | (없음) | — | ❌ 준비 중 |
| **promotion** | 홍보물 | (없음) | — | ❌ 준비 중 |
| **checklist** | 운영 체크리스트 | (없음) | — | ❌ 준비 중 |
| **recruitment** | 모집·선발 | (없음) | — | ❌ 준비 중 |
| **seller** | 셀러 관리 | (없음) | — | ❌ 준비 중 |
| **booth** | 부스 배치 | (없음) | — | ❌ 준비 중 |
| **experience** | 체험 프로그램 | (없음) | — | ❌ 준비 중 |
| **sns** | SNS 운영 | (없음) | — | ❌ 준비 중 |
| **content_plan** | 콘텐츠 계획 | (없음) | — | ❌ 준비 중 |
| **deliverable** | 산출물 | (없음) | — | ❌ 준비 중 |
| **approval** | 발주처 승인 | (없음) | — | ❌ 준비 중 |
| **environment_analysis** | 환경·여건 분석 | (없음) | — | ❌ 준비 중 |
| **demand_survey** | 수요조사·설문 | (없음) | — | ❌ 준비 중 |
| **feasibility** | 타당성 검토 | (없음) | — | ❌ 준비 중 |
| **community_participation** | 주민참여 | (없음) | — | ❌ 준비 중 |
| **field_management** | 현장관리 | (없음) | — | ❌ 준비 중 |

**합계**:
- ✅ 구현된 모듈 (탭 있음): **7종** (overview · files · report · curriculum · staff · attendance · survey)
- ❌ 미구현 (탭 없음): **20종** + ⚠️ participants (1종, 매핑 결정 필요)
- 별개: **share** 탭 (외부 공유) — modules 와 무관 — Q3 결정 필요

---

## 섹션 3 — 파일 분할 계획

### A. 신규 파일 (1개 권장)

| 파일 | 줄 수 (예상) | 역할 |
|---|---|---|
| `src/pages/programs/programModuleConfig.ts` | ~80 | 28 modules ↔ TabKey 매핑 + Icon + label + isAlwaysVisible 플래그 + 미구현 모듈 placeholder 라벨 |

### B. 수정 파일 (1개)

| 파일 | 현재 줄 수 | 수정 내용 | 예상 후 |
|---|---|---|---|
| `src/pages/programs/ProgramDetailPage.tsx` | ~225 | TABS 하드코딩 → `program.modules` + 공통 탭 + Q4 placeholder 동적 빌드 + tab state 가 사라진 모듈일 때 첫 탭으로 fallback | ~265 (V-1 안전) |

### C. 신규 placeholder 컴포넌트 (선택, Q4=A 시)

옵션 A1 (권장): `ProgramDetailPage.tsx` 안에 inline `function PlaceholderTab({ moduleId, label })` (15 줄 정도). 별도 파일 X.

옵션 A2: `src/pages/programs/detail/PlaceholderModuleTab.tsx` 신규 (15~30 줄). 향후 미구현 모듈 안내 문구 통일.

→ **옵션 A1 선택 권장** (V-1 안전 + 단순). 향후 미구현 모듈이 실제 구현되면 점진적으로 빼고 실제 컴포넌트로 교체.

### D. 후속 STEP (이번 범위 외)
- **STEP-PROGRAM-MODULE-MENTORING**: mentoring 탭 신규 컴포넌트
- **STEP-PROGRAM-MODULE-EVENT**: event_schedule + promotion + checklist 묶음
- **STEP-PROGRAM-MODULE-MARKET**: seller + booth (마켓·박람회용)
- **STEP-PROGRAM-MODULE-DELIVERABLE**: deliverable + approval (납품용)
- **STEP-PROGRAM-MODULE-RESEARCH**: environment_analysis + demand_survey + feasibility (조사·연구용)
- (기타 모듈은 사용 빈도 보고 우선순위 결정)

---

## 섹션 4 — 의사결정 사항 Q1~Q6 (1개 추가)

### Q1. `modules` 가 비어 있거나 null 인 프로그램 처리

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `program_type` 기본 템플릿 탭 세트로 폴백. `program_templates` 에서 base_type 매칭하여 첫 시스템 템플릿의 modules 사용 |
| B | 모든 탭 (8) 표시 (현재 동작 그대로) |
| C | 공통 탭 3종 (overview·files·report) 만 표시 |

**추천 A**: STEP-PROGRAM-TYPE 의 자연스러운 연장. 기존 행 백필 (UPDATE 시 modules 채우기) 추가하면 더 깔끔. 단 폴백 fetch 추가 비용 있음.
**대안 C 도 합리적**: 단순하고 폴백 fetch 불필요. 공통 3 탭만 안전하게 보임.

### Q2. 탭 렌더링 순서

| 옵션 | 처리 |
|---|---|
| A | `modules` 배열 순서대로 (사용자 정의 순서 가능) |
| **B (추천)** | 고정 순서 (기존 TABS 배열 순서) + modules 에 없는 것만 숨김 |

**추천 B**: UX 일관성. 매번 같은 위치에 같은 탭. 박경수님 명세 추천도 A 인데 V2 패턴 (Project·Consortium 모두 고정 순서) 고려하면 B 가 더 자연스럽움.

### Q3. 공통 탭 (overview · files · report · share) 처리

| 옵션 | 처리 |
|---|---|
| **A (추천)** | overview·files 는 항상 표시 (modules 무관). report·share 는 modules 따라 |
| B | 모두 modules 에 포함된 경우만 표시 |
| C | 4 종 모두 항상 표시 |

**추천 A**: overview·files 는 모든 프로그램의 기본 진입점. report·share 는 일부 프로그램 (예: '이동' 전용) 에서 불필요할 수 있음.

### Q4. 탭 컴포넌트 없는 모듈 (20종) 처리

| 옵션 | 처리 |
|---|---|
| **A (추천)** | 탭은 표시하되 "준비 중" placeholder 본문 |
| B | 컴포넌트 없는 모듈은 탭 목록에서 제외 |

**추천 A**: 사용자가 "내 프로그램 modules 에 X 가 있는데 탭이 안 보여" 혼란 방지. placeholder 가 후속 STEP 추가 시 자연스러운 자리 잡기. UI 가 비어 있는 어색함은 친근한 안내 (`✦ 모듈 곧 추가될 거예요`) 로 완화.

### Q5. 탭 변경이 기존 데이터에 영향 주는지

**확인 결과**: ❌ **DB 데이터 영향 0건**.
- 탭은 단순 UI 노출 — DB UPDATE/DELETE 없음
- modules 배열 변경 시 (ProgramFormModal 수정) 도 `programs.modules` 컬럼만 update
- 다른 테이블 (`program_curriculum`·`attendance_sessions`·`activity_logs` 등) 은 modules 와 무관하게 program_id 로 조회 — 탭 숨겨도 데이터 보존
- 미래에 modules 다시 추가하면 데이터 그대로 표시

**유일한 주의점**: 사용자가 modules 에서 항목 제거 → 탭 사라짐 → "데이터 사라진 것 같아" 오인. 안내 toast 권장 ("탭은 숨겨졌지만 데이터는 보존돼요. modules 다시 추가하면 바로 표시돼요.")

### ⚠️ Q6 (보강) — `participants` 모듈 매핑

`participants` 는 박경수님 modules 28종 중 1번째 항목 ("참여자") 이지만 V2 의 `staff` 탭 안에 이미 통합되어 있음 (`StaffStudentsTab` = 강사 + 교육생 통합).

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `participants` → `staff` 탭으로 매핑 (alias). modules 에 어느 쪽이든 있으면 `staff` 탭 표시 |
| B | participants 별도 탭 신규 작성 (StaffStudentsTab 분리) |
| C | participants 모듈 자체 제거 (modules 28→27) |

**추천 A**: 코드 변경 최소. `staff` 탭이 이미 강사·교육생 모두 다루므로 의미상 일치. modules 매핑 표에 alias 등록.

---

## 박경수님 답변 양식

```
Q1   (modules null 처리):     A 추천대로 (program_type 폴백) / B 모든 탭 / C 공통 3 탭만
Q2   (탭 순서):              A modules 배열 순 / B 추천대로 (고정 순서)
Q3   (공통 탭):              A 추천대로 (overview·files 항상) / B 모두 modules 따라 / C 4종 모두
Q4   (미구현 모듈):          A 추천대로 (placeholder) / B 제외
Q5   (데이터 영향):          확인 — 영향 0건 (UI 노출만)
Q6   (participants 매핑):    A 추천대로 (staff alias) / B 별도 탭 / C 모듈 제거

SQL 실행 여부: 없음 (이번 STEP 은 SQL 0건 — UI 만 변경)
```

---

## 짚어둘 점 (코드 진입 전)

1. **share 탭 정책**: 박경수님 명세의 28 modules 에 'share' 가 없음. share 는 외부 공유 PM 도구라 modules 와 별개로 보는 게 자연스러움. Q3 의 `report·share modules 따라` 옵션은 share 를 어떻게 처리할지 결정 필요.

2. **탭 state 안전성**: 현재 `tab` state 가 사라진 모듈을 가리키면 (예: 사용자가 modules 에서 'curriculum' 제거 후 새로고침) 빈 화면. 첫 가시 탭으로 fallback 로직 필요 (`useEffect([visibleTabs], () => if (!visibleTabs.includes(tab)) setTab(visibleTabs[0]))`).

3. **`participants` modules id 검토**: ProgramFormModal 의 모듈 체크박스 (MODULE_OPTIONS 28종) 에서 사용자가 'participants' 체크 → `staff` 탭이 보여야 자연스러움. 이걸 위해 매핑 표 권장.

4. **modules 백필 권장 (Q1=A 채택 시)**: 기존 programs 행의 modules=null 을 program_type 기본 템플릿으로 백필 SQL 한 번 실행하면 폴백 fetch 0번. UPDATE 1회로 끝.

5. **AI · 결과보고서 통합**: 결과보고서 탭은 모든 program_type 의 시스템 템플릿에 포함 — 사실상 "공통" 으로 처리 가능. Q3=A 채택 시 report 도 항상 표시 옵션 검토.

6. **롤백**: SQL 변경 없음. 코드는 단일 commit `git revert` 한 줄.

7. **후속 모듈 구현 우선순위**: 28-7=21 미구현 모듈 중 박경수님 사업 빈도 기준 우선순위:
   - 1순위 (창업교육 표준): mentoring (4 템플릿이 사용)
   - 2순위 (행사·마켓): event_schedule · promotion · checklist · seller · booth
   - 3순위 (조사·연구): environment_analysis · demand_survey · feasibility
   - 4순위 (이동): domestic_travel · flight · overseas_travel
   - 5순위 (마케팅·납품): sns · content_plan · deliverable · approval
   - 6순위 (기타): experience · recruitment · community_participation · field_management
