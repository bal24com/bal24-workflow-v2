# Stage 3-C 이식 결과 보고 — 커리큘럼 템플릿 (재활용 모음)

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_CURRICULUM_TEMPLATES_V7_TO_V2.md](./PORT_CURRICULUM_TEMPLATES_V7_TO_V2.md)
> 박경수님 결정: SQL 실행 완료 / Q1~Q6 모두 추천대로
> 범위: 차시 묶음 템플릿 저장·불러오기 (V2 신규 기능)

---

## 매핑 요약

| 항목 | 사전 확인 | 이식 결과 |
|---|---|---|
| 데이터 모델 (Q1) | 정규화 2 테이블 | ✅ `curriculum_templates` + `curriculum_template_items` |
| 모음 위치 (Q2) | 모달 안에서만 | ✅ CurriculumTab 헤더 [📥 가져오기] 모달 안에서 목록·삭제·미리보기 |
| 가져오기 옵션 (Q3) | 덮어쓰기 / 뒤에 추가 둘 다 선택 | ✅ 라디오 fieldset, 기본값: append |
| 시스템 시드 (Q4) | 시드 X | ✅ 사용자가 만든 것만 |
| 인력 매칭 포함 (Q5) | 포함 X | ✅ 차시 메타 7 필드만 (`session_no`·`title`·`content`·`duration`·`start_time`·`end_time`·`venue`) |
| session_date 저장 (Q6) | 저장 X | ✅ 가져올 때 null로 |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것
- 템플릿 카드 UI 패턴 (이름·설명·차시 수·생성일)
- 검색 + 펼침형 미리보기

### 버린 것 (Q4·Q5·Q6 결정대로)
- ❌ 시스템 기본 시드 — 사용자 직접 작성
- ❌ 인력 매칭·token 정보 — 재사용 의미 없음
- ❌ session_date — 프로그램마다 다름

### 새로 작성한 것 (V2 표준)
- 정규화 2 테이블 (`curriculum_templates` + `curriculum_template_items`) — V2 portal_templates 패턴
- `curriculumTemplateUtils.ts` — fetch / save / load (replace·append) / delete + INSERT 트랜잭션
- `SaveTemplateModal.tsx` — 이름·설명 + 차시 미리보기 (Q5·Q6 안내문 포함)
- `LoadTemplateModal.tsx` — 목록 + 검색 + 펼침 미리보기 + 삭제 + 가져오기 옵션 라디오
- `CurriculumTab.tsx` 헤더에 [📥 템플릿 가져오기] [💾 템플릿으로 저장] 버튼 추가
- 저장 버튼은 차시 0개일 때 비활성

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/migrations/20260519_curriculum_templates.sql` (신규) | 47 | 2 테이블 + index + RLS 보존본 |
| `src/types/database.ts` (수정) | +25 | `CurriculumTemplate` + `CurriculumTemplateItem` 인터페이스 |
| `src/pages/programs/detail/curriculum/curriculumTemplateUtils.ts` (신규) | 181 | fetch / save / load / delete + INSERT 트랜잭션 |
| `src/pages/programs/detail/curriculum/SaveTemplateModal.tsx` (신규) | 133 | 저장 모달 (Q5·Q6 안내문 포함) |
| `src/pages/programs/detail/curriculum/LoadTemplateModal.tsx` (신규) | 297 | 목록·검색·미리보기·삭제·가져오기 옵션 |
| `src/pages/programs/detail/CurriculumTab.tsx` (수정) | 271 (+44) | 헤더 버튼 2개 + 모달 2개 렌더 |

**합계 신규 코드**: ~683줄 (4 신규 + 2 수정 + 1 SQL) / 모두 < 400줄

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (이식 영역 최대 **303줄** = `CurriculumRow.tsx`. 신규 영역 최대 **297줄** = `LoadTemplateModal.tsx`)
- [x] **V-2** catch / `if (error)` 모두 `console.error('[curriculum-templates] ...', err)` + `toast.error(...)` 한글
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. nested join은 inline anonymous type
- [x] **V-4** 사용자 노출 메시지 전부 한글 (모달·옵션 라디오·확인창·toast 모두)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 (LoadTemplateModal 진입)
- [x] **V-6** Supabase 직접 fetch — 각 모달이 자체 fetch. props는 programId·sessions 등 메타만
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤. 임의 HEX 0건

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 2.59s**
- preview dev server: ✅ vite v8.0.10 ready, console 에러 0건, `/login` redirect 정상
- 화면 검증: ⚠️ 인증 + 차시 데이터 필요. 박경수님 로그인 후 직접 확인

---

## 짚어둘 점

### 1. 저장 흐름
- CurriculumTab 헤더 [💾 템플릿으로 저장] 클릭 (차시 ≥ 1 일 때만 활성)
- 모달에 현재 차시 미리보기 자동 표시
- 이름 필수 / 설명 선택
- [저장] → `curriculum_templates` INSERT → id 받아서 `curriculum_template_items` 일괄 INSERT
- 인력 매칭·날짜는 저장 안 됨 (모달에 안내 ⓘ 노출)

### 2. 가져오기 흐름
- CurriculumTab 헤더 [📥 템플릿 가져오기] 클릭
- 모달: 검색 + 목록 + 각 카드 펼침 미리보기 (차시 제목·시간)
- 가져오기 방식 라디오:
  - **뒤에 추가** (기본값): 기존 차시 유지 + max session_no + 1, 2, … 로 INSERT
  - **덮어쓰기 ⚠️**: 기존 차시 + 매칭 정보 모두 DELETE → 1차시부터 INSERT
- [가져오기] → CurriculumTab refresh → toast `${N}개 차시를 가져왔어요`

### 3. 부분 실패 처리
- `saveAsTemplate`에서 templates INSERT 성공·items INSERT 실패 시 사용자에게 "템플릿 메타는 생성됨" 안내 — 다시 시도 가능
- `loadTemplateInto` replace 모드는 트랜잭션이 아니라 DELETE→INSERT 순차. DELETE 실패 시 INSERT 안 함

### 4. 라우트·App.tsx 영향
- 변경 없음. 모달 안에서 모두 처리.

### 5. 롤백 가능성
- 단일 commit이라 `git revert <hash>` 한 줄
- `curriculum_templates` / `curriculum_template_items` 테이블은 SQL revert 별도 필요 (코드만 revert해도 테이블·데이터 잔존)

### 6. Stage 3-B 예고 — 다음 단계
- 외부링크 노출 항목 시스템 (학생/담당자/강사 × 시점 4단계)
- 별도 사전 확인 문서 진입 예정

---

## 다음 액션

1. ✅ **Stage 3-C 화면 검증** — Netlify 배포 후 박경수님이 `/programs/<프로그램ID>` → 커리큘럼 탭 → 다음 동작 확인:
   - [ ] 차시 1~2개 추가·저장 후 [💾 템플릿으로 저장] → 이름 입력 → 저장 → toast
   - [ ] [📥 템플릿 가져오기] → 목록에 방금 저장한 템플릿 표시
   - [ ] 템플릿 클릭 펼치면 차시 미리보기
   - [ ] **뒤에 추가** 모드로 가져오기 → 차시가 N+1, N+2… 로 추가
   - [ ] **덮어쓰기** 모드 → 기존 차시 다 삭제 + 1차시부터 새로 생성
   - [ ] 템플릿 [🗑] 버튼으로 삭제 (다른 프로그램 영향 없음)
2. ✅ **Stage 3-B 진입 결정** — 외부링크 노출 항목 시스템 사전 확인 문서 작성
