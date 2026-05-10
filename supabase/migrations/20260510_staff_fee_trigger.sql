-- bal24 v2 — STEP-STAFF-FEE-DB-TRIGGER 강사료 ↔ 지출 정합성 트리거
--
-- 문제: lib/staffFeeUtils.ts > markStaffFeeAsPaid() 가
--       expenses INSERT 성공 → program_staff_fees UPDATE 실패 시
--       "고아 expense row" 가 발생할 수 있음.
--
-- 해결: DB 트리거로 양방향 정합성을 자동 보장.
--   - expenses INSERT 시 → 해당 staff_fee 의 expense_id 를 자동 연결
--   - expenses soft delete 시 → staff_fee 의 expense_id 를 자동 해제
--
-- 멱등 적용 (DROP TRIGGER IF EXISTS + CREATE OR REPLACE FUNCTION).

-- ============================================================
-- 1. expenses INSERT → staff_fees.expense_id 자동 set
-- ============================================================
create or replace function sync_staff_fee_expense_id()
returns trigger
language plpgsql
as $$
begin
  -- expenses 에 staff_fee_id 가 있으면 해당 staff_fee 의 expense_id 자동 연결
  if new.staff_fee_id is not null then
    update program_staff_fees
    set expense_id = new.id,
        updated_at = now()
    where id = new.staff_fee_id
      and expense_id is null;  -- 이중 업데이트 방지 (앱에서 이미 set 한 경우 skip)
  end if;
  return new;
end;
$$;

drop trigger if exists trg_sync_staff_fee_expense_id on expenses;
create trigger trg_sync_staff_fee_expense_id
  after insert on expenses
  for each row execute function sync_staff_fee_expense_id();

-- ============================================================
-- 2. expenses soft delete → staff_fees.expense_id 자동 해제
-- ============================================================
create or replace function clear_staff_fee_expense_id()
returns trigger
language plpgsql
as $$
begin
  -- deleted_at 이 신규로 설정된 경우(= soft delete)
  if new.deleted_at is not null and old.deleted_at is null then
    update program_staff_fees
    set expense_id = null,
        updated_at = now()
    where expense_id = new.id;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_clear_staff_fee_expense_id on expenses;
create trigger trg_clear_staff_fee_expense_id
  after update on expenses
  for each row execute function clear_staff_fee_expense_id();
