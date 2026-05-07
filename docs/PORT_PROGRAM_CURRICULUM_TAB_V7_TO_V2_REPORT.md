# Stage 3-A 이식 결과 보고 — 커리큘럼 상세 탭 + DateTimePicker

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_PROGRAM_CURRICULUM_TAB_V7_TO_V2.md](./PORT_PROGRAM_CURRICULUM_TAB_V7_TO_V2.md)
> 박경수님 결정: Q3 SQL 실행 완료 / Q1~Q5 모두 추천대로
> 범위: 커리큘럼 상세 탭 신설 + DateTimePicker 신규 + 수정 페이지 ⑥ 카드 제거

---

## 매핑 요약

| 항목 | V7 (NewEducationV9 ⑥) | V2 (이식 결과) |
|---|---|---|
| 위치 | 수정 페이지 안 카드 | **상세 페이지 2번째 탭** (`CurriculumTab`) |
| 차시 형태 | 테이블 행 (일차·시작·종료·주제·강사·펼침) | ✅ V7 동일 — 8 컬럼 그리드 |
| 시간 입력 | 캘린더 + 시·분 grid picker | ✅ DateTimePicker 신규 (`mode="time"` 사용) |
| 매칭 | 강사 단일 텍스트 | curriculum_staff 테이블 + 외부/내부 탭 모달 + 토큰 발급 |
| 데이터 | LS Education.curriculum[] | `program_curriculum` + `curriculum_staff` (Stage 1 SQL) + `start_time`/`end_time` (이번 SQL) |
| 펼침 시 | 강사 추가·멘토 추가·설명·매칭 정보 | ✅ V7 동일 (강사·멘토 두 버튼 분리, role enum 활용) |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것 (V7 UX → V2)
- **테이블형 차시 행** (일차·시작·종료·주제·강사·펼침·삭제 8 컬럼)
- **DateTimePicker — 캘린더 + 시(06~23) + 분(00, 30) + [지금] [완료]**
- **차시 펼침 — 강사 추가·멘토 추가 두 버튼 분리** (V7 UX, V2 role enum 매핑)
- **매칭 정보 한 줄 표시 (이름·전화·이메일)** — staff_pool / profiles에서 join
- 헤더 [↑ 새 파일] [✦ AI 생성] 버튼 (placeholder)
- 안내 문구 "⋮⋮ 드래그로 순서 변경 · 차시 펼침으로…"

### 버린 것
- ❌ AI 추출·실제 호출 — STEP-AI-PREP 후 (Q1)
- ❌ 파일 Storage 업로드 — STEP-STORAGE 후 (Q1)
- ❌ 하단 [저장 (계속 편집)] / [저장 후 상세] 두 버튼 — Q4: 단일 즉시 저장 (Stage 1 패턴 유지)
- ❌ 수정 페이지 ⑥ CurriculumCard — Q5: 제거 (8 카드 → 7 카드)
- ❌ 자체 v9-card·다크모드·강한 그라데이션 — V2 표준 토큰

### 새로 작성한 것 (V2 표준)
- `DateTimePicker.tsx` 공용 컴포넌트 — `mode='time' | 'datetime'` 두 모드 지원, 다른 페이지 재사용 가능
- `CurriculumTab.tsx` 메인 — 자체 fetch + DnD + 매칭 모달 + 단일 책임
- `CurriculumRow.tsx` — V7 테이블 행 + 펼침 + 강사/멘토 분리 액션
- `curriculumTabUtils.ts` — fetch + staff join + duration 자동 계산 + 'HH:MM' / 'HH:MM:SS' 변환
- `StaffMatchModal.tsx` 이전 — `edit/curriculum/` → `detail/curriculum/` (의미적 정리)
- `StaffMatchRow.tsx` 이전 + 전화·이메일 표시 추가
- `defaultRole` prop — 매칭 모달이 [강사 추가] / [멘토 추가] 어떤 버튼에서 열렸는지 인식
- 7탭 재구성 — 개요 / **커리큘럼** / 강사·교육생 / 출석·일지 / 결과·만족도 / 외부 공유 / 결과보고서

---

## 신규/수정/삭제 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/migrations/20260518_program_curriculum_time.sql` (신규) | 9 | start_time / end_time 컬럼 추가 보존본 |
| `src/types/database.ts` (수정) | +5 | ProgramCurriculum.start_time / end_time |
| `src/components/ui/DateTimePicker.tsx` (신규) | 293 | 캘린더 + 시·분 그리드 + [지금] [완료] |
| `src/pages/programs/detail/CurriculumTab.tsx` (신규) | 226 | 메인 + DnD + CRUD + 매칭 모달 호출 |
| `src/pages/programs/detail/curriculum/CurriculumRow.tsx` (신규) | 199 | 테이블 행 + 펼침 |
| `src/pages/programs/detail/curriculum/curriculumTabUtils.ts` (신규) | 108 | fetch + staff join + 시간 변환 |
| `src/pages/programs/detail/curriculum/StaffMatchModal.tsx` (신규 — 이전) | 286 | 외부/내부 탭 + defaultRole prop |
| `src/pages/programs/detail/curriculum/StaffMatchRow.tsx` (신규 — 이전) | 93 | 매칭 인력 한 줄 + 전화·이메일 표시 |
| `src/pages/programs/ProgramDetailPage.tsx` (수정) | 218 | 6탭 → **7탭** + 커리큘럼 2번째 |
| `src/pages/programs/edit/ProgramEditPage.tsx` (수정) | 160 | CurriculumCard import·렌더 제거, 안내 문구 7카드로 |
| `src/pages/programs/edit/cards/CurriculumCard.tsx` (**삭제**) | — | 상세 탭으로 일원화 |
| `src/pages/programs/edit/curriculum/StaffMatchModal.tsx` (**삭제** — 이전) | — | detail 폴더로 이동 |
| `src/pages/programs/edit/curriculum/StaffMatchRow.tsx` (**삭제** — 이전) | — | detail 폴더로 이동 |
| `src/pages/programs/edit/curriculum/` (**디렉토리 삭제**) | — | 빈 디렉토리 정리 |

**합계 신규 코드**: ~1,205줄 (6 신규 + 2 이전 + 3 수정) / 모두 < 400줄 (최대 293)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (최대 **293줄** = `DateTimePicker.tsx`)
- [x] **V-2** catch / `if (error)` 모두 `console.error('[curriculum-tab] ...', err)` 또는 `[curriculum-match]` + `toast.error(...)` 한글
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. nested join은 inline anonymous type
- [x] **V-4** 사용자 노출 메시지 전부 한글 (탭 라벨·액션 버튼·테이블 헤더·placeholder·에러·확인창)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 (CurriculumTab 진입, StaffMatchModal 진입, DateTimePicker는 동기)
- [x] **V-6** Supabase 직접 fetch — CurriculumTab 자체 fetch. props는 `programId`만
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤. 임의 HEX 0건

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 1.83s** (production 번들 정상)
- preview dev server: ✅ vite v8.0.10 ready, console 에러 0건, `/login` redirect 정상
- 화면 검증: ⚠️ 인증 + 프로그램 데이터 필요. 박경수님 로그인 후 직접 확인

---

## 짚어둘 점

### 1. DateTimePicker 재사용 가능
- `mode='time'`: 시·분만 (커리큘럼 차시 시작/종료에서 사용)
- `mode='datetime'`: 캘린더 + 시·분 (향후 일정·캘린더 메뉴 등에서 재사용)
- 기본 `hours: 06~23` / `minutes: [00, 30]` — props로 커스터마이즈 가능
- 외부 클릭 / Escape 키 / [완료] 버튼으로 닫힘

### 2. 시간 자동 계산
- 시작 시간 또는 종료 시간 변경 시 `duration`(분)이 자동 재계산
- `computeDuration('13:00', '14:30')` → 90분
- 둘 중 하나만 있거나 종료가 시작보다 빠르면 `null`

### 3. 매칭 모달 defaultRole
- [강사 추가] 버튼 → 모달 역할 dropdown 기본값 '강사'
- [멘토 추가] 버튼 → '멘토'
- 사용자가 모달 안에서 변경 가능

### 4. 드래그 정렬
- HTML5 native `draggable` (라이브러리 추가 X)
- `onDragEnter` 시 즉시 클라이언트 재배열
- `onDragEnd` 시 일괄 `session_no` UPDATE
- 실패 시 `refresh()` fallback

### 5. 매칭 인력 정보 표시
- 외부 전문가: `staff_pool.phone` / `staff_pool.email`
- 내부 직원: `profiles.phone` / `profiles.email`
- nested join으로 한 번에 조회 (성능)

### 6. 라우트·App.tsx 영향
- 변경 없음. 기존 `/programs/:id` 그대로, 7번째 탭은 같은 라우트 안.

### 7. 롤백 가능성
- 단일 commit이라 `git revert <hash>` 한 줄로 즉시 되돌리기 가능
- 단, `program_curriculum.start_time` / `end_time` 컬럼은 SQL revert 별도 (코드만 revert해도 컬럼은 잔존 — `ALTER TABLE ... DROP COLUMN` 별도 실행 필요)
- 옛 매칭 모달·로우는 새 위치로 이동했으므로 git이 rename으로 인식 가능

### 8. Stage 3-B 예정 (별도 사전 확인 문서)
- 외부링크 노출 항목 시스템 (학생/담당자/강사 × 시점 4단계)
- 별도 문서 작성 예정

---

## 다음 액션

1. ✅ **Stage 3-A 화면 검증** — Netlify 배포 후 박경수님이 `/programs/<프로그램ID>` 진입 → "커리큘럼" 2번째 탭에서 다음 동작 확인:
   - [ ] [+ 차시 추가] → 1차시 자동 생성
   - [ ] 시작·종료 시간 picker (캘린더 없이 시·분 그리드만)
   - [ ] 주제·차시명 인라인 편집
   - [ ] 차시 펼침 → [+ 강사 추가] / [+ 멘토 추가] (각각 모달 역할 기본값 다름)
   - [ ] 매칭 인력 줄에 전화·이메일 표시 (sm 이상에서)
   - [ ] 토큰 [📋 복사] / [↗ 새 탭]
   - [ ] ⋮⋮ 드래그로 차시 순서 변경
   - [ ] 차시 [🗑 삭제] (확인창)
2. ✅ **Stage 3-B 진입 결정** — 외부링크 노출 항목 시스템 사전 확인 문서 작성 여부
