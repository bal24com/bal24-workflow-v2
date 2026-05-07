-- bal24 WorkFlow v2 — 커리큘럼 템플릿 (Stage 3-C, 재활용 모음)
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.
-- V2 portal_templates + portal_template_items 패턴과 일관 (정규화 2 테이블).

-- ============================================================
-- 1. curriculum_templates
-- ============================================================
create table if not exists public.curriculum_templates (
  id          uuid primary key default gen_random_uuid(),
  name        text not null,
  description text,
  created_by  uuid references public.profiles(id),
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);
create index if not exists idx_curriculum_templates_created_at
  on public.curriculum_templates(created_at desc);

alter table public.curriculum_templates enable row level security;
drop policy if exists "auth_all" on public.curriculum_templates;
create policy "auth_all" on public.curriculum_templates
  for all to authenticated using (true) with check (true);

-- ============================================================
-- 2. curriculum_template_items
-- ============================================================
create table if not exists public.curriculum_template_items (
  id          uuid primary key default gen_random_uuid(),
  template_id uuid not null references public.curriculum_templates(id) on delete cascade,
  session_no  integer not null,
  title       text not null,
  content     text,
  duration    integer,
  start_time  time,
  end_time    time,
  venue       text,
  created_at  timestamptz not null default now(),
  unique (template_id, session_no)
);
create index if not exists idx_curriculum_template_items_template_id
  on public.curriculum_template_items(template_id);

alter table public.curriculum_template_items enable row level security;
drop policy if exists "auth_all" on public.curriculum_template_items;
create policy "auth_all" on public.curriculum_template_items
  for all to authenticated using (true) with check (true);
