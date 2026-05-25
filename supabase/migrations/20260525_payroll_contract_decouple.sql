-- 박경수님 + SkyClaw PART D — 외주/급여 ↔ 수입/계약 느슨한 연결
-- payroll_expenses.contract_id 가 income_contracts.id 를 참조할 때 CASCADE 가 아닌 SET NULL 로 변경.
-- 계약 삭제 시 외주/급여 행이 함께 사라지거나 잠기는 사고 방지.
-- 박경수님 직접 실행.

-- 1. 기존 FK 제약 제거 (이름 못 찾을 경우 대비 IF EXISTS)
ALTER TABLE payroll_expenses
  DROP CONSTRAINT IF EXISTS payroll_expenses_contract_id_fkey;

-- 2. SET NULL 모드로 재생성
ALTER TABLE payroll_expenses
  ADD CONSTRAINT payroll_expenses_contract_id_fkey
    FOREIGN KEY (contract_id) REFERENCES income_contracts(id)
    ON DELETE SET NULL;

-- 확인
SELECT conname, confdeltype
FROM pg_constraint
WHERE conrelid = 'payroll_expenses'::regclass
  AND conname = 'payroll_expenses_contract_id_fkey';
-- confdeltype 'n' = SET NULL, 'c' = CASCADE, 'a' = NO ACTION (기본)
