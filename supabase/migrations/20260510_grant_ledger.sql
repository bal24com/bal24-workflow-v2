-- ============================================================
-- GRANT-LEDGER: 지원금 원장 + 지출증빙 테이블
-- ============================================================

-- 1. 지원금 원장 (배정/집행/반환/조정 이력)
create table if not exists grant_ledger (
  id             uuid primary key default gen_random_uuid(),
  project_id     uuid not null references projects(id) on delete cascade,
  program_id     uuid references programs(id) on delete set null,
  ledger_type    text not null
                   check (ledger_type in ('allocated','disbursed','returned','adjusted')),
  amount         numeric(15,2) not null,
  description    text,
  ledger_date    date not null,
  created_by     uuid references profiles(id),
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now()
);

create index if not exists idx_grant_ledger_project on grant_ledger(project_id);
create index if not exists idx_grant_ledger_program on grant_ledger(program_id);
create index if not exists idx_grant_ledger_type    on grant_ledger(ledger_type);

-- 2. 지출증빙 (건별 지출 + 거래처 + 증빙서류)
create table if not exists grant_expenditures (
  id                  uuid primary key default gen_random_uuid(),
  project_id          uuid not null references projects(id) on delete cascade,
  program_id          uuid references programs(id) on delete set null,
  grant_ledger_id     uuid references grant_ledger(id) on delete set null,

  -- 지출 기본
  item_name           text not null,
  account_code        text,
  expenditure_date    date not null,
  amount              numeric(15,2) not null,
  fund_type           text not null default 'grant'
                        check (fund_type in ('grant','self')),  -- 지원금/자부담

  -- 거래처 정보
  vendor_name         text,
  vendor_biz_reg_no   text,
  vendor_rep_name     text,
  vendor_address      text,

  -- 증빙서류 Storage URL
  receipt_url         text,
  biz_reg_url         text,
  bank_copy_url       text,
  inspection_url      text,
  contract_url        text,
  quote_url           text,

  -- 서류 완결 상태
  docs_submitted      boolean not null default false,
  docs_verified_at    timestamptz,
  docs_verified_by    uuid references profiles(id),

  -- 검수 상태
  status              text not null default 'submitted'
                        check (status in ('submitted','approved','rejected')),
  reject_reason       text,
  notes               text,

  created_by          uuid references profiles(id),
  created_at          timestamptz not null default now(),
  updated_at          timestamptz not null default now()
);

create index if not exists idx_grant_exp_project on grant_expenditures(project_id);
create index if not exists idx_grant_exp_program on grant_expenditures(program_id);
create index if not exists idx_grant_exp_status  on grant_expenditures(status);
create index if not exists idx_grant_exp_docs    on grant_expenditures(docs_submitted);

-- 3. docs_submitted 자동 갱신 트리거
create or replace function fn_grant_exp_docs_submitted()
returns trigger language plpgsql as $$
begin
  new.docs_submitted := (
    new.biz_reg_url    is not null and
    new.bank_copy_url  is not null and
    new.inspection_url is not null
  );
  return new;
end;
$$;

drop trigger if exists trg_grant_exp_docs_submitted on grant_expenditures;
create trigger trg_grant_exp_docs_submitted
  before insert or update on grant_expenditures
  for each row execute function fn_grant_exp_docs_submitted();

-- 4. RLS
alter table grant_ledger       enable row level security;
alter table grant_expenditures enable row level security;

drop policy if exists "grant_ledger_select" on grant_ledger;
drop policy if exists "grant_ledger_insert" on grant_ledger;
drop policy if exists "grant_ledger_update" on grant_ledger;

create policy "grant_ledger_select" on grant_ledger
  for select to authenticated using (true);
create policy "grant_ledger_insert" on grant_ledger
  for insert to authenticated with check (true);
create policy "grant_ledger_update" on grant_ledger
  for update to authenticated using (true);

drop policy if exists "grant_exp_select" on grant_expenditures;
drop policy if exists "grant_exp_insert" on grant_expenditures;
drop policy if exists "grant_exp_update" on grant_expenditures;

create policy "grant_exp_select" on grant_expenditures
  for select to authenticated using (true);
create policy "grant_exp_insert" on grant_expenditures
  for insert to authenticated with check (true);
create policy "grant_exp_update" on grant_expenditures
  for update to authenticated using (true);
