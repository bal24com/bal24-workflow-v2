# 사전 확인 문서 — 커리큘럼 템플릿 (재활용 모음, Stage 3-A 후속)

> 작성일: 2026-05-08
> 진행 합의: 박경수님 ① 차시별 [저장] 버튼 완료 후 ② 사전 점검
> 박경수님 메시지: **"커리큘럼 재활용을 위한 별도 저장 및 모음"**
> 다음 단계: **Q1~Q6 결정 + 승인 → 코드 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| V7 참고 | EducationTemplatesV9 (블록 노출 템플릿) — 의미 다름. taskTemplate (시드 데이터) 일부 패턴만 차용 |
| 신규 기능 여부 | **V7에 정확히 일치하는 게 없음** — 차시 묶음 재활용은 V2 신규 기능 |
| 핵심 동작 | 한 프로그램의 차시 묶음(N차시 + 매칭 역할 제외)을 **템플릿으로 저장** → 다른 프로그램에서 **불러와 차시 일괄 INSERT** |

---

## 1. 현황 파악

### V2 현재 (Stage 3-A 완료 시점)
- `program_curriculum` (id, program_id, session_no, title, content, session_date, duration, start_time, end_time, venue) — 프로그램 종속
- `curriculum_staff` — 차시당 인력 매칭 (token 발급)
- 차시 추가는 빈 행 INSERT, 인라인 편집 + [저장] 버튼

### 박경수님 요구 정리
- **저장**: "이 프로그램의 차시 묶음을 템플릿으로 저장" — 이름·설명 + 차시들 묶음
- **모음**: 저장된 템플릿 목록 (관리·재사용)
- **재활용**: 다른 프로그램에서 템플릿 선택 → 차시 일괄 추가

---

## 2. 데이터 모델 결정 (Q1)

### 옵션 A — 단일 테이블 + jsonb (단순)
```sql
create table curriculum_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  /** 차시 배열 — [{ session_no, title, content, duration, start_time, end_time, venue, session_date_offset_days }] */
  sessions jsonb not null default '[]',
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);
```
- ✅ 단순. 1 테이블만. 가져오기 시 트랜잭션 단순
- ❌ 차시 단위 검색·필터·정렬 어려움

### 옵션 B — 정규화 2 테이블
```sql
create table curriculum_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table curriculum_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references curriculum_templates(id) on delete cascade,
  session_no integer not null,
  title text not null,
  content text,
  duration integer,
  start_time time,
  end_time time,
  venue text,
  unique (template_id, session_no)
);
```
- ✅ 차시 단위 조회·검색 자유로움
- ✅ V2의 portal_templates + portal_template_items 패턴과 일관 (이미 V2에 있는 패턴)
- ❌ 가져오기 시 2단계 (template fetch → items fetch → INSERT)

**제 추천: 옵션 B** — V2 portal_templates 패턴과 일관성. 차시 1개씩 미리보기에서 활용 용이.

> **session_date / 인력 매칭은 템플릿에 포함 X**. session_date는 프로그램마다 다르고, 매칭은 token 발급이라 재사용 의미 없음.

---

## 3. UX 흐름

### 저장 흐름 (CurriculumTab → 템플릿)
```
[현재 커리큘럼: N차시]
    ↓ 헤더에 "💾 템플릿으로 저장" 버튼
[모달: 템플릿 이름·설명 입력 + 차시 미리보기 + [저장]]
    ↓
templates INSERT + items 일괄 INSERT
    ↓
toast.success
```

### 불러오기 흐름 (CurriculumTab → 템플릿 선택 → 차시 INSERT)
```
[현재 커리큘럼: 비어있음 또는 N차시]
    ↓ 헤더에 "📥 템플릿에서 가져오기" 버튼
[모달: 템플릿 목록 (검색 가능) + 각 카드에 차시 수·미리보기]
    ↓ 선택
[모달: 가져오기 옵션 — 덮어쓰기 / 뒤에 추가]
    ↓ 확인
대상 프로그램에 차시 일괄 INSERT (session_no 자동 조정)
    ↓
toast.success + 새로고침
```

### 모음 페이지 — Q2

| 옵션 | 처리 | 추천 |
|---|---|---|
| **X** | **CurriculumTab 안에서 모달로만** — 별도 메뉴 X | ✅ 가장 단순. 사이드바 슬림화 유지 |
| Y | **시스템 설정 안에 서브 페이지** — `/settings/curriculum-templates` | ⚠️ 현재 V2에 시스템 설정 메뉴 미구현 |
| Z | **사이드바 별도 메뉴** — `/curriculum-templates` | ❌ Q4 결정(사이드바 유지) 위반. 메뉴 22개 → 23개 |

**제 추천: 옵션 X** — 모달 안에 [+ 새 템플릿]·[수정]·[삭제] 모두 가능. 박경수님이 "모음"이라고 한 건 화면 별도 페이지가 아니라 **데이터 묶음**이라는 의미일 수 있음.

---

## 4. 이식 계획

### A. 가져올 것 (V7 부분 차용)
- 템플릿 카드 UI 패턴 — V7 EducationTemplatesV9 카드 형태 (이름·설명·차시 수·작성자·생성일)
- 미리보기 패턴 — V7 펼침형
- COLLAB_TEMPLATE_SEED 같은 시스템 기본 템플릿 시드 (선택)

### B. 버릴 것
- ❌ V7 BlockConfig·BlockId·BlockRole — 다른 시스템 (Stage 3-B 노출 항목과 매칭됨)
- ❌ AI 추출 — STEP-AI-PREP 후
- ❌ 자체 v9-card·다크모드

### C. V2 표준으로 새로 쓸 것

| 신규 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `supabase/migrations/20260519_curriculum_templates.sql` (신규) | ~50 | 옵션 B (2 테이블 + index + RLS) |
| `src/types/database.ts` (수정) | +25 | `CurriculumTemplate` + `CurriculumTemplateItem` 인터페이스 |
| `src/pages/programs/detail/curriculum/SaveTemplateModal.tsx` (신규) | ~180 | 이름·설명 입력 + 차시 미리보기 + [저장] |
| `src/pages/programs/detail/curriculum/LoadTemplateModal.tsx` (신규) | ~240 | 목록 + 검색 + 미리보기 + 가져오기 옵션 (덮어쓰기/뒤에 추가) |
| `src/pages/programs/detail/curriculum/curriculumTemplateUtils.ts` (신규) | ~150 | fetch / save / load / delete + 차시 INSERT 트랜잭션 |
| `src/pages/programs/detail/CurriculumTab.tsx` (수정) | +20 | 헤더에 [💾 템플릿으로 저장] [📥 가져오기] 버튼 추가 |

**모든 파일 < 400줄. V-1 통과.**

### D. DB 스키마 (Q1: 옵션 B 추천)

```sql
-- 옵션 B
create table public.curriculum_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_curriculum_templates_created_at on public.curriculum_templates(created_at desc);

alter table public.curriculum_templates enable row level security;
create policy "auth_all" on public.curriculum_templates
  for all to authenticated using (true) with check (true);

create table public.curriculum_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.curriculum_templates(id) on delete cascade,
  session_no integer not null,
  title text not null,
  content text,
  duration integer,
  start_time time,
  end_time time,
  venue text,
  created_at timestamptz not null default now(),
  unique (template_id, session_no)
);
create index idx_curriculum_template_items_template_id on public.curriculum_template_items(template_id);

alter table public.curriculum_template_items enable row level security;
create policy "auth_all" on public.curriculum_template_items
  for all to authenticated using (true) with check (true);
```

---

## 5. 가져오기 옵션 — Q3

| 옵션 | 동작 |
|---|---|
| **A. 덮어쓰기** | 기존 차시 모두 DELETE → 템플릿 차시 INSERT (session_no 1부터) |
| **B. 뒤에 추가** | 기존 차시 유지 → 템플릿 차시를 뒤에 INSERT (session_no = max + 1, 2, …) |
| **C. 둘 다 선택 가능** | 가져오기 모달에서 라디오로 선택 |

**제 추천: 옵션 C** — 사용자가 상황에 맞게 선택. 둘 다 흔한 use case.

---

## 6. 시스템 기본 템플릿 시드 — Q4

V7의 COLLAB_TEMPLATE_SEED처럼 자주 쓰는 형태(예: "1일 워크숍 4차시", "2박 3일 캠프 8차시", "주간 세미나 5주")를 시스템 기본으로 제공할지.

| 옵션 | 처리 | 추천 |
|---|---|---|
| A | **시드 X** — 사용자가 직접 만든 것만 | ✅ **추천** — 단순. V2엔 use case 데이터 부족 |
| B | **시드 3개 제공** (워크숍/캠프/세미나) | ⚠️ 박경수님이 시드 내용 정의 필요 |

**제 추천: 옵션 A** — 박경수님이 직접 사용하면서 첫 템플릿 저장. 시드는 추후 결정.

---

## 7. V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | 최대 ~240 (LoadTemplateModal) | ✅ |
| V-2 catch + 한글 | `console.error('[curriculum-templates] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown 미사용 | nested join 없음 (단순 fetch) | ✅ |
| V-4 한글 메시지 | 모두 한글 | ✅ |
| V-5 cancelled 가드 | 모달 진입 fetch 적용 | ✅ |
| V-6 직접 fetch | 모달이 자체 fetch | ✅ |
| V-7 디자인 토큰 | violet/orange 톤 | ✅ |

---

## 8. 박경수님 의사결정 6개 (Q1~Q6)

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| **Q1** | **데이터 모델** — A(단일+jsonb) / B(정규화 2테이블) | ✅ **옵션 B** — V2 portal_templates 패턴과 일관 |
| **Q2** | **모음 페이지 위치** — X(모달만) / Y(시스템 설정) / Z(사이드바 별도) | ✅ **옵션 X** — 모달 안에서 모두 관리. 사이드바 슬림화 유지 |
| **Q3** | **가져오기 옵션** — A(덮어쓰기) / B(뒤에 추가) / C(둘 다 선택) | ✅ **옵션 C** — 사용자가 상황에 맞게 선택 |
| **Q4** | **시스템 기본 템플릿 시드** | ✅ **시드 X** — 사용자가 직접 만든 것만 |
| **Q5** | **저장 시 인력 매칭 포함?** | ❌ **포함 X** — 매칭은 token 기반, 재사용 의미 없음. 차시 메타만 저장 |
| **Q6** | **session_date 처리** — 템플릿에 저장? | ❌ **저장 X** — 프로그램마다 다른 날짜. 가져올 때 session_date는 null로 |

---

## 9. 작업 순서 (승인 후)

1. **Q1 SQL 박경수님 직접 실행** (옵션 B — 2 테이블)
2. `supabase/migrations/20260519_curriculum_templates.sql` (보존본)
3. `types/database.ts` — CurriculumTemplate + CurriculumTemplateItem 인터페이스
4. `curriculum/curriculumTemplateUtils.ts` — fetch / save / load / delete + INSERT 트랜잭션
5. `curriculum/SaveTemplateModal.tsx` — 이름·설명 입력 + 차시 미리보기 + [저장]
6. `curriculum/LoadTemplateModal.tsx` — 목록 + 검색 + 미리보기 + 가져오기 옵션
7. `CurriculumTab.tsx` — 헤더에 [💾 템플릿으로 저장] [📥 가져오기] 버튼
8. tsc -b → V-1~V-7 검증 → 보고서 → commit/push

**예상 작업 시간**: 60~80분 / **commit 1건**: `feat: 커리큘럼 템플릿 — 재활용 저장·불러오기`

**롤백**: 단일 commit이라 `git revert <hash>` 한 줄. SQL ALTER (Q1) 만 별도 revert 필요.

---

## 10. 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q6 결정 → 그 후 코드 진입

**Q1 (옵션 B 정규화 2 테이블) 진행 시 SQL**:
```sql
create table public.curriculum_templates (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  created_by uuid references public.profiles(id),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index idx_curriculum_templates_created_at on public.curriculum_templates(created_at desc);
alter table public.curriculum_templates enable row level security;
create policy "auth_all" on public.curriculum_templates
  for all to authenticated using (true) with check (true);

create table public.curriculum_template_items (
  id uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.curriculum_templates(id) on delete cascade,
  session_no integer not null,
  title text not null,
  content text,
  duration integer,
  start_time time,
  end_time time,
  venue text,
  created_at timestamptz not null default now(),
  unique (template_id, session_no)
);
create index idx_curriculum_template_items_template_id on public.curriculum_template_items(template_id);
alter table public.curriculum_template_items enable row level security;
create policy "auth_all" on public.curriculum_template_items
  for all to authenticated using (true) with check (true);
```
박경수님이 Supabase Dashboard에서 직접 실행하시고 결과 알려주시면 코드 진입할게요.
