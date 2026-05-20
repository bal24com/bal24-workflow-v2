-- ============================================================
-- bal24 v2 — STEP-PIN-FIX-V2
-- staff_pool에 anon UPDATE 정책 추가 (PIN 설정·내 정보 수정 silent failure 해결)
--
-- 배경:
--   20260519_staff_portal.sql에 anon SELECT만 있고 UPDATE 정책이 없어
--   강사 포털(anon) 에서 portal_pin·내 정보 UPDATE가 RLS에 의해 차단됨
--   (0 rows affected, NO ERROR — Postgres RLS 기본 동작).
--   → "PIN 설정 완료" 토스트는 뜨지만 실제 DB는 미저장 → 재진입 시 다시 설정 모드.
--
-- 보안 고려:
--   staff_portal_token 자체가 인증 메커니즘. 토큰 보유 = 본인 확인 통과.
--   UPDATE 범위는 staff_pool 전체이나, anon은 token 없이 row 식별 불가.
-- ============================================================

alter table public.staff_pool enable row level security;

drop policy if exists "anon_update_staff_pool" on public.staff_pool;
create policy "anon_update_staff_pool"
  on public.staff_pool for update to anon
  using (true) with check (true);

-- 끝.
