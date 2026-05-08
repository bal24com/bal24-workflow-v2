# STEP 11 Stage 11-③ 이식 결과 보고 — 신청·모집 내부 탭

> 작업일: 2026-05-08
> 박경수님 결정: Stage 11-② 검증 완료 → Stage 11-③ 진입
> 범위: StaffStudentsTab → 4 sub 섹션 (강사·교육생·신청·모집)

---

## 매핑 요약

| 영역 | 동작 | 비고 |
|---|---|---|
| **강사** | instructor_invitations 목록 | 기존 코드 유지 |
| **교육생** | participant_applications where status IN ('accepted','completed') | 신규 — 승인된 학생만 분리 표시 |
| **신청** | participant_applications 전체 + 상태 변경 | 신규 — ApplicationsPanel |
| **모집** | recruit_forms + recruit_applications 합격/불합격 | 신규 — RecruitsPanel |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것
- 박경수님 사전 확인 문서 Q2 옵션 B 7탭 + sub 패턴 (Stage 11-② 동일)
- 기존 강사 초빙 코드 (InvitationRow + INVITATION_STATUS_STYLE)

### 버린 것
- ❌ STEP 11 후속 영역 (별도 STEP)

### 새로 작성한 것
- `applications/ApplicationsPanel.tsx` — 신청 목록 + 필터(전체/신청/검토중/승인/반려) + 펼침 상세 + [검토 시작]/[반려]/[승인] 액션 + reviewed_by/reviewed_at audit
- `applications/RecruitsPanel.tsx` — 모집 공고 목록 (펼침) → 각 공고의 지원자 + 펼침 상세 + [검토 시작]/[불합격]/[합격] 액션
- `StaffStudentsTab.tsx` 재작성 — 4 sub 탭 (강사/교육생/신청/모집)
- 교육생 sub: 승인·완료된 학생만 카드 그리드 (sm 이상 2열)
- 신청 sub: 5 필터 탭 (전체·신청·검토중·승인·반려)
- 모집 sub: 공고별 토큰 복사·새 탭 + 지원자 펼침 상세 (경력·메시지·포트폴리오 링크)

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `src/pages/programs/detail/applications/ApplicationsPanel.tsx` (신규) | 280 | 교육생 신청 + 상태 변경 |
| `src/pages/programs/detail/applications/RecruitsPanel.tsx` (신규) | **389** | 모집 공고·지원자 합격/불합격 |
| `src/pages/programs/detail/StaffStudentsTab.tsx` (재작성) | 217 | 4 sub 탭 |

**합계 신규 코드**: ~886줄 (2 신규 + 1 재작성) / 모두 < 400줄 (최대 389)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (최대 **389줄** = `RecruitsPanel.tsx`)
- [x] **V-2** catch / error 모두 `console.error('[step-11/applications] ...', err)` / `[step-11/recruit]` / `[step-11/staff]` / `[step-11/student]` + 한글 toast
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건. `Record<string, unknown>` (audit patch)는 V2 표준 허용 패턴
- [x] **V-4** 사용자 노출 메시지 전부 한글 (필터 라벨·상태 라벨·확인창·toast 모두)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 (각 sub 섹션 + ApplicantList)
- [x] **V-6** Supabase 직접 fetch — 각 sub·panel·ApplicantList 자체 fetch
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤. 임의 HEX 0건

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 3.91s**
- preview dev server: ✅ console 에러 0건

---

## 짚어둘 점

### 1. ApplicationsPanel 필터 탭
- 5 탭: 전체 / 신청(applied) / 검토중(reviewing) / 승인(accepted) / 반려(rejected)
- 카운트 배지 — 각 상태별 건수 실시간 표시
- 펼침 시 지원 동기·소속·이메일 표시 + 액션 (검토 시작 / 반려 / 승인)
- `reviewed_by` + `reviewed_at` audit 자동 기록
- `accepted` 시 학생이 "교육생" sub 탭에 자동 등장

### 2. RecruitsPanel 트리 구조
- 공고 목록 (recruit_forms) — 펼침 토글
- 각 공고의 토큰 복사 + 새 탭 (`/recruit/:token`)
- 펼침 시 지원자 목록 + 또 펼침 시 경력·메시지·포트폴리오 표시
- 액션 (검토 시작 / 불합격 / 합격) — `reviewed_by`·`reviewed_at` 자동
- 공고 없는 경우 "모집 메뉴에서 발행하세요" 안내

### 3. 교육생 sub 데이터 출처
- `fetchProgramApplications(programId, 100)` 후 `status IN ('accepted','completed')` 필터
- 추후 별도 `students` 테이블 운영 시 fetch 함수 분리 가능
- `completed` 는 violet 배지 / `accepted` 는 emerald 배지

### 4. 라우트·App.tsx 영향
- 변경 없음. StaffStudentsTab 재작성만.

### 5. 롤백 가능성
- 단일 commit이라 `git revert <hash>` 한 줄
- DB 변경 없음 — 코드만 revert로 충분

---

## STEP 11 전체 완료

| 단계 | 내용 | commit |
|---|---|---|
| 11-① | 외부 페이지 3종 (cert·attend·apply) | `4575faf` |
| 11-② | 출석·수료증 내부 탭 + 학생 토큰 통일 | `83ec17e` |
| 11-③ | 신청·모집 내부 탭 | (이번) |

**총 3 commit · 약 3,200줄 신규 코드 · 모두 V-1~V-7 통과**

---

## 다음 액션

1. ✅ **Stage 11-③ 화면 검증** — 박경수님이 프로그램 상세 → 강사·교육생 탭 → 4 sub 확인:
   - [ ] **강사 sub**: instructor_invitations 목록
   - [ ] **교육생 sub**: 승인·완료된 학생만 2열 카드
   - [ ] **신청 sub**: 5 필터 탭 → 펼침 → 지원 동기 → [승인]/[반려]/[검토 시작]
   - [ ] **모집 sub**: 공고 펼침 → 지원자 → 펼침 → 경력·메시지·포트폴리오 → [합격]/[불합격]
2. ✅ **STEP 11 전체 마무리** — 모든 commit 완료. 다음 STEP 진입 결정 부탁드려요.
