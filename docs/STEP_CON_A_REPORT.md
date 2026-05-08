# STEP-CON-A 이식 결과 보고 — 컨소시엄 연결 완성

> 작업일: 2026-05-08
> 박경수님 결정: Q1 SET NULL · Q2 SET NULL · Q3 보류 · Q5 V2 스타일 · Q6 별도 행 · SQL 3개 실행 완료
> 범위: 프로젝트·프로그램·태스크 모두 컨소시엄으로 묶을 수 있도록 폼·필터·cascade 연결

---

## 변경 내용

### 새 파일 (1)

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `src/components/ConsortiumFilterTabs.tsx` | 62 | 컨소시엄 필터 탭 공통 컴포넌트 (Programs/Projects 양쪽 재사용) |

### 수정 파일 (6)

| 파일 | 줄 수 | 변경 내용 |
|---|---|---|
| `src/types/database.ts` | 942 | `Program.consortium_id` 추가 + `Task.consortium_id`/`consortium_member_id` 추가 |
| `src/pages/programs/ProgramFormModal.tsx` | 294 | 컨소시엄 select 필드 (연결 프로젝트 옆 grid 2열 배치) |
| `src/pages/programs/ProgramsPage.tsx` | **393** | consortiums fetch + filter state + ConsortiumFilterTabs 렌더 + filtering 로직 |
| `src/pages/projects/ProjectFormModal.tsx` | 315 | 컨소시엄 select 필드 (담당자/고객사 grid 아래 단독 행) |
| `src/pages/projects/ProjectsPage.tsx` | 334 | consortiums fetch + filter state + ConsortiumFilterTabs 렌더 + filtering 로직 |
| `src/pages/projects/detail/TaskFormModal.tsx` | 320 | 컨소시엄 + 참여사 cascade 드롭다운 (consortium 변경 시 members 재조회) |

**합계**: 7 파일 / 모두 < 400줄 (최대 **393줄** = `ProgramsPage.tsx`)

---

## CLAUDE.md 규칙 준수 체크리스트

- [x] ❌ localStorage 미사용
- [x] ❌ catch 빈 블록 없음 (모두 `console.error('[programs]/[projects]/[tasks] ...')` + 한글 toast)
- [x] ❌ 400줄 이내 (최대 **393줄** = ProgramsPage.tsx) → 공통 컴포넌트 분리로 440줄 → 393줄 감축
- [x] ❌ any 무분별 사용 없음 — `as ConsortiumOption[] | null` / `as unknown as Array<...>` 명시 단언만
- [x] ❌ 영문 에러 노출 없음
- [x] ✅ useEffect cleanup `cancelled` 패턴 (5 곳 모두)
- [x] ✅ `consortium_id` undefined → null 변환 (모든 INSERT payload `consortiumId || null`)
- [x] ✅ `maybeSingle()` 사용 안 함 (이번 STEP은 list fetch만), 하지만 cascade members fetch에서 빈 배열 케이스 처리

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 2.70s**
- `preview` /login 정상 렌더, 콘솔 에러 0건
- 인증된 화면 (`/projects`, `/programs`, 태스크 생성) 동작 검증은 박경수님 화면 확인 위임

---

## 짚어둘 점

### 1. ConsortiumDetailPage 수정 버튼은 Q3=보류
- 기존 `toast.info('수정 모달 — 추후 STEP-CON 후속 작업')` 그대로 유지
- 별도 STEP-CON-B 에서 ConsortiumFormModal 수정 모드 + 참여사 변경 처리 구현 예정

### 2. 명세 inline 스타일 → V2 표준으로 보정 (Q5=A)
- 명세의 `rounded-xl border border-slate-200 px-3 py-2 text-sm` (간이 스타일)
- → V2 표준 `rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60`
- 기존 ProgramFormModal·ProjectFormModal·TaskFormModal 의 select 들과 디자인 일관성 유지

### 3. 컨소시엄 필터 탭은 공통 컴포넌트로 분리
- 명세 그대로 inline 으로 작성 시 ProgramsPage 440줄 (V-1 위반)
- `src/components/ConsortiumFilterTabs.tsx` (62줄) 분리 → ProgramsPage 393줄, ProjectsPage 334줄
- 양쪽 page 디자인 자동 일관성 + 향후 변경 시 한 곳만 수정

### 4. TaskFormModal cascade 동작
- `consortiumId` 변경 시 별도 useEffect 가 `consortium_members` 자동 재조회 (cancelled 가드)
- 컨소시엄 해제 시 `memberId` 도 자동 초기화
- Supabase 의 join 결과가 array 또는 single 형태 모두 안전 처리 (`Array.isArray(m.clients) ? m.clients[0] : m.clients`)

### 5. SELECT_COLUMNS 에 consortium join 추가
- ProgramsPage: `*, project:projects(id,name), consortium:consortiums(id,name)`
- ProjectsPage: `*, client:clients(id,name), pm:profiles!projects_pm_id_fkey(id,name), consortium:consortiums(id,name)`
- 향후 row 카드/리스트에 컨소시엄 라벨 표시 필요 시 즉시 사용 가능 (이번엔 표시 추가 안 함 — 명세 외)

### 6. 활성 컨소시엄만 select 옵션
- 명세대로 `.in('status', ['구성중', '진행'])` 만 fetch
- 단점: 이미 '완료/해산' 컨소시엄에 연결된 프로젝트가 있으면 select 에 안 보여 헷갈릴 수 있음 → STEP-CON-B 수정 모드 추가 시 "현재 연결된 ID 강제 포함" 로직 같이 들어가야 함

### 7. 라우트·App.tsx 영향
- 변경 없음

### 8. 롤백
- 단일 commit 이라 `git revert <hash>` 한 줄
- DB ALTER 는 `add column if not exists` 라 사실상 비파괴, 롤백은 컬럼 그대로 두면 OK

---

## 박경수님 다음 액션

### 화면 검증 (3 곳)

1. **`/projects`** — 컨소시엄 필터 탭 (전체 / 자체 사업 / 컨소시엄N) 동작 확인
2. **`/programs`** — 동일
3. **신규 등록 모달**: 프로젝트·프로그램 생성 시 "컨소시엄 (선택)" select 동작 + 자체 사업 / 컨소시엄 연결 분기
4. **태스크 생성**: 컨소시엄 선택 → 참여사 cascade 드롭다운 활성화 → 참여사 선택 후 저장

### 후속 STEP

- **STEP-CON-B** — ConsortiumFormModal 수정 모드 (Q3 옵션 A 또는 B) + 참여사 일괄 DELETE/INSERT (Q4=A)
