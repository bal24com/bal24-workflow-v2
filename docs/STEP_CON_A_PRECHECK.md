# STEP-CON-A 사전 확인 — 컨소시엄 연결 완성

> 작성일: 2026-05-08
> 박경수님 명세: STEP-CON-A — 6 파일 수정 (3 Modal + 2 Page + 1 Detail) + 3개 SQL
> 결정 필요: Q1~Q6 (이번엔 6 항목 — ConsortiumFormModal 수정모드 지원이 추가 변수)

---

## 1단계 · 현황 파악

### 1-1. V2 기존 파일 상태 (6 대상)

| 파일 | 줄 수 | 현재 상태 |
|---|---|---|
| `ProgramFormModal.tsx` | 263 | Modal/Input/Button 공통 UI · 9 필드 (이름·유형·상태·프로젝트·일정·장소·정원·설명) |
| `ProgramsPage.tsx` | 358 | StatusFilter + TypeFilter (FilterTabs 재사용) + list/card 토글 |
| `ProjectFormModal.tsx` | 287 | Modal/Input/Button 공통 UI · clients/profiles fetch · 8 필드 |
| `ProjectsPage.tsx` | 292 | StatusFilterTabs + list/card 토글 |
| `TaskFormModal.tsx` (`detail/`) | 220 | profiles fetch · 6 필드 (제목·상태·담당자·시작·마감·설명) |
| `ConsortiumDetailPage.tsx` | 305 | 7 탭 허브 · 수정 버튼 `onClick={() => toast.info('추후 STEP-CON 후속')}` placeholder |
| `ConsortiumFormModal.tsx` | 372 | **INSERT 전용** — 수정 모드 미지원 ⚠️ |

**합계**: 1,877줄 — 모두 < 400줄 (최대 372)

### 1-2. DB 스키마 (실제 vs 명세 비교)

| 컬럼 | 명세 SQL | 실제 (마이그레이션 확인) |
|---|---|---|
| `projects.consortium_id` | `add column if not exists ...` | ❌ **컬럼 없음** — Project TS 인터페이스만 있음 → SQL 필요 |
| `programs.consortium_id` | `add column if not exists ...` | ✅ 0515에 이미 있음 (`SET NULL`) — SQL 사실상 no-op |
| `tasks.consortium_id` | `add column if not exists ...` | ✅ 0515에 이미 있음 (단, **`ON DELETE CASCADE`** — 명세는 `SET NULL` 차이) |
| `tasks.consortium_member_id` | `add column if not exists ...` | ❌ **컬럼 없음** → SQL 필요 |

**짚어둘 점**:
- `tasks.consortium_id` 의 `ON DELETE` 동작이 다름. **현재 CASCADE → 명세 SET NULL 로 바꿀지** 박경수님 결정 (Q1)
- `add column if not exists` 는 멱등이지만 `ON DELETE` 변경은 별도 `ALTER TABLE ... ALTER CONSTRAINT` 필요

### 1-3. TypeScript 인터페이스

| 인터페이스 | `consortium_id` 필드 |
|---|---|
| `Project` | ✅ 이미 있음 |
| `Program` | ❌ **누락** → 추가 필요 |
| `Task` | ❌ **누락** → 추가 필요 (+`consortium_member_id`) |

→ `src/types/database.ts` 도 같이 수정 필요 (명세 미언급)

### 1-4. ConsortiumFormModal 수정 모드 지원 확인

```ts
// 현재 props
type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;       // ← 등록 콜백만, 수정 콜백 없음
};

// 내부 로직
const { error: cErr } = await supabase.from('consortiums').insert({ ... });  // INSERT 전용
const memberRows = [...];
await supabase.from('consortium_members').insert(memberRows);  // 참여사도 INSERT 전용
```

**수정 모드 미지원** — 명세가 요구하는 "consortium prop 받아 초기값 세팅 + UPDATE" 로직 신규 작성 필요. 수정 시 참여사 변경 처리 (기존 행 DELETE + 새 INSERT vs 부분 UPDATE) 가 추가 의사결정 (Q4).

---

## 2단계 · V7 UI/디자인 참조

### V7 의 컨소시엄 패턴
V7 (`src/pages/v9/NewProjectV9.tsx` 라인 159~206):
- **별도 Consortium 엔티티 없음** — 프로젝트 폼 안의 "consortiumMode" 토글
- 토글 ON 시 `consortiumPartners` 배열 (clients 중 type='컨소시엄파트너' 필터)
- 우리 회사 자동 첫 번째 행 + sharePercent 분배율 합 100% 보장
- 협업 표준 35개 vs 단일 표준 12개 task template 분기

### V2 와의 차이 (이미 결정된 사항)
- V2: consortiums 별도 엔티티 (consortium_id FK + ConsortiumPage + 7 탭 detail)
- V7 직접 UI 참조 불가 — **V2 의 기존 ConsortiumPage·ConsortiumFormModal 디자인 토큰만 차용**

### 차용 가능한 디자인 토큰 (V2 기존 파일에서)
- `Modal` 공통 컴포넌트 (`size="lg"`, `closeOnBackdrop`, `footer` slot)
- `Input` 공통 컴포넌트 (label + helperText + error props)
- `select` 인라인 스타일: `w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60`
- 필터 탭: `FilterTabs` 재사용 컴포넌트 (ProgramsPage 가 이미 사용 중)
- 컨소시엄 배지: `MEMBER_TYPE_STYLE` (참여사 라벨 색상)
- 상태 배지: `getStatusBadgeClass` (consortiumUtils)

### 명세 vs V2 디자인 일관성 갭
명세는 inline raw 스타일 `rounded-lg text-xs font-semibold` 등 사용 — V2 의 `Input/Modal/FilterTabs` 패턴과 충돌. **일관성을 위해 V2 패턴 우선 적용 권장** (Q5).

---

## 3단계 · Q1 ~ Q6 의사결정 옵션

### Q1. `tasks.consortium_id` ON DELETE 동작

| 옵션 | 동작 | 의미 |
|---|---|---|
| **A (추천)** | 현재 `CASCADE` 유지 | 컨소시엄 삭제 시 관련 태스크도 삭제 (기존 0515 그대로) |
| B | `SET NULL` 로 변경 (명세대로) | 컨소시엄 삭제 시 태스크는 남고 link만 끊김 (`ALTER TABLE ALTER CONSTRAINT`) |

→ **추천 A**: 컨소시엄은 보통 영구 삭제 안 하고 status='해산' 처리. CASCADE 가 기존 정책. 변경 시 데이터 정합성 영향 미미하지만 굳이 변경 불필요.

### Q2. `tasks.consortium_member_id` ON DELETE 동작

| 옵션 | 동작 |
|---|---|
| **A (추천)** | `SET NULL` (명세대로) — 참여사 삭제 시 link만 끊고 태스크는 보존 |
| B | `CASCADE` — 참여사 삭제 시 태스크도 삭제 |

→ **추천 A**: 참여사가 빠지더라도 작업은 다른 참여사가 인계받을 수 있음.

### Q3. ConsortiumFormModal 수정 모드 지원 방식

| 옵션 | 방식 | 라인 영향 |
|---|---|---|
| **A (추천)** | 기존 모달 확장 — `consortium?: ConsortiumDetail` prop 추가, props 가 있으면 UPDATE 모드 | 372 → ~430줄 (V-1 위반 위험 0) |
| B | 별도 `ConsortiumEditModal.tsx` 신규 분리 | +200줄 신규 파일, 중복 코드 발생 |
| C | 수정은 **이번 STEP 보류**, 박경수님 명세 6번째 항목만 toast 유지 | 변경 없음 |

→ **추천 A**: V-1 (400줄) 충돌 가능성 있지만 372 + 60 ≈ 432 로 살짝 초과. 모달 안의 참여사 부분을 별도 컴포넌트로 분리하면 OK. 또는 옵션 C (보류) 도 합리적.

### Q4. 수정 모드 시 참여사 변경 처리

(Q3 = A 또는 B 인 경우만 해당)

| 옵션 | 처리 |
|---|---|
| **A (추천)** | "기존 행 일괄 DELETE + 폼 입력값 일괄 INSERT" — 단순 |
| B | 변경 사항 diff 후 부분 UPDATE/INSERT/DELETE | 복잡, 트랜잭션 필요 |

→ **추천 A**: 컨소시엄 참여사 5~10곳 수준이라 일괄 재생성이 빠르고 명확. RLS 충돌 없음.

### Q5. 명세 inline 스타일 vs V2 공통 컴포넌트

| 옵션 | 적용 |
|---|---|
| **A (추천)** | V2 공통 컴포넌트 (`Input/Modal/FilterTabs`) 우선, 명세 인라인 스타일은 디자인 토큰만 참고 |
| B | 명세 그대로 (inline raw select 등) | 디자인 일관성 깨짐 |

→ **추천 A**: 박경수님 메모리 `feedback_ui_pattern` 에 디자인 일관성 강조 — V2 패턴 유지.

### Q6. 컨소시엄 필터 탭 위치

| 옵션 | 위치 |
|---|---|
| **A (추천)** | 기존 StatusFilter 우측 (같은 행) — 가로 길어지지만 한 번에 조망 |
| B | 기존 StatusFilter 아래 (별도 행) — 명세 권장 |

→ **추천 B (명세대로)**: 컨소시엄 N개 늘어나면 가로 한 행이 부족. 별도 행이 안전. 단, `consortiums.length === 0` 이면 행 자체 숨김 (명세에 이미 가드 있음).

---

## 4단계 · 작업 순서 제안 (의사결정 후 진입)

| 단계 | 내용 | 예상 시간 |
|---|---|---|
| ① | SQL 실행 (박경수님 직접 Supabase Dashboard) — 3 → 사실상 2 ALTER + 인덱스 | 5분 |
| ② | TypeScript 타입 보강 — `Program.consortium_id` + `Task.consortium_id`/`consortium_member_id` | 5분 |
| ③ | ProgramFormModal · ProjectFormModal — consortium select 필드 추가 (대칭 패턴) | 20분 |
| ④ | ProgramsPage · ProjectsPage — consortium 필터 탭 + select 에 join 추가 | 25분 |
| ⑤ | TaskFormModal — cascade 드롭다운 (consortium → member) | 20분 |
| ⑥ | ConsortiumDetailPage — 수정 버튼 onClick 연결 | 5분 |
| ⑦ | ConsortiumFormModal — 수정 모드 지원 (Q3=A 또는 B 시) | 40~60분 |
| ⑧ | typecheck + vite build + preview 검증 | 10분 |
| ⑨ | 보고서 + commit + push | 10분 |

**총 예상 시간**: 약 2~3 시간 (Q3=C 면 1.5 시간)

---

## 5단계 · 결정 필요 박경수님 답변 양식

```
Q1 (tasks ON DELETE):       A 추천대로 (CASCADE 유지) / B (SET NULL 변경)
Q2 (member_id ON DELETE):   A 추천대로 (SET NULL) / B (CASCADE)
Q3 (수정 모드):             A 같은 모달 확장 추천 / B 별도 EditModal / C 이번엔 보류
Q4 (참여사 변경 처리):      A 추천대로 (DELETE+INSERT) / B diff 처리  → Q3=C 면 무시
Q5 (명세 vs V2 스타일):     A 추천대로 (V2 공통 컴포넌트 우선) / B 명세 인라인 그대로
Q6 (필터 탭 위치):          A 같은 행 / B 별도 행 추천대로 (명세)

ANTHROPIC_API_KEY 등록·Supabase 링크 모두 OK.
SQL 실행: ☐ 예 (Stage 코드 진입 가능) / ☐ 아니오 (대기)
```

→ 박경수님 답변 받으면 바로 Stage 코드 진입 (옵션 A 표준 5종 + Q3 결정에 따라 Stage 분기).

---

## 6단계 · 짚어둘 점 (코드 진입 전 사전 공유)

1. **명세 SQL 의 1·2·3 항목 중 일부는 no-op**: `programs.consortium_id` 와 `tasks.consortium_id` 는 0515 마이그레이션에 이미 있어서 `if not exists` 가드 덕에 안전하게 멱등. 하지만 인덱스 이름이 같으면 충돌 → 같은 이름이라 OK.

2. **명세에서 ConsortiumFormModal 수정 모드 자동 감지 가정**: 실제로는 미지원이라 새로 작성해야 함. Q3 답에 따라 작업 범위가 크게 바뀜.

3. **명세의 raw select inline 스타일**: V2 의 `Input/Modal` 공통 컴포넌트 와 일관성 충돌. Q5 = A 면 V2 표준대로 작성 (명세보다 코드는 깔끔).

4. **TypeScript 타입 보강 빠짐**: 명세는 `Program/Task` 인터페이스 보강을 언급 안 함. 추가하지 않으면 `(program as Program).consortium_id` 처럼 캐스팅 지옥. 자동 추가 권장.

5. **ProgramsPage 의 FilterTabs 컴포넌트 재사용**: 명세는 inline button 그룹 — V2 의 `FilterTabs<T>` generic 컴포넌트로 컨소시엄 필터를 추가하면 디자인 일관성 유지 가능.

6. **`status in ('구성중', '진행')` 필터링**: 컨소시엄 select 옵션은 활성 컨소시엄만 — 명세대로 OK. 단, 이미 연결된 항목이 '완료/해산' 상태면 select 에 안 보여 사용자가 헷갈릴 수 있음 → 현재 연결된 ID 는 강제 포함하는 fallback 필요.

7. **롤백**: SQL 은 `add column if not exists` 라 사실상 비파괴. 코드는 단일 commit `git revert` 가능.
