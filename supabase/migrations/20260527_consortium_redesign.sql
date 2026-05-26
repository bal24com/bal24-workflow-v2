-- ============================================================
-- bal24 v2 — STEP-CONSORTIUM-REDESIGN (박경수님 2026-05-27)
-- 컨소시엄 재설계 — 자사 등록·지분율·정산 방향 양방향.
-- 박경수님 명세대로 대부분 컬럼이 이미 존재한다 했으나,
-- 환경별 차이를 흡수하기 위해 IF NOT EXISTS idempotent 로 보강.
-- ============================================================

-- ① clients.is_own_company (자사 여부 boolean)
ALTER TABLE public.clients
  ADD COLUMN IF NOT EXISTS is_own_company BOOLEAN NOT NULL DEFAULT FALSE;

-- ② consortium_members 신규/확장 컬럼
ALTER TABLE public.consortium_members
  ADD COLUMN IF NOT EXISTS share_rate          NUMERIC,
  ADD COLUMN IF NOT EXISTS settlement_direction TEXT DEFAULT 'outbound',
  ADD COLUMN IF NOT EXISTS is_self             BOOLEAN NOT NULL DEFAULT FALSE;

-- settlement_direction 검증 (자유 텍스트지만 권장값 명시)
DO $$ BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_name = 'consortium_members'
       AND constraint_name = 'consortium_members_settlement_direction_check'
  ) THEN
    ALTER TABLE public.consortium_members
      ADD CONSTRAINT consortium_members_settlement_direction_check
      CHECK (settlement_direction IS NULL OR settlement_direction IN ('outbound', 'inbound', 'none'));
  END IF;
END $$;

-- ③ 밸런스닷 자사 행 1개만 idempotent insert
INSERT INTO public.clients (name, client_type, is_own_company, created_at, updated_at)
SELECT '(주)밸런스닷', 'client', TRUE, NOW(), NOW()
 WHERE NOT EXISTS (
   SELECT 1 FROM public.clients WHERE is_own_company = TRUE
 );

-- ④ UNIQUE — 자사는 1행만 보장
CREATE UNIQUE INDEX IF NOT EXISTS clients_is_own_company_unique
  ON public.clients ((is_own_company)) WHERE is_own_company = TRUE;

-- ⑤ 검증 (수동).
-- SELECT id, name, client_type, is_own_company FROM clients WHERE is_own_company = TRUE;
-- SELECT column_name, data_type, column_default FROM information_schema.columns
--  WHERE table_name='consortium_members'
--    AND column_name IN ('share_rate','settlement_direction','is_self','role','budget_amount');
