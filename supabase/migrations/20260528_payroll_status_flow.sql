-- 박경수님 + SkyClaw STEP-PAYROLL-STATUS-FLOW (2026-05-28)
-- 지출 6단계 상태 흐름 — payment_status 한글값 → 영문 6종 + 추적 컬럼 추가
-- 박경수님 직접 실행 (Supabase Dashboard → SQL Editor)
-- ⚠️ 실행 전 백업 권장

-- ============================================================
-- 1) 기존 payment_status 값 영문 마이그레이션
-- ============================================================
-- 매핑:
--   '대기'   → 'submitted'   (PM 이 [지출 요청] 누른 상태, 재무 처리 대기)
--   '완료'   → 'paid'        (지급 완료)
--   '후순위' → 'received'    (수신확인 후 잠시 보류, 의미 가장 가까움)
--   '취소'   → 'cancelled'
-- submitted_at IS NULL 인 행은 '대기' 라도 'draft' (초안) 로 분류

-- 1-1) 기존 CHECK 제약 제거
ALTER TABLE payroll_expenses DROP CONSTRAINT IF EXISTS payroll_expenses_payment_status_check;

-- 1-2) 데이터 마이그레이션 (확정 순서: '취소' → '완료' → '후순위' → 초안 → 나머지(대기))
UPDATE payroll_expenses SET payment_status = 'cancelled' WHERE payment_status = '취소';
UPDATE payroll_expenses SET payment_status = 'paid'      WHERE payment_status = '완료';
UPDATE payroll_expenses SET payment_status = 'received'  WHERE payment_status = '후순위';
UPDATE payroll_expenses SET payment_status = 'draft'     WHERE payment_status = '대기' AND submitted_at IS NULL;
UPDATE payroll_expenses SET payment_status = 'submitted' WHERE payment_status = '대기' AND submitted_at IS NOT NULL;

-- 1-3) 새 CHECK 제약 (영문 6종)
ALTER TABLE payroll_expenses
  ADD CONSTRAINT payroll_expenses_payment_status_check
  CHECK (payment_status IN ('draft','submitted','received','processing','paid','cancelled'));

-- 1-4) 기본값 변경
ALTER TABLE payroll_expenses ALTER COLUMN payment_status SET DEFAULT 'draft';

-- ============================================================
-- 2) 추적 컬럼 추가
-- ============================================================
ALTER TABLE payroll_expenses
  ADD COLUMN IF NOT EXISTS received_at    timestamptz,
  ADD COLUMN IF NOT EXISTS received_by    uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS processing_at  timestamptz,
  ADD COLUMN IF NOT EXISTS processing_by  uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS paid_by        uuid REFERENCES profiles(id),
  ADD COLUMN IF NOT EXISTS cancel_reason  text;
-- 기존 컬럼은 그대로: submitted_at, paid_at

-- ============================================================
-- 3) 검증 쿼리 (수동 실행)
-- ============================================================
-- SELECT payment_status, COUNT(*) FROM payroll_expenses GROUP BY payment_status;
-- → 결과는 draft / submitted / received / processing / paid / cancelled 만 떠야 정상
