# Stage 3-B-1 이식 결과 보고 — 외부공유 관리자 탭

> 작업일: 2026-05-08
> 사전 확인 문서: [PORT_PROGRAM_SHARE_TAB_V7_TO_V2.md](./PORT_PROGRAM_SHARE_TAB_V7_TO_V2.md)
> 박경수님 결정: SQL 실행 완료 / Q1~Q5 모두 추천대로
> 범위: **Stage 3-B-1 (관리자 탭만)** — 외부 페이지 3종(Stage 3-B-2)은 별도

---

## 매핑 요약

| 항목 | 사전 확인 | 이식 결과 |
|---|---|---|
| 데이터 모델 (Q1) | program_share 별도 테이블 | ✅ programs 1:1 + 4 날짜 + 3 토큰 + visibility jsonb |
| 외부 라우트 (Q2) | `/share/...` prefix | ✅ buildShareUrl로 `/share/:audience/:token` 생성 |
| 단계 판별 (Q3) | 4 날짜 시작일 기준 | ✅ detectStage(): result → progress → ready → pre → before |
| visibility default (Q4) | 모두 ON 시드 | ✅ defaultVisibility() — 13 항목 모두 true로 INSERT |
| Stage 분할 (Q5) | 3-B-1 + 3-B-2 분할 | ✅ 이번은 관리자 탭만, 외부 페이지는 별도 |

---

## 가져온 것 / 버린 것 / 새로 작성한 것

### 가져온 것 (V7 외부 노출 매트릭스 차용)
- 박경수님 명세 13 항목 (고객 7 + 학생 3 + 전문가 3)
- 4 단계 자동 판별 (사전·준비·진행·결과)
- 단계별 노출 매트릭스 (audience × stage × items)
- QR 코드 + 다운로드 (qrcode.react 기존 사용처 패턴 재사용)
- 토큰 재발급 (보안 사고 시)

### 버린 것 (Q5 결정대로)
- ❌ Stage 3-B-2 외부 페이지 3종 — 별도 commit
- ❌ STEP-AI-PREP / STEP-STORAGE 의존 항목 — placeholder 없음 (이번은 항목 토글만)
- ❌ 박경수님 명세 `/portal/client/...` — Q2 결정으로 `/share/...` prefix 채택 (기존 /portal/:token 충돌 회피)

### 새로 작성한 것 (V2 표준)
- `program_share` 1:1 테이블 + 외부 페이지용 RLS (public read·auth all)
- `ProgramShare`·`ShareAudience`·`ShareStage`·`ShareItem`·`ShareVisibility` 인터페이스
- `visibilityCatalog.ts` — 라벨·매트릭스·단계 팁 (코드 hardcoded 13 항목)
- `shareUtils.ts` — fetchOrSeed·detectStage·toggle·regenerate·buildShareUrl·describeStage
- `StageDateBar.tsx` — 4 날짜 picker + 현재 단계 배지 + dirty 감지 + [날짜 저장]
- `QrPreviewModal.tsx` — qrcode.react 기반 QR + PNG 다운로드
- `AudienceTab.tsx` — 단일 대상 (링크·QR·재발급·단계별 그룹 체크박스)
- `ShareTab.tsx` 재작성 — 4 날짜 + 3 대상 탭 + 기타 토큰 모음(접힘)

---

## 신규/수정 파일

| 파일 | 줄 수 | 역할 |
|---|---|---|
| `supabase/migrations/20260520_program_share.sql` (신규) | 33 | 테이블 + 인덱스 + RLS 보존본 |
| `src/types/database.ts` (수정) | +35 | ShareAudience·ShareStage·ShareItem·ShareVisibility·ProgramShare |
| `src/pages/programs/detail/share/visibilityCatalog.ts` (신규) | 91 | 라벨·매트릭스·팁 |
| `src/pages/programs/detail/share/shareUtils.ts` (신규) | 157 | fetch/save/단계 판별/토큰/URL |
| `src/pages/programs/detail/share/StageDateBar.tsx` (신규) | 90 | 4 날짜 picker + 단계 배지 |
| `src/pages/programs/detail/share/QrPreviewModal.tsx` (신규) | 76 | QR + PNG 다운로드 |
| `src/pages/programs/detail/share/AudienceTab.tsx` (신규) | 188 | 대상별 (링크·QR·체크박스) |
| `src/pages/programs/detail/ShareTab.tsx` (재작성) | 207 → **368** | 4 날짜 + 3 대상 탭 + 기타 토큰 모음 |

**합계 신규 코드**: ~970줄 (6 신규 + 2 수정 + 1 SQL) / 모두 < 400줄 (최대 368)

---

## V-1 ~ V-7 체크리스트

- [x] **V-1** 모든 파일 400줄 이하 (최대 **368줄** = `ShareTab.tsx`)
- [x] **V-2** catch / error 모두 `console.error('[program-share] ...', err)` + `toast.error(...)` 한글
- [x] **V-3** any/unknown 미사용 — `as any`·`: unknown` 0건
- [x] **V-4** 사용자 노출 메시지 전부 한글 (단계 라벨·항목 라벨·confirm·toast)
- [x] **V-5** useEffect 비동기 fetch에 `cancelled` 가드 (ShareTab 진입·legacy 펼침)
- [x] **V-6** Supabase 직접 fetch — 각 컴포넌트가 props·콜백으로 협업, props drilling 없음
- [x] **V-7** 디자인 토큰 일관성 — violet/orange/cyan/emerald/rose 5톤. 임의 HEX는 QR fgColor `#1E1B4B` 1곳 (V2 헤더 색)

---

## 검증 결과

- `npx tsc -b`: ✅ **exit 0**
- `npx vite build`: ✅ **built in 1.92s** (production 번들 정상)
- preview dev server: ✅ vite v8.0.10 ready, console 에러 0건, `/login` redirect 정상
- 화면 검증: ⚠️ 인증 + 프로그램 데이터 필요. 박경수님 로그인 후 직접 확인

---

## 짚어둘 점

### 1. 자동 시드 동작
- 외부공유 탭 첫 진입 시 program_share 비어 있음을 감지 → `fetchOrSeedProgramShare`가 INSERT (3 토큰 자동 발급 + 13 항목 모두 ON)
- 이후 진입은 기존 row 사용

### 2. 단계 자동 판별 (Q3 시작일 기준)
- result_date ≤ 오늘 → `result`
- 그 외엔 progress → ready → pre 순으로 체크
- 모두 미설정·미도래 → `before`
- 헤더 배지에 "현재 단계: 진행 (시작 D+5)" 형태로 표시

### 3. 항목 토글
- 체크박스 클릭 시 즉시 supabase update (busy 표시)
- visibility는 jsonb로 한 번에 저장
- 단계별 그룹 펼쳐 표시 — 현재 단계는 violet 배지로 강조

### 4. 토큰 재발급
- 보안 사고 시 사용자 [토큰 재발급] 버튼 → confirm → 새 토큰 INSERT → 기존 링크 무효화
- crypto.randomUUID 사용, fallback Math.random

### 5. 기타 토큰 모음 (접힘)
- 기존 ShareTab의 신청·모집·출석·폼 토큰 표시는 보존
- "기타 외부 링크" 접힘 섹션 — 펼칠 때만 fetch
- 박경수님이 추후 통합 결정 시 손쉽게 정리 가능

### 6. Stage 3-B-2 진입 시 필요한 것
- `/share/client/:token`·`/share/student/:token`·`/share/expert/:token` 라우트
- 각 외부 페이지 컴포넌트 + 13 항목별 작은 컴포넌트
- 외부에서 `program_share` 토큰 SELECT (RLS public_read_by_token 이미 적용)
- 단계 자동 판별 → 해당 단계의 visibility 항목만 렌더

### 7. 라우트·App.tsx 영향
- 변경 없음. ShareTab은 기존 6번째 탭 자리(외부 공유) 그대로.

### 8. 롤백 가능성
- 단일 commit이라 `git revert <hash>` 한 줄로 즉시 되돌리기 가능
- `program_share` 테이블은 SQL revert 별도 (코드만 revert해도 테이블·시드 row 잔존)

---

## 다음 액션

1. ✅ **Stage 3-B-1 화면 검증** — Netlify 배포 후 박경수님이 `/programs/<프로그램ID>` → "외부 공유" 탭에서 다음 동작 확인:
   - [ ] 첫 진입 시 자동 시드 (4 날짜 모두 비어있음, 13 항목 모두 ON)
   - [ ] 4 날짜 입력 → "저장 안 된 변경" 표시 → [날짜 저장] → toast
   - [ ] 현재 단계 배지 자동 갱신 (시작일 기준)
   - [ ] [고객] [학생] [전문가] 탭 전환
   - [ ] 각 탭에서 링크 [복사]/[새 탭]/[QR] 동작
   - [ ] QR 모달에서 [PNG 다운로드]
   - [ ] 항목 체크박스 토글 (단계별 그룹·현재 단계 violet 배지)
   - [ ] [토큰 재발급] confirm → 새 토큰 발급 + 기존 링크 무효
   - [ ] 하단 "기타 외부 링크" 접힘 → 펼치면 신청·모집·출석·폼 토큰 표시
2. ✅ **Stage 3-B-2 진입 결정** — 외부 페이지 3종 + 13 항목 컴포넌트 (90~120분, 1 commit)
