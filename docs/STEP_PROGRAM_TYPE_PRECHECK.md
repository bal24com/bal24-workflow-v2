# STEP-PROGRAM-TYPE 사전 확인 — 프로그램 유형 + 모듈 + 템플릿 시스템

> 작성일: 2026-05-09
> 목적: 프로그램 유형을 동적 시스템으로 확장 (V7 EducationType 차용 + V2 modules 신규)
> 범위 의도: `program_type` 컬럼 + `display_order` + `modules` + `program_templates` 신규 테이블 + 9 기본 템플릿

---

## 섹션 1 — 핵심 결론 요약

1. **`programs` 테이블 현황**: 기존 `type` 컬럼 (text, enum 4종 `'교육'|'캠프'|'행사'|'기타'`) **만** 존재. `program_type`·`display_order`·`modules` 컬럼 **모두 없음** (3개 신규 ALTER 필요).
2. **`program_templates` 테이블**: 존재 X — 신규 CREATE TABLE 필요. V7 은 동일 개념을 `localStorage` 키 `education_types_v9` + `lib/v9/educationType.ts` (97줄) 로 운영.
3. **`ProgramFormModal` 현재 구현**: 이미 type 드롭다운 있음 (`<select value={type}>`, 라인 176-185). PROGRAM_TYPE_VALUES 4종 하드코딩 → 신규 `program_templates.name` fetch 로 교체 필요.
4. **추가 작업 방향**: SQL 4종 (`programs` ALTER 3컬럼 + `CREATE TABLE program_templates` + 9 기본 INSERT) → types 보강 → ProgramFormModal 동적 드롭다운 + 모듈 자동 로드 → ProgramsPage 정렬·필터 갱신.
5. **⚠️ 핵심 결정**: 기존 `programs.type` 컬럼과 신규 `program_type` 의 관계 — 중복·전환 정책 결정 필요 (Q1 보강 항목).

---

## 섹션 2 — 가져올 것 / 버릴 것

### V7 에서 가져올 것
- **EducationType 데이터 모델 (`lib/v9/educationType.ts`)**:
  - 필드: `id, name, emoji, color, description, order, isBuiltIn, createdAt, updatedAt`
  - 8 기본 시드: 교육·이벤트·캠프·전시·워크숍·세미나·포럼·박람회 (4 builtIn + 4 추가)
  - `isBuiltIn=true` 행은 삭제 불가 (이름·색상만 수정)
  - `findTypeByName(name)` 매칭 헬퍼 (id 기반 X, name 기반)
- **EducationTypesV9.tsx UI 패턴 (200줄)** — 유형 관리 페이지 (이번 STEP 외 — 후속 STEP-PROGRAM-TYPE-MANAGE 후보)
- **emoji + color hex** 시각 구분

### V7 에서 버릴 것
- ❌ `localStorage` 의존 (V2 절대 규칙) → Supabase 테이블로
- ❌ name 기반 매칭 (`findTypeByName`) — V2 는 FK (`program_type_id`) 또는 name 직접 저장 중 선택 필요
- ❌ `_v9` LS 키 네이밍
- ❌ `syncUpsert/syncDelete` 헬퍼 (V2 는 supabase 직접)

### V2 신규 (V7 에 없는 것)
- **`modules` 시스템**: 유형별 활성화 모듈 배열 (예: 교육={curriculum, attendance, certificate}, 행사={booth, ...})
- **유형별 자동 모듈 세팅**: `program_templates.modules` (jsonb 배열) → 프로그램 생성 시 type 선택 → 자동 로드
- 신규 테이블: `program_templates` (DB 정규화)

### 상태 (V2 → V7 → V2 흐름)
- V2 현재: `ProgramType` 4종 한글 enum (CHECK 제약)
- V7 도입: 8종 + 동적 추가 (LS)
- V2 신규 (이번 STEP): **9 시스템 템플릿** (V7 8종 + "기타") + ADMIN 동적 추가 (후속 STEP)

---

## 섹션 3 — 파일 분할 계획 (V-1 400줄 이하)

### A. SQL 마이그레이션 (박경수님 직접 실행)

```sql
-- 파일명: supabase/migrations/20260509_program_type_modules.sql (보존본)

-- 1. programs 테이블 신규 컬럼 3종
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS program_type TEXT,
  ADD COLUMN IF NOT EXISTS display_order INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modules JSONB DEFAULT '[]'::jsonb;

-- 2. 기존 행 program_type 백필 (Q5 결정 — A 추천)
UPDATE programs SET program_type = type WHERE program_type IS NULL;
ALTER TABLE programs ALTER COLUMN program_type SET DEFAULT '기타';

-- 3. 인덱스
CREATE INDEX IF NOT EXISTS idx_programs_program_type ON programs(program_type);
CREATE INDEX IF NOT EXISTS idx_programs_display_order ON programs(display_order);

-- 4. program_templates 테이블 (Q3 = A)
CREATE TABLE IF NOT EXISTS program_templates (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name TEXT NOT NULL UNIQUE,
  emoji TEXT,
  color TEXT,
  description TEXT,
  modules JSONB NOT NULL DEFAULT '[]'::jsonb,
  display_order INTEGER NOT NULL DEFAULT 0,
  is_built_in BOOLEAN NOT NULL DEFAULT FALSE,
  created_by UUID REFERENCES profiles(id),
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  updated_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- 5. RLS — 모든 인증 사용자 read, 관리자만 write (후속 STEP에서 정책 강화)
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;
CREATE POLICY "program_templates_select" ON program_templates
  FOR SELECT TO authenticated USING (true);
CREATE POLICY "program_templates_write" ON program_templates
  FOR ALL TO authenticated USING (true) WITH CHECK (true);

-- 6. 9 기본 시스템 템플릿 INSERT (V7 8종 + "기타")
INSERT INTO program_templates (name, emoji, color, modules, display_order, is_built_in) VALUES
  ('교육',   '📚', '#10B981', '["curriculum","instructor","attendance","certificate"]'::jsonb, 10, TRUE),
  ('이벤트', '🎉', '#F59E0B', '["agenda","attendees","venue"]'::jsonb,                          20, TRUE),
  ('캠프',   '🏕️', '#8B5CF6', '["curriculum","instructor","attendance","accommodation","meals"]'::jsonb, 30, TRUE),
  ('전시',   '🖼️', '#EC4899', '["agenda","attendees","venue","booth"]'::jsonb,                  40, TRUE),
  ('워크숍', '🛠️', '#3B82F6', '["curriculum","instructor","attendance","supplies"]'::jsonb,    50, TRUE),
  ('세미나', '🎤', '#06B6D4', '["speaker","attendees","venue","slides"]'::jsonb,                60, TRUE),
  ('포럼',   '💬', '#6366F1', '["agenda","panel","attendees","venue"]'::jsonb,                  70, TRUE),
  ('박람회', '🎪', '#EF4444', '["agenda","booth","attendees","venue"]'::jsonb,                  80, TRUE),
  ('기타',   '📌', '#64748B', '[]'::jsonb,                                                       90, TRUE)
ON CONFLICT (name) DO NOTHING;
```

### B. 신규 파일 (1개)

| 파일 | 줄 수 (예상) | 역할 |
|---|---|---|
| `src/pages/programs/programTemplateUtils.ts` | ~80 | `fetchProgramTemplates()`·`getModulesForType(name, templates)` 헬퍼 (V7 의 educationType.ts 대체) |

### C. 수정 파일 (3개)

| 파일 | 현재 줄 수 | 수정 내용 | 예상 후 |
|---|---|---|---|
| `src/types/database.ts` | 942 | `Program` 인터페이스 보강 (`program_type, display_order, modules`) + `ProgramTemplate` 신규 인터페이스 | +20 |
| `src/pages/programs/ProgramFormModal.tsx` | 294 | 4종 하드코딩 select → `program_templates` fetch 로 교체 + emoji + color + modules 자동 로드 + display_order 입력 (Q2=A 숫자) | ~340 (V-1 안전) |
| `src/pages/programs/ProgramsPage.tsx` | 393 | 정렬에 `display_order` ASC 추가 + 유형 필터를 templates 동적 fetch | ~395 (V-1 안전) |

### D. 후속 STEP (이번 범위 외)
- **STEP-PROGRAM-TYPE-MANAGE**: ADMIN `/settings/program-types` 페이지 (V7 EducationTypesV9 패턴 차용)
- **STEP-PROGRAM-MODULE-RENDER**: `modules` 배열 기반 ProgramDetailPage 탭 동적 렌더 (현재 8 탭 고정)
- **STEP-PROGRAM-TYPE-DRAGDROP**: display_order 드래그앤드롭 (Q2=B 후속)

---

## 섹션 4 — 의사결정 사항 Q1~Q6 (1개 추가)

### Q1. `program_type` 컬럼이 이미 DB에 있는가?

**답: ❌ 없음** (V2 는 기존 `type` 컬럼만 사용 중)

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `ADD COLUMN IF NOT EXISTS program_type TEXT` 신규 추가. 백필 시 기존 `type` 값 복사 |
| B | `type` 컬럼 이름을 `program_type` 으로 RENAME (코드 호출처 ~10곳 변경 필요) |

**추천 A**: 멱등 + 호환성 유지. 기존 코드의 `program.type` 호출처 안전.

### ⚠️ Q1.5 (보강) — 기존 `type` 컬럼과 신규 `program_type` 관계

| 옵션 | 의미 | 영향 |
|---|---|---|
| **A (추천)** | `type` 유지 + `program_type` 신규 추가. 신규 행은 둘 다 같은 값 INSERT. 점진적 마이그레이션 | 호환성 ✓, 단기 중복 |
| B | `program_type` 만 사용. `type` 은 deprecated 마킹 후 후속 STEP 에서 제거 | 호출처 grep 후 일괄 변경 필요 |
| C | `type` 그대로 두고 `program_type` 미도입 (이름 차이만 → V2 컨벤션 그대로) | 박경수님 명세 의도와 다름 |

**추천 A**: 기존 4 종 enum (`type`) 은 코드 호환용으로 유지, `program_type` 은 동적 시스템용. 후속 STEP 에서 통합 결정 가능.

### Q2. `display_order` 입력 방식

| 옵션 | 처리 |
|---|---|
| **A (추천)** | 숫자 직접 입력 (`<Input type="number">`) — 이번 STEP 범위 최소화 |
| B | 드래그앤드롭 순서 변경 — 별도 STEP-PROGRAM-TYPE-DRAGDROP |

**추천 A** (박경수님 명세 추천 그대로).

### Q3. `program_templates` 테이블 신규 생성 여부

| 옵션 | 처리 |
|---|---|
| **A (추천)** | 이번 STEP 에 포함 — CREATE TABLE + 9 기본 INSERT |
| B | 별도 STEP-PROGRAM-TEMPLATE 로 분리 (이번엔 4 종 enum 그대로) |

**추천 A** (박경수님 명세 추천 그대로). 타입 선택 시 모듈 자동 세팅이 핵심 UX 라 분리하면 미완성 느낌.

### Q4. ProgramFormModal 에서 type 선택 시 modules 자동 세팅 여부

| 옵션 | 처리 |
|---|---|
| **A (추천)** | type 선택 → 시스템 템플릿 modules 자동 로드 (`useEffect([type], () => setModules(template.modules))`) |
| B | type 만 저장, modules 는 별도 UI 에서 수동 편집 |

**추천 A** (박경수님 명세 추천 그대로). 박경수님 운영 패턴 = "선택 한 번에 끝" 우선.

### Q5. 기존 `programs` 레코드 (`program_type=null`) 처리

| 옵션 | 처리 |
|---|---|
| **A (추천)** | migration 시 기존 `type` 값을 `program_type` 으로 복사 + `DEFAULT '기타'` 설정 |
| B | NULL 허용 유지 → UI 에서 "유형 미설정" 표시 + 사용자가 수동 보정 |

**추천 A** (박경수님 명세 추천 그대로). 일관성 우선. 모든 기존 행이 자동으로 적절한 program_type 부여됨.

### Q6 (보강) — modules 배열 정의 위치

| 옵션 | 처리 |
|---|---|
| **A (추천)** | `program_templates.modules` (jsonb) — 시스템 템플릿이 truth source. programs.modules 는 fallback (생성 시 복사) |
| B | `programs.modules` 만 — 템플릿은 초기값만 제공. 이후 프로그램별 독립 |
| C | 양쪽 모두 + 동기화 (복잡) |

**추천 A**: 시스템 템플릿 변경 시 신규 프로그램 자동 반영, 기존 프로그램은 자기 modules 보존. V7 의 `findTypeByName` 패턴과 호환.

---

## 박경수님 답변 양식

```
Q1   (program_type 컬럼):       A 추천대로 / B RENAME
Q1.5 (기존 type 관계):          A 추천대로 (둘 다 유지) / B program_type 통합 / C type 그대로
Q2   (display_order 입력):      A 추천대로 (숫자) / B 드래그앤드롭 후속
Q3   (program_templates):       A 추천대로 (이번 STEP) / B 분리
Q4   (modules 자동 세팅):       A 추천대로 (자동 로드) / B 수동
Q5   (기존 행 처리):            A 추천대로 (백필) / B NULL 허용
Q6   (modules 위치):            A 추천대로 (template + program 양쪽) / B program 만 / C 동기화

SQL 실행: ☐ 예 (Stage 코드 진입 가능) / ☐ 아니오 (대기)
```

---

## 짚어둘 점 (코드 진입 전)

1. **`program_type` 정확한 의미**: 박경수님 명세에는 "유형" 이지만 실제로 `program_templates.name` 의 외래키 또는 단순 텍스트 복사 둘 다 가능. 박경수님이 V7 의 `findTypeByName` 패턴을 의도하시면 후자 (텍스트 복사). FK 라면 `program_type_id` 명명이 더 정확.

2. **CHECK 제약 처리**: 현재 `programs.type` 의 `CHECK (type IN ('교육','캠프','행사','기타'))` 가 있을 가능성. 신규 9 종 도입 시 CHECK 제약을 삭제하거나 동적 검증으로 전환 필요.

3. **`ProgramType` enum 처리**: V2 코드의 `import type { ProgramType }` 사용처가 ~10곳. 신규 시스템에서는 `string` 으로 완화 + 런타임 검증. 또는 enum 그대로 두고 `program_type` 은 별도.

4. **modules 표준 키**: 9 기본 템플릿의 modules 배열 값 (`curriculum`, `instructor`, `attendance`, `certificate`, `agenda`, `attendees`, `venue`, `booth`, `accommodation`, `meals`, `supplies`, `speaker`, `slides`, `panel`) 은 ProgramDetailPage 의 8 탭 (overview/curriculum/staff/attendance/survey/share/report/files) 과 매핑 필요. 후속 STEP-PROGRAM-MODULE-RENDER 에서 처리.

5. **AI 의 modules 활용**: 향후 AI 가 운영안 PDF 분석 시 modules 배열로 어떤 정보 추출할지 결정 가능 (예: modules 에 'agenda' 있으면 발표 일정 추출, 'booth' 있으면 부스 정보 추출).

6. **롤백**: SQL 모두 `if not exists` 라 비파괴. 코드는 단일 commit `git revert`.
