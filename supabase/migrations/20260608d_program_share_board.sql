-- bal24 WorkFlow v2 — 프로그램 외부공유 공통 게시판
-- 박경수님 2026-06-08 — /share/{role}/:token 외부 페이지에서 모든 역할이 공유하는 게시판.
--   program_id 기준 단일 게시판(공통). anon 읽기/쓰기 허용. Supabase SQL Editor 실행. (멱등)

create table if not exists public.program_share_posts (
  id           uuid primary key default gen_random_uuid(),
  program_id   uuid not null references public.programs(id) on delete cascade,
  author_name  text not null,
  author_role  text not null,          -- 'supporter' | 'beneficiary' | 'team' | 'staff' | 'operator'
  title        text not null,
  content      text not null,
  file_urls    jsonb not null default '[]'::jsonb,  -- [{ url, name }]
  is_notice    boolean not null default false,
  created_at   timestamptz not null default now()
);

create index if not exists idx_psp_program on public.program_share_posts(program_id);

alter table public.program_share_posts enable row level security;

drop policy if exists "anon_all_psp" on public.program_share_posts;
create policy "anon_all_psp" on public.program_share_posts
  for all to anon using (true) with check (true);

drop policy if exists "auth_all_psp" on public.program_share_posts;
create policy "auth_all_psp" on public.program_share_posts
  for all to authenticated using (true) with check (true);

comment on table public.program_share_posts is '프로그램 외부공유 공통 게시판 — 역할 무관 program_id 단위 단일 게시판.';
