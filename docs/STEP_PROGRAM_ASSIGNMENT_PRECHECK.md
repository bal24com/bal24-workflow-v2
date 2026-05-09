# STEP-PROGRAM-ASSIGNMENT 사전 확인 — 프로그램별 담당사 배정

> 작성일: 2026-05-09
> 목적: PM 이 프로그램별로 컨소시엄 참여사(consortium_members) 를 담당으로 배정 + 참여사(MEMBER) 본인이 배정된 프로그램만 보기
> 전제: STEP-CON 컨소시엄 7탭 + STEP-CON-A 컨소시엄 필터 적용 완료

---

## 섹션 1 — 핵심 결론 요약

1. **`program_assignments` 테이블 — V2 에 없음** ❌. SQL 신규 생성 필요 (Q1).
2. **`consortium_members` 테이블 — 있음** ✅. 단 인터페이스 2 종 혼재 (구버전 `client_id+role(주관/공동/위탁)` + STEP-CON 신버전 `member_type(lead/co/sub/observer)+task_share_pct`). 둘 다 DB 컬럼 동시 존재 — 활용 시 신버전 (`member_type`) 권장.
3. **AuthContext 의 role 판별 — 미구현** ❌. `useAuth()` 가 `session.user` 만 반환 — role 자동 추출 X. 코드베이스에 role 기반 UI 분기 거의 없음 (`MembersTab.tsx:106` 에서 단순 표시만). 이번 STEP 에서 `useUserRole` 또는 `useUserProfile` 헬퍼 신규 필요.
4. **V7 패턴**: 정규화된 `program_assignments` 테이블 없음. `ProjectTasksV9.tsx` 의 **태스크에 partnerLabel 드롭다운** (자유 텍스트) 가 가장 가까운 패턴 — 정규화 X.
5. **V2 기존 `consortium_member_id`**: tasks 테이블에 이미 추가됨 (STEP-CON-A) — 태스크 단위 매핑 가능. **프로그램 단위 매핑은 없음** — 이번 STEP 의 핵심 작업.

**구현 범위 요약**:
- DB 신규 1: `program_assignments (id, program_id, member_id, role, created_at)`
- 신규 컴포넌트 2~3: ProgramAssignmentTab (PM용 배정 UI) + AssignmentBadge (배지) + 권한 훅
- 기존 수정 2: ProgramsPage (MEMBER 필터) + ProgramDetailPage (배정 탭 추가)

---

## 섹션 2 — 가져올 것 / 버릴 것

### V7 차용 (참고만)
- **`ProjectTasksV9.tsx:497-758` 의 partnerLabel 드롭다운**: 컨소시엄 파트너 목록 로드 → 드롭다운 → 텍스트 입력. UI 패턴은 차용 가능하지만 V2 는 **정규화 테이블** 사용 권장 (검색·통계 가능)
- **`partnerLabel?: string` 자유 텍스트**: V7 패턴 (텍스트 묻혀 저장). V2 는 ❌ 차용 X — `member_id` FK 사용

### V2 신규 (V7 에 없는 것)
- **`program_assignments` 정규화 테이블**: program ↔ member 다대다 매핑 + role(lead/support)
- **MEMBER role 필터링**: ProgramsPage 에서 본인 배정만 표시
- **`useUserProfile` 또는 `useUserRole` 훅**: AuthContext 에 role/profile 자동 fetch 추가
- **AssignmentBadge 컴포넌트**: 프로그램 카드/리스트에 담당사 표시

### 버릴 것
- 기존 `consortium_members.role` 컬럼 (구버전 '주관/공동/위탁') 활용 ❌ — STEP-CON 신버전 `member_type` 만 사용
- `partnerLabel` 자유 텍스트 패턴 ❌ — `member_id` FK 정규화

---

## 섹션 3 — 파일 분할 계획

### A. SQL 마이그레이션 (1개)

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/migrations/20260510_program_assignments.sql` | ~50 | program_assignments CREATE + 인덱스 + RLS 4 정책 |

### B. 신규 파일 (3~4개)

| 파일 | 줄 수 (예상) | 역할 |
|---|---|---|
| `src/pages/programs/detail/ProgramAssignmentTab.tsx` | ~250 | PM용 배정 UI (참여사 목록 + lead/support 라디오 + 추가/삭제) |
| `src/pages/programs/detail/AssignmentBadge.tsx` | ~40 | 배정 배지 (참여사명 + lead/support 라벨) |
| `src/lib/programAssignmentUtils.ts` | ~70 | fetchAssignments / addAssignment / removeAssignment / pickOne |
| `src/hooks/useUserProfile.ts` | ~50 | useAuth 확장 — profiles 테이블에서 role/consortium_member_id 자동 fetch |

### C. 수정 파일 (3개)

| 파일 | 현재 줄 수 | 수정 내용 | 예상 후 |
|---|---|---|---|
| `src/types/database.ts` | — | `ProgramAssignment` 인터페이스 신규 + Profile 에 `consortium_member_id` 옵션 추가 | +20 |
| `src/pages/programs/ProgramsPage.tsx` | 393 | useUserProfile 사용 + MEMBER role 시 `.in('id', myAssignments)` 필터 | ~410 (V-1 위반 risk → 추가 분리 필요) |
| `src/pages/programs/ProgramDetailPage.tsx` | 285 | MODULE_TO_TAB 에 'assignment' 추가 + 탭 분기 + ProgramAssignmentTab 렌더 | ~300 |
| `src/pages/programs/programModuleConfig.ts` | 146 | TabKey 에 'assignment' 추가 + ALWAYS_VISIBLE_TABS 에 추가 (PM 만 보이도록 ProgramDetailPage 에서 분기) | +5 |

### D. V-1 (400줄) 위반 risk 회피
- ProgramsPage 393 → 410 위험. 다음 분리 검토:
  - `src/pages/programs/programsPageUtils.ts` 신규 — fetch · 필터링 로직 분리 (~50줄 절약)
  - 또는 MEMBER 필터 `useMemberProgramIds` 훅으로 분리

---

## 섹션 4 — 의사결정 사항 Q1~Q7 (2개 추가)

### Q1. `program_assignments` 테이블 DB 존재 여부

**확인 결과**: ❌ **없음**. SQL 신규 생성 필요.

```sql
CREATE TABLE program_assignments (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  program_id UUID NOT NULL REFERENCES programs(id) ON DELETE CASCADE,
  member_id  UUID NOT NULL REFERENCES consortium_members(id) ON DELETE CASCADE,
  role       TEXT NOT NULL DEFAULT 'support' CHECK (role IN ('lead', 'support')),
  created_by UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE (program_id, member_id)
);
```

### Q2. 배정 UI 위치

| 옵션 | 처리 | 장단점 |
|---|---|---|
| **A (추천)** | 프로그램 상세 탭 안에 **"배정"** 탭 신규 추가 (modules='assignment' 또는 항상 표시) | UI 일관성 ✓ + 프로그램 컨텍스트 안에서 작업 ✓ |
| B | 프로그램 목록 화면에서 배정 모달 | 빠른 접근 ✓, 단 컨텍스트 약함 |
| C | 프로젝트 상세 > 참여사 탭에서 프로그램별 배정 | 프로젝트 단위 일괄 배정 가능, 단 한 화면이 너무 무거워짐 |

**추천 A**: ProgramDetailPage 에 자연스럽게 통합. 박경수님 STEP-PROGRAM-MODULE-RENDER 의 modules 시스템과 잘 어울림.

### Q3. 참여사(MEMBER) 의 프로그램 목록 필터

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `/programs` 에서 MEMBER role 이면 본인이 배정된 프로그램만 표시 (PM/ADMIN 은 전체) |
| B | 별도 MEMBER 전용 대시보드 (`/my-programs`) |

**추천 A**: 박경수님 명세 그대로. 동일 페이지에서 role 별 분기 — UX 단순.

### Q4. 배정 역할 구분 (role)

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `role: 'lead' \| 'support'` 2종. 한 프로그램에 lead 1명 + support N명 가능. UNIQUE(program_id, member_id) 보장 |
| B | 단순 배정 (역할 구분 없음) — 그냥 program_id+member_id 쌍 |

**추천 A**: 박경수님 명세 기준. 단 lead 가 1명만 있어야 한다는 제약은 SQL 로 강제 안 하고 **UI 레이어에서 처리** (다중 lead 등록 시 toast 경고).

### Q5. PM 가시성(member_visibility) 설정 여부

| 옵션 | 처리 |
|---|---|
| A | 이번 STEP 에 포함 (own/read/full 3단계 + RLS 정책) |
| **B (추천)** | 별도 STEP-PROGRAM-VISIBILITY 로 분리 |

**추천 B**: 이번 STEP 은 배정 + MEMBER 필터까지만. 가시성 (read/write/manage 같은 권한) 은 RLS 정책 + UI 분기가 큰 작업이라 별도. **이번 STEP 의 MEMBER 필터는 단순 "본인 배정만 노출"** 만 (RLS 정책 없이 클라이언트 필터링).

### ⚠️ Q6 (보강) — MEMBER role 사용자의 `consortium_member_id` 식별 방법

**문제**: ProgramsPage 에서 MEMBER 가 본인 배정만 보려면 → 본인의 `consortium_member_id` 가 필요. 현재 `profiles` 테이블에는 이 컬럼 **없음**.

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `profiles.consortium_member_id` 컬럼 추가. 팀원 등록 시 ADMIN 이 매핑. SQL 1줄 |
| B | `profiles.email` ↔ `consortium_members.contact_email` 매칭 (자동) | email 변경 시 깨짐 |
| C | `profiles.id` ↔ `consortium_members.profile_id` (역방향 FK) | consortium_members 에 컬럼 추가 |

**추천 A**: 가장 명확. `MembersPage` 의 팀원 편집 모달에 "소속 참여사" select 추가하면 ADMIN 이 1회 설정 후 끝.

### ⚠️ Q7 (보강) — 'assignment' 탭 노출 정책 (PM 만 보이게?)

| 옵션 | 처리 |
|---|---|
| **A (추천)** | PM/ADMIN 만 'assignment' 탭 보임. MEMBER/STAFF 는 안 보임 (본인 배정 정보는 개요에 표시) |
| B | 모든 role 에서 보이되 MEMBER 는 readonly |
| C | 프로그램이 컨소시엄 연결된 경우 (consortium_id != null) 에만 표시 |

**추천 A** + 부분적 C: PM/ADMIN role 이면서 `program.consortium_id != null` 일 때만 'assignment' 탭 표시. 단독 사업 (consortium_id = null) 은 배정 의미 없음.

---

## 박경수님 답변 양식

```
Q1 SQL 실행:        ☐ 예 (program_assignments 생성 + profiles.consortium_member_id 추가) / ☐ 보류
Q2 (UI 위치):       A 추천대로 (배정 탭) / B 목록 모달 / C 프로젝트 상세
Q3 (MEMBER 필터):   A 추천대로 (/programs 에서 분기) / B 별도 대시보드
Q4 (역할 구분):     A 추천대로 (lead/support 2종) / B 단순 배정
Q5 (가시성):        A 이번 포함 / B 추천대로 (별도 STEP)
Q6 (MEMBER 식별):   A 추천대로 (profiles.consortium_member_id) / B email 매칭 / C profile_id FK
Q7 (탭 노출):       A 추천대로 (PM/ADMIN + 컨소시엄 연결 시) / B readonly / C 컨소시엄만
```

---

## 짚어둘 점 (코드 진입 전)

1. **`useUserProfile` 헬퍼 신규**: 현재 V2 는 role 기반 UI 분기 코드가 거의 없어서 첫 도입. AuthContext 또는 별도 hook 으로 작성. `profiles.role`·`profiles.consortium_member_id` 자동 fetch 후 캐싱 권장.

2. **MEMBER 필터링 위치**: 클라이언트 필터 (`programs.filter(p => myProgramIds.includes(p.id))`) vs `.in('id', myProgramIds)` Supabase 필터. **추천: Supabase 필터** (성능 + 페이지네이션 친화).

3. **MemberType 충돌**: V2 `consortiumTypes.ts` 의 `MemberType = 'lead'|'co'|'sub'|'observer'` 와 박경수님 명세의 `role = 'lead'|'support'` 가 **둘 다 'lead'** 사용. 다른 의미 (consortium_members 의 member_type vs program_assignments 의 role) 라 혼동 risk. 명세 그대로 가되 코드 주석으로 명확히.

4. **"lead 1명만" 제약**: SQL CHECK 로는 어려움 (트리거 필요). UI 에서 lead 추가 시 기존 lead 가 있으면 자동 demote (support 로 변경) 또는 confirm 모달.

5. **프로그램 종료 후 배정 변경**: 종료된 프로그램(status='완료')도 배정 변경 가능? 기록만 하고 readonly? Q8 후보 — 이번엔 변경 가능 + 토스트 안내로 진행.

6. **컨소시엄 연결 안 된 프로그램**: `program.consortium_id = null` 이면 참여사 목록 자체가 없어서 배정 불가. UI 안내 문구 ("이 프로그램은 컨소시엄에 연결되지 않아 배정이 필요 없어요.").

7. **롤백**: SQL 은 `DROP TABLE program_assignments + ALTER TABLE profiles DROP COLUMN consortium_member_id`. 코드는 단일 commit `git revert`.

8. **modules 통합 (선택)**: 'assignment' 를 MODULE_OPTIONS 28종에 추가하면 program_templates 에서도 활용 가능. STEP-PROGRAM-MODULE-RENDER 의 placeholder 패턴 따름. 박경수님 결정 필요.

9. **후속 STEP-PROGRAM-VISIBILITY**: own/read/full 3단계 가시성 + RLS 정책 + 필드 단위 노출 (예: MEMBER 는 예산 안 보이게). 이번 STEP 범위 외.
