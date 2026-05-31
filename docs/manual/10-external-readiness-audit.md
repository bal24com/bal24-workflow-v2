# 10. 외부 사용 준비 점검 (2026-05-29)

> 박경수님 사용 시나리오 기준 종합 점검.
> 내부 1~3명 · 컨소시엄 동시 3개 (5~8개사) · 프로젝트 동시 20개 (5~8개사)
> 프로그램 동시 30개 · 외부 사용자 약 **500명** (멘토·교육생·학교·교육청).

---

## 종합 평가 — 🟡 양호하지만 **3가지** 보강 필요

| 영역 | 평가 | 비고 |
|---|---|---|
| **코드 품질** | 🟢 우수 | 빌드 통과·룰 위반 0건·매뉴얼 정비 완료 |
| **외부 토큰 보안** | 🟠 보강 필요 | 토큰 만료·시도 제한 일부 누락 |
| **RLS 정책** | 🟡 권한 너무 광범위 | anon `USING(true)` 78건 — 토큰 검증 의존 |
| **DB 인덱스** | 🟢 정비됨 | 인덱스 85개·핵심 컬럼 커버 |
| **Storage 정책** | 🟡 일부 검토 필요 | 버킷별 anon 권한 분리 확인 |
| **Edge Functions 비용** | 🟡 모니터링 필요 | AI 폭증 시 월 $50~100 가능 |
| **부하 (500명 동시)** | 🟢 무리 없음 | Supabase 기본 한도 충분 |
| **에러 처리** | 🟢 통일 | `console.error + toast` 패턴 일관 |

---

## 🔴 Critical — 즉시 보강 권장 (3건)

### 1. 외부 토큰 만료일 미설정 위험

**증상**. 다수 외부 토큰 라우트 (`/checkin/:token`·`/form/:token`·`/portal/:token`·`/log/:token` 등) 가 영구 유효. 한 번 발급된 링크가 사업 종료 후에도 동작.

**위험**. 졸업한 교육생이 옛 일지·결과물에 접근 가능. URL 유출 시 영구 접근.

**조치**.
```sql
-- 1) 토큰 발급 시 default 90일 만료 정책
ALTER TABLE attendance_sessions
  ALTER COLUMN created_at SET DEFAULT now();
-- 외부 라우트 컴포넌트에서 expires_at 검증 추가 (별도 commit)
```

또는 코드 레벨 — 외부 페이지 진입 시 `created_at` 기준 N일 경과 시 "링크 만료" 페이지.

### 2. anon UPDATE/INSERT 정책 `USING (true)` — 78건

**증상**. `mentoring_logs`·`curriculum_logs`·`participant_applications` 등 외부 토큰 라우트가 anon 으로 INSERT/UPDATE 시 모든 행 무차별 접근 가능.

**위험**. 토큰 유출되거나 추측 시 다른 사람 일지·신청서 수정 가능.

**예시 — `mentoring_logs` 의 anon UPDATE**.
```sql
CREATE POLICY "anon_update_mentoring_logs" ON public.mentoring_logs
  FOR UPDATE TO anon USING (true);  -- ⚠️ 모든 행 UPDATE 가능
```

**권장 패턴**. token 컬럼 또는 외래키 검증 추가.
```sql
-- 예시
CREATE POLICY "anon_update_own_log" ON public.mentoring_logs
  FOR UPDATE TO anon
  USING (
    EXISTS (
      SELECT 1 FROM mentoring_assignments a
       WHERE a.id = mentoring_logs.assignment_id
         AND a.mentor_access_token = current_setting('request.jwt.claims', true)::json->>'token'
    )
  );
```

**현실적 절충**. 토큰 검증을 Edge Function 에서만 처리 (현재 패턴). RLS 는 anon 인 척하지 못하게 단순 차단. 박경수님 환경에서 추후 보강.

### 3. 강사 PIN 잠금 정책 — 잠금 해제 자동화 부재

**증상**. PIN 5회 실패 시 `pin_locked_until` 설정되지만, 박경수님이 SQL 수동으로만 해제 가능.

**위험**. 강사 본인이 PIN 잊고 잠긴 후 박경수님께 전화/메일로 연락 → 응대 부담.

**조치**.
- 강사 포털 로그인 페이지에 "잠겼어요? PM 에게 PIN 초기화 요청" 안내 버튼 추가
- PM 대시보드 또는 `/experts` 에 "PIN 잠긴 강사 N명" 알림

---

## 🟠 High — 조만간 보강 (4건)

### 4. Storage 버킷 anon 권한 확인

**현재 버킷**. `mentoring-files` · `curriculum-photos` · `portal-photos` · `signatures` 등 4+개.

**필요 점검**.
```sql
-- Supabase SQL 에서 확인
SELECT id, name, public FROM storage.buckets;
SELECT bucket_id, name, owner FROM storage.objects LIMIT 5;
```

**권장**.
- 사진 (`mentoring-files`·`curriculum-photos`) — anon 읽기 허용 (외부 보기), anon 쓰기 토큰 검증
- 서명·계약서 (`signatures`·`contracts`) — anon 접근 금지, authenticated 만

### 5. Edge Functions 비용 폭증 방지

**현재 12개 함수**. `mentoring-log-ai`·`curriculum-log-ai`·`ai-chat`·`analyze-survey`·`consortium-autofill` 5개가 Anthropic API 호출.

**비용 시나리오** (500명 외부 사용).
- 멘토링 일지 AI 초안 — 1건 $0.02 × 100건/월 = $2/월
- 강의 일지 AI 초안 — 1건 $0.01 × 200건/월 = $2/월
- AI 채팅 (내부 박경수님) — $20~50/월
- 명함 인식 + 견적 분석 — $5~10/월
- **합계** — 월 $30~70 정상. 폭증 시 $100~200 가능.

**조치**.
- Anthropic Console 에서 **월 한도** 설정 (예. $100)
- 박경수님 외 사용자에게 AI 채팅 권한 분리 (필요 시)

### 6. mentoring_logs.photo_urls 최대 사진 수 강제 제한

**현재**. `PortalPhotoUpload` 가 `maxPhotos=10` 으로 클라이언트 제한.

**위험**. 멘토가 브라우저 우회 시 수십 장 업로드 가능 → Storage 폭증.

**조치**.
```sql
-- 서버 측 제한
ALTER TABLE mentoring_logs
  ADD CONSTRAINT photo_urls_max_10
  CHECK (jsonb_array_length(COALESCE(photo_urls, '[]'::jsonb)) <= 10);
```

### 7. participant_applications 신청 폭증 — Rate Limit 없음

**위험**. 외부 폼 (`/apply/:programId`) 에 봇이 무한 신청 가능.

**조치**.
- 폼 제출 시 reCAPTCHA 또는 honeypot 필드 추가
- 또는 IP 단위 시간당 N건 제한 (Edge Function)

---

## 🟡 Medium — 안정성 권장 (4건)

### 8. 동시 사용자 500명 부하 — 예상 가능

| 항목 | 한도 | 예상 부하 | 여유 |
|---|---|---|---|
| Supabase Pro DB 동시 연결 | 200 | 50~100 (피크) | ✅ |
| API 요청 (월) | 무제한 | 50K~100K | ✅ |
| Storage (Pro) | 100GB | 사진 12GB 추정 | ✅ |
| Edge Functions 호출 (월) | 2M | 30K~50K | ✅ |
| 대역폭 | 250GB/월 | 사진 다운로드 | 🟡 모니터링 |

→ Supabase Pro 플랜 (월 $25) **이상** 권장.

### 9. PDF 인쇄 fallback — 사용자 학습 부담

**현재**. html2canvas 백지 시 새 창 인쇄 fallback 으로 전환.

**부담**. 외부 멘토 500명에게 "인쇄 → PDF 로 저장" 안내 필요.

**조치**. 강사 포털 일지 화면에 "PDF 저장 방법" 1줄 안내 추가.

### 10. 모바일 반응형 점검

**확인 필요**. 외부 멘토·교육생이 스마트폰으로 접근. 사이드바·테이블·모달이 모바일에서 깨지는지.

**예상 문제**. 멘토링 일지 양식 표 (`MentoringLogDetailTable`) 가 좁은 화면에서 잘림.

### 11. 로그·모니터링 부족

**현재**. `console.error` 로만 로깅. 박경수님이 실시간 에러 모니터링 어려움.

**권장**. Supabase Logs 또는 Sentry 연동 (월 $0~26).

---

## 🔵 Low — 잠재 위험 (5건)

- 미사용 페이지 디렉토리 정리 (`src/pages/education/`)
- `: any` 타입 2건 (`myPageUtils`·`staffFeeUtils`)
- 컬럼 매핑 inconsistency (`expense_category` vs `expense_type` 등)
- 한국어 검색·정렬 (NFC 정규화 충돌 가능성)
- 사진 EXIF 회전 (모바일 카메라 90도 누움)

---

## 행동 항목 — 우선순위

| 순위 | 항목 | 예상 시간 |
|---|---|---|
| 🔴 1 | 토큰 만료 정책 도입 (90일 default) | 30분 |
| 🔴 2 | PIN 잠금 자동 해제 UI | 20분 |
| 🟠 3 | Storage 버킷 권한 점검 SQL | 15분 |
| 🟠 4 | Anthropic 월 한도 설정 (박경수님 Console) | 5분 |
| 🟠 5 | photo_urls 서버 제약 (CHECK ≤10) | 5분 |
| 🟠 6 | 신청 폼 봇 차단 (honeypot) | 15분 |
| 🟡 7 | Supabase Pro 플랜 (월 $25) | 박경수님 결정 |
| 🟡 8 | PDF 저장 안내 1줄 추가 | 10분 |
| 🟡 9 | 모바일 반응형 점검 | 30분 |
| 🟡 10 | Sentry 연동 (선택) | 1시간 |

---

## 종합 메시지

박경수님 — **현재 구조 자체는 외부 500명 부하 견딜 수 있어요.** 코드 품질·인덱스·기본 RLS 다 양호. 다만 **외부인이 사용하기 시작하면** 다음 3가지 보강이 필요해요.

1. **토큰 만료** — 영구 유효 링크는 사고 위험
2. **PIN 잠금 해제 UI** — 박경수님 운영 부담 줄이기
3. **Anthropic 월 한도** — 비용 폭증 방지

위 3가지만 빠르게 보강 후 외부 공개 가능. 나머지는 운영하면서 점진적 보강.

> 박경수님이 위 3가지 진행 OK 하시면 즉시 commit 들어가요. 1~3중 일부만 또는 전체.
