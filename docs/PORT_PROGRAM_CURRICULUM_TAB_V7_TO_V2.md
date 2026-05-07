# V7 → V2 이식 사전 확인 문서 — 커리큘럼 탭 + DateTimePicker (Stage 3-A)

> 작성일: 2026-05-08
> 진행 합의: **Stage 3-A 사전 확인 → 코드 진입은 승인 후**
> Stage 3-B (노출 항목 시스템)는 **별도 사전 확인 문서로 분리** — 이 문서엔 큰 그림만 예고
> 다음 단계: **Q1~Q5 결정 + 승인 → 코드 진입**

---

## 0. 이식 개요

| 항목 | 내용 |
|---|---|
| V7 참고 | NewEducationV9.tsx ⑥ 커리큘럼 카드 (테이블형 차시 + 시간 picker + 펼침 + 매칭) |
| 이식 범위 | ① 프로그램 상세 7탭 재구성 (커리큘럼 = 2번째 탭 신설) ② DateTimePicker 신규 컴포넌트 ③ 수정 페이지 ⑥ 카드 제거 |
| V2 신규 라우트 | 없음 (`/programs/:id` 안의 탭만 추가) |
| 관련 테이블 | 기존 `program_curriculum` + `curriculum_staff` 그대로 사용. **컬럼 1개 추가 검토** (Q3) |

---

## 1단계 — 현황 파악

### V7 ⑥ 커리큘럼 카드 (스크린샷 기반)

| 영역 | 동작 |
|---|---|
| 헤더 액션 3개 | [↑ 새 파일] [✦ AI 생성] [+ 차시 추가] |
| AI 추출 영역 | 파일·이미지 드래그 → AI가 커리큘럼 자동 추출 |
| 차시 행 (테이블) | 일차 / 시작 시간 / 종료 시간 / 주제·차시명 / 강사 / [▾ 펼침] / [🗑 삭제] |
| 차시 펼침 | + 강사 추가 / + 멘토 추가 / 설명 textarea |
| 매칭 정보 줄 | ✓ 매칭 (외부 강사) · 전화 · 이메일 |
| 시간 입력 UX | 캘린더 + 시(06~23) 그리드 + 분(00, 30) + [지금] [완료] |
| 하단 액션 | [취소 (목록으로)] [저장 (계속 편집)] [저장 후 상세] |

### V2 Stage 1 CurriculumCard (현재)

| 영역 | 동작 |
|---|---|
| 헤더 | [+ 차시 추가] 버튼 1개만 |
| 차시 행 (카드) | 카드 내부 펼침: 회차·날짜·시간(분)·장소·제목·내용·매칭 인력 목록 |
| 시간 입력 | `<input type="number">` (분 단위) — V7과 형태 다름 |
| 매칭 모달 | 외부/내부 탭 + 검색 + 역할·금액·메모 → 추가 (잘 작동 중) |

### 격차 정리

| 영역 | V7 | V2 (현재) | 격차 |
|---|---|---|---|
| 위치 | 수정 페이지 ⑥ 카드 안 | 수정 페이지 ⑥ 카드 안 | 박경수님 결정: **상세 7탭 중 2번째 탭으로 이동** + 수정 페이지에서 제거 |
| 차시 형태 | 테이블 (행 단위) | 카드 (펼침형) | **테이블로 변경** (Q2) |
| 시간 입력 | 시작·종료 시간 picker (캘린더+시·분) | 분 단위 숫자 입력 | **DateTimePicker 신규 컴포넌트** + 시작·종료 컬럼 |
| AI 추출 | 드래그앤드롭 + AI 호출 | 없음 | placeholder (Q1) |
| 새 파일 업로드 | Storage 업로드 | 없음 | placeholder (Q1) |
| 멘토 추가 | 강사·멘토 별도 액션 | curriculum_staff.role 5종 통합 (강사·FT·멘토·TA·운영진) | V2 모델 유지 — UI만 [+ 강사 추가] / [+ 멘토 추가] 두 버튼으로 분리 |
| 매칭 정보 표시 | 이름·전화·이메일 | 이름·역할·금액·상태 | V2 정보 + 전화·이메일 표시 추가 (join 확장) |

---

## 2단계 — 이식 계획

### A. 가져올 것 (V7 UX → V2)
1. **테이블형 차시 행** (일차·시작·종료·주제·강사·펼침·삭제)
2. **시간 입력 picker UX** (DateTimePicker 신규)
3. **차시 펼침 시 강사·멘토 분리 액션** (UI만, 데이터는 role enum 그대로)
4. **매칭 정보 한 줄 표시** (이름·전화·이메일 — staff_pool/profiles에서 join)
5. 헤더 [+ 새 파일]·[✦ AI 생성] 버튼 (placeholder)
6. 하단 [저장 (계속 편집)] / [저장 후 상세] 분리 — 단, 상세 탭이라 [저장]만 있어도 OK (Q4)

### B. 버릴 것
- ❌ V7 자체 v9-card·다크모드·강한 그라데이션 → V2 표준 토큰
- ❌ AI 추출 실제 호출 → STEP-AI-PREP 후 (Q1)
- ❌ 파일 Storage 업로드 → STEP-STORAGE 후 (Q1)
- ❌ 강사 단일 텍스트 필드 (V7) — V2는 curriculum_staff 매칭으로 일원화

### C. V2 표준으로 새로 쓸 것

| 신규/수정 파일 | 줄 수 추정 | 역할 |
|---|---|---|
| `src/components/ui/DateTimePicker.tsx` (신규) | ~280 | 캘린더 + 시(06~23) 그리드 + 분(00, 30) + [지금] [완료] |
| `src/pages/programs/detail/CurriculumTab.tsx` (신규) | ~240 | 메인 + 차시 CRUD + 매칭 모달 호출 |
| `src/pages/programs/detail/curriculum/CurriculumRow.tsx` (신규) | ~250 | 테이블 행 + 펼침 + 강사/멘토 추가 |
| `src/pages/programs/detail/curriculum/curriculumTabUtils.ts` (신규) | ~170 | fetch 통합 + staff join |
| `src/pages/programs/ProgramDetailPage.tsx` (수정) | +5 | 7탭 재구성 (커리큘럼 = 2번째) |
| `src/pages/programs/edit/ProgramEditPage.tsx` (수정) | -1 | CurriculumCard import 제거 |
| `src/pages/programs/edit/cards/CurriculumCard.tsx` | (삭제) | 상세 탭으로 이전 |
| `src/pages/programs/edit/curriculum/StaffMatchModal.tsx` | (이동/유지) | 상세 탭에서도 재사용 — 경로 그대로 두고 import 양쪽 |
| `src/pages/programs/edit/curriculum/StaffMatchRow.tsx` | (이동/유지) | 동일 |

**모든 신규 파일 < 400줄. V-1 통과 예상.**

### D. DB 컬럼 매핑·확장

V7 스타일 (시작·종료 시간 분리)을 위해 **`program_curriculum` 컬럼 검토 필요** (Q3):

| 현재 V2 컬럼 | V7 스타일 |
|---|---|
| `session_date` (date) | `session_date` (date) — 그대로 |
| `duration` (integer 분) | ⚠️ 추가 컬럼 검토: `start_time` (time) + `end_time` (time) |
| (없음) | `start_time` `end_time` — V7처럼 시작·종료 picker 운영 시 필요 |

**의사결정 Q3** 참조.

`curriculum_staff` 매칭 정보 표시용 join 확장:
```sql
select *,
  staff_pool:staff_pool(id, name, phone, email),
  profile:profiles(id, name, phone, email)
from curriculum_staff
where curriculum_id in (...)
```
이미 staff_pool 테이블에 `email`/`phone` 있는지 확인 필요. 없으면 표시는 staff_pool.name + (있는 컬럼만).

---

## 3. 화면 구성안 (V2 표준)

```
┌──────────────────────────────────────────────────────────────┐
│ ← 프로그램 목록 / 프로그램명 [유형][상태]   [✏ 수정] [📤 발송] │
├──────────────────────────────────────────────────────────────┤
│ [개요] [커리큘럼] [강사·교육생] [출석·일지] [결과·만족도]      │ ← 7탭
│                   [외부 공유] [결과보고서]                     │
└──────────────────────────────────────────────────────────────┘

[커리큘럼 탭]
┌──────────────────────────────────────────────────────────────┐
│ 커리큘럼                       [↑ 새 파일] [✦ AI] [+ 차시 추가] │
├──────────────────────────────────────────────────────────────┤
│ 💡 ⋮⋮ 드래그로 순서 변경 · 차시 클릭으로 설명 펼침   총 N차시   │
│  일차    시작    종료    주제·차시명          강사    펼침 삭제 │
├──────────────────────────────────────────────────────────────┤
│ ⋮⋮  1  ⏰ 13:00 ⏰ 14:00 오리엔테이션         윤현준  ▾  🗑   │
│   ┌─ 펼침 ────────────────────────────────────────────────┐  │
│   │ + 강사 추가  + 멘토 추가                               │  │
│   │ 설명: [진행일정 안내 및 팀빌딩________________]        │  │
│   │ ✓ 매칭 (외부 강사) · 010-4635-5354 · ytallman@hanmail.net│  │
│   └────────────────────────────────────────────────────────┘  │
│ ⋮⋮  1  ⏰ 14:00 ⏰ 16:00 AI 플랫폼 활용...    우태규  ▾  🗑   │
│ ⋮⋮  ...                                                       │
└──────────────────────────────────────────────────────────────┘
```

DateTimePicker 클릭 시:
```
┌──────────────────────────────────┐
│   <  2026년 5월   >               │
│   일 월 화 수 목 금 토             │
│             1 2 ...              │
│   3 4 5 6 [7] 8 9                │  ← 날짜 캘린더
│   ...                            │
├──────────────────────────────────┤
│  ⏰ 시                            │
│  06 07 08 09 10 11               │  ← 시 그리드
│  12 [13] 14 15 16 17             │
│  18 19 20 21 22 23               │
│                                  │
│  분                               │
│  [00] 30                         │  ← 분 그리드
├──────────────────────────────────┤
│  [지금]              [완료]       │
└──────────────────────────────────┘
```

---

## 4. V-1 ~ V-7 사전 점검

| 체크 | 계획 | 통과 여부 |
|---|---|---|
| V-1 400줄 이하 | 최대 ~280 (DateTimePicker) / 평균 ~210 | ✅ |
| V-2 catch + 한글 | `console.error('[curriculum-tab] ...', err)` + `toast.error(...)` | ✅ |
| V-3 any/unknown 미사용 | nested join은 inline anonymous type | ✅ |
| V-4 한글 메시지 | 모두 한글 | ✅ |
| V-5 cancelled 가드 | 모든 useEffect 비동기 fetch에 적용 | ✅ |
| V-6 직접 fetch | CurriculumTab 자체 fetch — props는 `programId`만 | ✅ |
| V-7 디자인 토큰 | violet/orange/cyan/emerald/rose 5톤만 | ✅ |

---

## 5. 박경수님 의사결정 5개 (Q1~Q5)

| # | 결정 사항 | 기본안 (제 추천) |
|---|---|---|
| **Q1** | **AI 생성 / 새 파일 버튼** | ✅ **버튼 표시 + 클릭 시 placeholder 안내** (`STEP-AI-PREP·STEP-STORAGE 완료 후 활성화 예정`) — UI 흐름 보존 |
| **Q2** | **차시 행 형태** | ✅ **V7 테이블형** (일차·시작·종료·주제·강사·펼침·삭제) — 사용자 멘탈 모델 V7과 동일 |
| **Q3** | **`program_curriculum`에 `start_time` / `end_time` 컬럼 추가?** | ✅ **추가 권장** — V7처럼 시작·종료 시간 picker 운영. `duration` 컬럼은 유지 (자동 계산용). 박경수님 Supabase 직접 ALTER 후 알려주세요 |
| **Q4** | **하단 [저장 (계속 편집)] / [저장 후 상세] 두 버튼** | ❌ **단일 [저장]** — 상세 탭 안이라 컨텍스트 그대로. 차시 추가/수정/삭제는 즉시 저장 (Stage 1과 동일 패턴) |
| **Q5** | **수정 페이지 ⑥ CurriculumCard 처리** | ✅ **제거** — 커리큘럼은 상세 탭으로 일원화. 수정 페이지 8 카드 → 7 카드 (직전 메시지 옵션 A) |

---

## 6. 작업 순서 (승인 후)

1. **Q3 SQL 박경수님 직접 실행** (`start_time` / `end_time` 컬럼)
2. `types/database.ts` — `ProgramCurriculum`에 `start_time`/`end_time` 추가
3. `supabase/migrations/20260518_program_curriculum_time.sql` — 보존본
4. `src/components/ui/DateTimePicker.tsx` — 신규 (캘린더 + 시·분 그리드)
5. `src/pages/programs/detail/curriculum/curriculumTabUtils.ts` — fetch + staff join
6. `src/pages/programs/detail/curriculum/CurriculumRow.tsx` — 테이블 행 + 펼침
7. `src/pages/programs/detail/CurriculumTab.tsx` — 메인 (드래그·정렬·CRUD)
8. `ProgramDetailPage.tsx` — 7탭 재구성
9. `edit/ProgramEditPage.tsx` — `CurriculumCard` import·렌더 제거
10. `edit/cards/CurriculumCard.tsx` 삭제
11. `tsc -b` → V-1~V-7 검증 → 보고서 → commit/push

**예상 작업 시간**: 70~90분 / **commit 1건**: `feat: V7 이식 — 커리큘럼 상세 탭 + DateTimePicker (Stage 3-A)`

**롤백**: 단일 commit이라 `git revert <hash>` 한 줄. SQL ALTER (Q3) 만 별도 revert 필요.

---

## 7. Stage 3-B 예고 — 노출 항목 시스템

박경수님이 추가로 주신 "외부링크 노출 항목 (학생/담당자/강사 × 시점 4단계)" 은 **별도 사전 확인 문서**로 진입할게요. 이유:

- **데이터 모델 결정이 큼**: 항목 20+ × 역할 3 × 시점 4 = 240 조합. 어떻게 저장할지 (테이블 / jsonb / config) 설계 필요
- **외부링크 발송 시스템과 연동**: `?role=student`·`?role=client` 파라미터 처리 + 기존 외부 라우트(`/apply`·`/recruit`·`/attend` 등)와의 노출 정책 통합
- **시점 분류 로직**: 모집(홍보) / 교육 전(사전 안내) / 교육 중(정보 수집·출석·입력·만족도) / 교육 후(결과 보고) — 각 시점의 trigger 정의 필요

Stage 3-A 끝나면 Stage 3-B 사전 확인 문서를 별도 작성해서 박경수님 검토 받겠습니다.

---

## 8. 다음 액션

✅ 박경수님이 **이 문서 검토** → Q1~Q5 결정 → 그 후 코드 진입

**Q3 (start_time / end_time 컬럼) 추가 진행 시 SQL**:
```sql
ALTER TABLE program_curriculum
  ADD COLUMN IF NOT EXISTS start_time TIME,
  ADD COLUMN IF NOT EXISTS end_time   TIME;
```
박경수님이 Supabase Dashboard에서 직접 실행하시고 결과 알려주시면 코드 진입할게요.
