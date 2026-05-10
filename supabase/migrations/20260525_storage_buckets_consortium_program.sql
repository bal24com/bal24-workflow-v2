-- 컨소시엄·프로그램 파일 탭용 누락 버킷 + RLS 정책 보강
-- ============================================================
-- 배경. 20260510_storage_buckets.sql 에서 6개 버킷만 생성했지만
-- SharedFilesTab 코드는 consortium-files, program-files 도 사용.
-- 두 버킷이 없으면 "Bucket not found" → 업로드 실패.
-- ============================================================

-- 1. 버킷 생성
-- ============================================================

-- (1) 컨소시엄 공용 파일
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'consortium-files',
  'consortium-files',
  false,
  52428800,  -- 50MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do nothing;

-- (2) 프로그램 공용 파일
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'program-files',
  'program-files',
  false,
  52428800,  -- 50MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'application/vnd.ms-powerpoint',
    'application/vnd.openxmlformats-officedocument.presentationml.presentation',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif',
    'text/plain', 'text/csv'
  ]
)
on conflict (id) do nothing;


-- 2. RLS 정책 (DROP IF EXISTS 로 멱등 실행 보장)
-- ============================================================

-- ── consortium-files ───────────────────────────────────────
drop policy if exists "consortium_files_insert" on storage.objects;
drop policy if exists "consortium_files_select" on storage.objects;
drop policy if exists "consortium_files_update" on storage.objects;
drop policy if exists "consortium_files_delete" on storage.objects;

create policy "consortium_files_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'consortium-files');

create policy "consortium_files_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'consortium-files');

create policy "consortium_files_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'consortium-files' and auth.uid() = owner);

create policy "consortium_files_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'consortium-files' and auth.uid() = owner);


-- ── program-files ──────────────────────────────────────────
drop policy if exists "program_files_insert" on storage.objects;
drop policy if exists "program_files_select" on storage.objects;
drop policy if exists "program_files_update" on storage.objects;
drop policy if exists "program_files_delete" on storage.objects;

create policy "program_files_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'program-files');

create policy "program_files_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'program-files');

create policy "program_files_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'program-files' and auth.uid() = owner);

create policy "program_files_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'program-files' and auth.uid() = owner);
