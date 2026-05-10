-- bal24 v2 — STEP 15 (CLIENT-PORTAL) 고객 문서 포털 마이그레이션 (재발행)
--
-- 주의: 이 파일은 STEP 15 (commit fcca93a) 작업 시 박경수님이 Supabase Dashboard
-- 에서 직접 실행한 SQL 의 보존본이에요. 이미 DB 에 적용되어 있을 가능성이 높으므로
-- 모든 구문을 IF NOT EXISTS / DROP POLICY IF EXISTS 패턴으로 멱등하게 작성했어요.
--
-- 5 테이블 + 5 RLS + 9 정책

-- ============================================================
-- 1. portal_templates — 포털 템플릿 (재사용용)
-- ============================================================
create table if not exists portal_templates (
  id           uuid primary key default gen_random_uuid(),
  name         text not null,
  description  text,
  stage_hint   text check (stage_hint in
                 ('proposal','contract','operation','closing') or stage_hint is null),
  is_shared    boolean not null default true,
  created_by   uuid references profiles(id),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

-- ============================================================
-- 2. portal_template_items — 템플릿 항목
-- ============================================================
create table if not exists portal_template_items (
  id            uuid primary key default gen_random_uuid(),
  template_id   uuid not null references portal_templates(id) on delete cascade,
  item_type     text not null check (item_type in (
                  'file_download','file_upload','feedback',
                  'approval','auto_data','tax_invoice')),
  label         text not null,
  description   text,
  auto_data_key text check (auto_data_key in
                  ('applications','attendance','curriculum','report') or auto_data_key is null),
  approval_text text,
  required      boolean not null default false,
  sort_order    int not null default 0,
  created_at    timestamptz not null default now()
);

create index if not exists idx_portal_template_items_template
  on portal_template_items (template_id, sort_order);

-- ============================================================
-- 3. project_portals — 실제 포털 (프로젝트별)
-- ============================================================
create table if not exists project_portals (
  id            uuid primary key default gen_random_uuid(),
  project_id    uuid not null references projects(id) on delete cascade,
  template_id   uuid references portal_templates(id) on delete set null,
  portal_token  uuid unique not null default gen_random_uuid(),
  title         text not null,
  message       text,
  stage_tag     text check (stage_tag in
                  ('proposal','contract','operation','closing') or stage_tag is null),
  is_active     boolean not null default true,
  expires_at    timestamptz,
  created_by    uuid references profiles(id),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists idx_project_portals_project on project_portals (project_id);
create index if not exists idx_project_portals_token   on project_portals (portal_token);

-- ============================================================
-- 4. portal_items — 포털 항목 (프로젝트별 인스턴스)
-- ============================================================
create table if not exists portal_items (
  id            uuid primary key default gen_random_uuid(),
  portal_id     uuid not null references project_portals(id) on delete cascade,
  item_type     text not null check (item_type in (
                  'file_download','file_upload','feedback',
                  'approval','auto_data','tax_invoice')),
  label         text not null,
  description   text,
  auto_data_key text check (auto_data_key in
                  ('applications','attendance','curriculum','report') or auto_data_key is null),
  file_url      text,
  file_name     text,
  approval_text text,
  required      boolean not null default false,
  sort_order    int not null default 0,
  completed     boolean not null default false,
  completed_at  timestamptz,
  created_at    timestamptz not null default now()
);

create index if not exists idx_portal_items_portal on portal_items (portal_id, sort_order);

-- ============================================================
-- 5. portal_responses — 고객 회신 (피드백·파일·승인)
-- ============================================================
create table if not exists portal_responses (
  id            uuid primary key default gen_random_uuid(),
  item_id       uuid not null references portal_items(id) on delete cascade,
  response_type text not null check (response_type in ('feedback','file','approval')),
  content       text,
  file_url      text,
  file_name     text,
  file_size     int,
  submitted_at  timestamptz not null default now(),
  submitter_ip  text
);

create index if not exists idx_portal_responses_item on portal_responses (item_id, submitted_at desc);

-- ============================================================
-- RLS 활성화
-- ============================================================
alter table portal_templates      enable row level security;
alter table portal_template_items enable row level security;
alter table project_portals       enable row level security;
alter table portal_items          enable row level security;
alter table portal_responses      enable row level security;

-- ============================================================
-- 정책 — 멱등 적용 (DROP IF EXISTS → CREATE)
-- ============================================================

-- authenticated: 전체 권한
drop policy if exists "auth_all" on portal_templates;
create policy "auth_all" on portal_templates      for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on portal_template_items;
create policy "auth_all" on portal_template_items for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on project_portals;
create policy "auth_all" on project_portals       for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on portal_items;
create policy "auth_all" on portal_items          for all to authenticated using (true) with check (true);

drop policy if exists "auth_all" on portal_responses;
create policy "auth_all" on portal_responses      for all to authenticated using (true) with check (true);

-- anon: 외부 고객 포털용 제한 권한
drop policy if exists "anon_select_portals" on project_portals;
create policy "anon_select_portals"   on project_portals  for select to anon using (is_active = true);

drop policy if exists "anon_select_items" on portal_items;
create policy "anon_select_items"     on portal_items     for select to anon using (true);

drop policy if exists "anon_update_items" on portal_items;
create policy "anon_update_items"     on portal_items     for update to anon using (true) with check (true);

drop policy if exists "anon_insert_responses" on portal_responses;
create policy "anon_insert_responses" on portal_responses for insert to anon with check (true);
