-- ============================================================
-- bal24 v2 — STEP-CONSORTIUM-REDESIGN A안 (박경수님 2026-05-27)
-- ConsortiumRole 명칭 통일 — '주관' / '공동' / '위탁' → '총괄' / '참여' 2종 단순화.
--
-- 매핑.
--   '주관' → '총괄' (운영사, 밸런스닷 등 PM 역할)
--   '공동' / '위탁' → '참여' (참여사 1·2·3...)
--
-- 의뢰기관(주관기관)은 consortiums.lead_client_id 가 따로 보유.
-- ============================================================

-- 기존 enum 사용처가 있을 수 있어 idempotent UPDATE.
UPDATE public.consortium_members
   SET role = '총괄'
 WHERE role = '주관';

UPDATE public.consortium_members
   SET role = '참여'
 WHERE role IN ('공동', '위탁');

-- CHECK 제약 — '총괄' / '참여' 만 허용.
DO $$ BEGIN
  IF EXISTS (
    SELECT 1 FROM information_schema.table_constraints
     WHERE table_name = 'consortium_members'
       AND constraint_name = 'consortium_members_role_check'
  ) THEN
    ALTER TABLE public.consortium_members
      DROP CONSTRAINT consortium_members_role_check;
  END IF;
  ALTER TABLE public.consortium_members
    ADD CONSTRAINT consortium_members_role_check
    CHECK (role IS NULL OR role IN ('총괄', '참여'));
END $$;

-- 검증 (수동).
-- SELECT role, COUNT(*) FROM consortium_members GROUP BY role;
