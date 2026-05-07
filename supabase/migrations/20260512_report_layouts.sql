-- bal24 WorkFlow v2 — STEP 20
-- report_layouts 테이블 — 사용자별 재무 리포트 항목 커스터마이징
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.

create table if not exists public.report_layouts (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references public.profiles(id) on delete cascade,
  ledger_type text not null check (ledger_type in ('own','consortium')),
  layout      jsonb not null default '[]',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, ledger_type)
);

alter table public.report_layouts enable row level security;

drop policy if exists "own_report_layouts" on public.report_layouts;
create policy "own_report_layouts"
  on public.report_layouts
  for all
  to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

comment on table public.report_layouts is '사용자별 재무 리포트 항목 표시·순서 (KPI/차트/목록 7종 key 기반).';
comment on column public.report_layouts.layout is 'jsonb 배열 — [{key,visible,order}]. DEFAULT_LAYOUT 7항목 또는 사용자 커스터마이징.';
