# 99. 트러블슈팅 + 시스템 점검 (2026-05-28)

## 시스템 점검 결과 — 양호

| 항목 | 결과 | 비고 |
|---|---|---|
| TypeScript 빌드 (`tsc -b`) | ✅ 통과 | 0 에러 |
| 컴포넌트 400줄 규칙 | ✅ 준수 | 최대 400 (`EstimateTab`·`ContractFormModal`·`AuditPortalPage`) |
| `catch{}` 빈 블록 | ✅ 0건 | 모두 console.error + toast 처리 |
| `localStorage` 위반 | ✅ 0건 | `AuthContext`·`supabase.ts` 만 (시스템) |
| `TODO/FIXME` 주석 | ✅ 0건 | 깨끗 |
| `: any` 타입 | ⚠️ 2건 | `myPageUtils.ts:1` · `staffFeeUtils.ts:1` — 비핵심 |
| `console.error` 로깅 | 653건 | 정상 (에러 추적용) |
| 총 라우트 | 73개 | 인증 후 22 + 외부 토큰 15+ + 보조 |
| 총 마이그레이션 SQL | 124개 | 누적 |

**결론**. 코드 품질 자체는 양호. 박경수님이 느끼는 "누더기" 는 **메뉴 수가 많아 인지적으로 헷갈리는 것**. 매뉴얼 문서로 정리해서 풀어요.

---

## 자주 일어난 이슈 + 해결법

### ① 모달이 드래그로 닫힘
**증상**. 입력란에서 텍스트 드래그하다가 마우스 떼면 모달 닫힘.
**원인**. mousedown 위치 무관하게 mouseup 으로 onClick 발동.
**조치**. 공용 `components/ui/Modal.tsx` 에 mousedown-on-backdrop 패턴 적용됨. 신규 모달 작성 시 `mouseDownOnBackdropRef` 사용.

### ② 한글 NFC 정규화 CHECK 충돌
**증상**. SQL UPDATE 시 한글 CHECK 제약 위반. hex 봤더니 정상 한글.
**원인**. NFC vs NFD (예. `거래처` 가 NFC 와 NFD 에서 다른 byte 시퀀스).
**조치**. CHECK 제약을 빼고 앱 레벨에서만 검증.

### ③ Storage 사진이 일지 조회·PDF 에서 안 보임
**증상**. 사진 첨부 후 저장 토스트는 떴는데 일지 보면 "첨부된 사진이 없어요".
**원인**. `mentoring_logs.photo_urls` 컬럼이 DB 에 없어서 PostgREST 가 silent drop. 박경수님이 STEP-PORTAL-MULTI-FIX g 마이그레이션을 적용 안 한 상태에서 사진 첨부.
**조치**. 컬럼 추가 후 새로 작성한 일지는 정상. 과거 일지는 Storage 에 사진은 있지만 DB row 와 끊겨 매핑 SQL 또는 수정 재업로드 필요. 자세한 SQL → [③-1 사진 복구 SQL](#③-1-사진-복구-sql).

### ③-1 사진 복구 SQL
시간 기반 추정 매핑 (위험 — 다른 강사 사진 섞일 수 있음):

```sql
UPDATE public.mentoring_logs ml
   SET photo_urls = (
     SELECT jsonb_agg(
       jsonb_build_object(
         'url',         'https://clsljkxvgmqwenettkrz.supabase.co/storage/v1/object/public/mentoring-files/' || o.name,
         'path',        o.name,
         'filename',    substring(o.name from '[^/]+$'),
         'size',        COALESCE((o.metadata->>'size')::bigint, 0),
         'uploaded_at', o.created_at::text
       ) ORDER BY o.created_at
     )
     FROM storage.objects o
    WHERE o.bucket_id = 'mentoring-files'
      AND o.created_at BETWEEN ml.created_at - interval '30 minutes'
                           AND ml.created_at + interval '30 minutes'
   )
WHERE jsonb_array_length(COALESCE(ml.photo_urls, '[]'::jsonb)) = 0
  AND ml.created_at >= '2026-05-01'
  AND EXISTS (
    SELECT 1 FROM storage.objects o2
     WHERE o2.bucket_id = 'mentoring-files'
       AND o2.created_at BETWEEN ml.created_at - interval '30 minutes'
                             AND ml.created_at + interval '30 minutes'
  );
```

### ④ PDF 다운로드 백지 (멘토링 일지)
**증상**. PDF 다운로드는 되는데 페이지가 백지. 강사료 PDF 는 정상.
**원인**. Supabase Storage 의 public URL 이 박경수님 브라우저에서 CORS 헤더를 협상 못 함. html2canvas 가 캡쳐 후 canvas 가 tainted → toDataURL 시 SecurityError.
**조치 v5 (현재)**. `mentoringLogPdf.ts` 가 사진을 `supabase.storage.download()` SDK 로 받아 base64 data URL 로 변환. CORS 우회.
**재발 시 진단**. F12 → Console → `[PDF]` prefix 로그 확인. `data URL X/Y` 의 X 가 0 이면 Storage SDK 호출 실패.

### ⑤ 강사 포털 PIN 로그인 실패
**증상**. 강사가 `/portal` 접속해서 이름+PIN 넣었는데 "로그인 실패".
**원인 가능성**.
- PIN 평문이 마이그레이션 누락으로 해시 안 됨
- 강사 이름이 DB 와 정확히 일치 안 함 (공백·한자 차이)
- pin_locked_until 잠금 상태

**조치**.
1. `/experts` → 해당 강사 → [PIN 초기화] (ADMIN)
2. 새 PIN 로 다시 시도
3. SQL 로 잠금 해제. `UPDATE staff_pool SET pin_fail_count=0, pin_locked_until=NULL WHERE name='우태규';`

### ⑥ Netlify 빌드 실패 (tsc -b)
**증상**. `tsc --noEmit` 는 통과했는데 `tsc -b` 가 실패.
**원인**. props 타입에 새 필드가 없는데 부모가 전달 (또는 그 반대).
**조치**. `npx tsc -b` 로 로컬 재현 → 에러 메시지 정확히 읽고 수정.

### ⑦ 마이그레이션 SQL 실행 순서 누락
**증상**. INSERT 시 테이블 없음 에러.
**원인**. 박경수님이 마이그레이션 SQL 건너뛰고 INSERT 직접 시도.
**조치**. 답변 첫 줄에 마이그레이션 SQL 을 명확히 배치하는 패턴.

### ⑧ Edge Function 배포 후 동작 안 함
**증상**. `supabase.functions.invoke(...)` 호출 시 "Function not found" 또는 401.
**원인 가능성**.
- 함수 이름 오타 (`mentoring-log-ai` vs `mentoring_log_ai`)
- Verify JWT 토글 ON (anon 호출 불가)
- ANTHROPIC_API_KEY 미등록

**조치**.
1. Dashboard → Edge Functions → 함수 이름 정확히 확인
2. Settings → Verify JWT OFF (anon 포털용)
3. Manage secrets 에 `ANTHROPIC_API_KEY` 존재 확인

### ⑨ 한글 콜론 사용 (CLAUDE.md 위반)
**증상**. 한국어 문장 끝에 `:` 사용.
**룰**. 콜론은 코드·key-value·레이블 내부에서만. 한국어 문장 끝은 마침표.
**예시**. ❌ "변경 사항:" → ✅ "변경 사항."

### ⑩ 라우트 73개 — 뭐가 어디 있는지 헷갈림
**증상**. 메뉴 너무 많아 안 보임.
**조치**. [00-overview.md](./00-overview.md) 의 사이드바 표 + 외부 토큰 라우트 표 참조.

---

## 진단 명령어 모음

### 빌드·타입 검증
```powershell
cd C:\workflow\bal24-workflow-v2
npx tsc -b                     # 빌드 전체
npx tsc --noEmit               # 타입만 체크 (빠름)
```

### Git 작업
```powershell
git log --oneline -20          # 최근 커밋 20개
git status                     # 변경 사항
git diff --stat                # 변경 통계
```

### 코드 검색
```powershell
# 라우트 확인
Select-String -Path src/App.tsx -Pattern "Route path="

# 시스템 룰 위반 체크
Get-ChildItem src -Recurse -Filter *.tsx | Select-String "catch\s*\{\s*\}"
Get-ChildItem src -Recurse -Filter *.tsx | Select-String "localStorage"
Get-ChildItem src -Recurse -Filter *.tsx | Select-String ": any"
```

---

## Supabase 자주 쓰는 SQL

### 시스템 상태 확인
```sql
-- 모든 테이블 목록
SELECT tablename FROM pg_tables WHERE schemaname='public' ORDER BY tablename;

-- 특정 테이블 컬럼
SELECT column_name, data_type, is_nullable
  FROM information_schema.columns
 WHERE table_name='mentoring_logs';

-- RLS 정책 목록
SELECT tablename, policyname, cmd, roles
  FROM pg_policies
 WHERE schemaname='public';
```

### 강사 PIN 초기화 (긴급)
```sql
UPDATE staff_pool
   SET portal_pin_hash = NULL,
       pin_fail_count  = 0,
       pin_locked_until = NULL
 WHERE name = '우태규';
```

### Edge Function 등록 확인
Dashboard → Edge Functions → 함수 목록에서:
- `mentoring-log-ai`
- `curriculum-log-ai` (2026-05-28 신규)
- `verify-staff-pin`
- `change-staff-pin`
- `ai-chat`
- `consortium-autofill`
- `analyze-survey`
- `send-invite`
- `send-notification`
- `decrypt-pii`
- `create-member`
- `cleanup-orphans`

총 12개. 다 OFF·ON 상태 + Verify JWT 상태 확인.

---

## 박경수님 절대 룰 위반 체크

CLAUDE.md 의 7가지 절대 룰. 신규 작업 시 매번 확인:

| 룰 | 체크 |
|---|---|
| localStorage 금지 | `Get-ChildItem src -Recurse -Filter *.tsx \| Select-String "localStorage"` |
| catch{} 빈 블록 금지 | `Select-String "catch\s*\{\s*\}"` |
| 400줄 초과 금지 | `Get-ChildItem src -Recurse -Filter *.tsx \| ForEach-Object { $c=(Get-Content $_).Count; if($c -gt 400){"$($_.FullName) $c"} }` |
| any 타입 금지 | `Select-String ": any"` |
| 영문 에러 메시지 노출 금지 | UI 토스트 한글인지 코드 리뷰 |
| 한국어 콜론 금지 | 문서 작성 시 마침표로 |
| 한글 우선 | placeholder·label·tooltip 한글 확인 |

---

## 다음 정리 후보 (선택)

| 항목 | 비고 |
|---|---|
| `myPageUtils.ts`·`staffFeeUtils.ts` 의 `any` 제거 | 사소 |
| `STEP-CONSORTIUM-REDESIGN A2~A5` 마무리 | in_progress 잔류 |
| 미사용 페이지 디렉토리 정리 | `src/pages/education/` (구버전) |
| 마이그레이션 SQL 통합 | 124개 → 도메인별 폴더 정리 |
| `MentoringLogForm` 사진 저장 silent-fail 방어 코드 | 박경수님 결정 대기 |
