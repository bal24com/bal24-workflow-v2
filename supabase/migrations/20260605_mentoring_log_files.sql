-- ============================================================
-- bal24 v2 — STEP-MENTORING-LOG-UX
-- mentoring_log_files: 멘토링 일지 첨부 파일 (이미지·문서)
--
-- 의존성: public.mentoring_logs (20260531_mentoring_logs.sql)
-- ============================================================

-- 1) 테이블
create table if not exists public.mentoring_log_files (
  id          uuid primary key default gen_random_uuid(),
  log_id      uuid not null references public.mentoring_logs(id) on delete cascade,
  file_name   text not null,
  file_url    text not null,
  file_type   text not null default 'document' check (file_type in ('image','document')),
  file_size   integer,
  created_at  timestamptz default now(),
  created_by  uuid references auth.users(id)
);

create index if not exists idx_mentoring_log_files_log_id
  on public.mentoring_log_files(log_id);

-- 2) RLS (외부 강사 포털도 anon 토큰으로 접근 — 멘토링 일지 패턴 동일)
alter table public.mentoring_log_files enable row level security;

drop policy if exists "anon_read_mentoring_log_files"   on public.mentoring_log_files;
drop policy if exists "anon_insert_mentoring_log_files" on public.mentoring_log_files;
drop policy if exists "anon_delete_mentoring_log_files" on public.mentoring_log_files;
drop policy if exists "auth_all_mentoring_log_files"    on public.mentoring_log_files;

create policy "anon_read_mentoring_log_files"   on public.mentoring_log_files for select to anon using (true);
create policy "anon_insert_mentoring_log_files" on public.mentoring_log_files for insert to anon with check (true);
create policy "anon_delete_mentoring_log_files" on public.mentoring_log_files for delete to anon using (true);
create policy "auth_all_mentoring_log_files"    on public.mentoring_log_files for all to authenticated using (true) with check (true);


-- 3) Storage 버킷 (mentoring-files, public, 20MB)
insert into storage.buckets (id, name, public, file_size_limit)
  values ('mentoring-files', 'mentoring-files', true, 20971520)
  on conflict (id) do nothing;

-- 4) Storage 정책 (anon·authenticated 모두 업로드 가능 — 강사 포털도 anon)
drop policy if exists "anon_upload_mentoring_files"   on storage.objects;
drop policy if exists "anon_delete_mentoring_files"   on storage.objects;
drop policy if exists "public_read_mentoring_files"   on storage.objects;
drop policy if exists "auth_upload_mentoring_files"   on storage.objects;
drop policy if exists "auth_delete_mentoring_files"   on storage.objects;

create policy "anon_upload_mentoring_files"
  on storage.objects for insert to anon
  with check (bucket_id = 'mentoring-files');

create policy "anon_delete_mentoring_files"
  on storage.objects for delete to anon
  using (bucket_id = 'mentoring-files');

create policy "public_read_mentoring_files"
  on storage.objects for select to public
  using (bucket_id = 'mentoring-files');

create policy "auth_upload_mentoring_files"
  on storage.objects for insert to authenticated
  with check (bucket_id = 'mentoring-files');

create policy "auth_delete_mentoring_files"
  on storage.objects for delete to authenticated
  using (bucket_id = 'mentoring-files');

-- 끝.
