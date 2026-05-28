-- ════════════════════════════════════════════════
-- STEP-CLIENT-TYPE-TAG (박경수님 2026-05-28)
-- clients.client_type 한글 4종으로 통일.
-- 박경수님 환경의 기존 영문 enum(client/vendor/both)은 모두 '거래처'로 매핑.
-- ════════════════════════════════════════════════

-- 1) 기존 영문 값을 한글 '거래처'로 매핑 (NULL 도 포함)
UPDATE public.clients
   SET client_type = '거래처'
 WHERE client_type IS NULL
    OR client_type IN ('client', 'vendor', 'both');

-- 2) 기존 CHECK 제약 (있다면) 제거 후 한글 CHECK 재정의
ALTER TABLE public.clients
  DROP CONSTRAINT IF EXISTS clients_client_type_check;

ALTER TABLE public.clients
  ADD CONSTRAINT clients_client_type_check
    CHECK (client_type IS NULL OR client_type IN ('주관기관', '수혜기관', '참여사', '거래처'));

-- 3) DEFAULT '거래처' 로 변경
ALTER TABLE public.clients
  ALTER COLUMN client_type SET DEFAULT '거래처';

COMMENT ON COLUMN public.clients.client_type IS '기관 유형: 주관기관 | 수혜기관 | 참여사 | 거래처';

-- 4) 검증
SELECT client_type, COUNT(*) FROM public.clients GROUP BY client_type;
