-- ============================================================
-- Supabase Storage 버킷 생성 및 RLS 정책 설정
-- STEP: STORAGE-BUCKET-SETUP
-- ============================================================

-- 1. 버킷 생성
-- ============================================================

-- (1) 프로젝트·프로그램 일반 파일 첨부
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'project-files',
  'project-files',
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

-- (2) 지원금 지출 증빙서류 (사업자등록증·통장사본·검수조서 등)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'grant-documents',
  'grant-documents',
  false,
  20971520,  -- 20MB
  array[
    'application/pdf',
    'image/jpeg', 'image/png', 'image/webp'
  ]
)
on conflict (id) do nothing;

-- (3) 사업실적보고서 첨부파일 (완료보고 관련)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'report-attachments',
  'report-attachments',
  false,
  52428800,  -- 50MB
  array[
    'application/pdf',
    'application/msword',
    'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
    'application/vnd.ms-excel',
    'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
    'image/jpeg', 'image/png', 'image/webp', 'image/gif'
  ]
)
on conflict (id) do nothing;

-- (4) 멘토링 일지 사진 첨부
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'activity-logs',
  'activity-logs',
  false,
  10485760,  -- 10MB
  array['image/jpeg', 'image/png', 'image/webp', 'image/gif']
)
on conflict (id) do nothing;

-- (5) 회계감사 리포트
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'audit-reports',
  'audit-reports',
  false,
  20971520,  -- 20MB
  array['application/pdf']
)
on conflict (id) do nothing;

-- (6) 프로필 아바타 (공개)
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'avatars',
  'avatars',
  true,
  5242880,  -- 5MB
  array['image/jpeg', 'image/png', 'image/webp']
)
on conflict (id) do nothing;


-- 2. RLS 정책 설정 (DROP IF EXISTS 로 멱등 실행 보장)
-- ============================================================

-- ── project-files ──────────────────────────────────────────
drop policy if exists "project_files_insert" on storage.objects;
drop policy if exists "project_files_select" on storage.objects;
drop policy if exists "project_files_update" on storage.objects;
drop policy if exists "project_files_delete" on storage.objects;

create policy "project_files_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'project-files');

create policy "project_files_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'project-files');

create policy "project_files_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'project-files' and auth.uid() = owner);

create policy "project_files_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'project-files' and auth.uid() = owner);


-- ── grant-documents ────────────────────────────────────────
drop policy if exists "grant_documents_insert"      on storage.objects;
drop policy if exists "grant_documents_select"      on storage.objects;
drop policy if exists "grant_documents_update"      on storage.objects;
drop policy if exists "grant_documents_delete"      on storage.objects;
drop policy if exists "grant_documents_anon_select" on storage.objects;

create policy "grant_documents_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'grant-documents');

create policy "grant_documents_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'grant-documents');

create policy "grant_documents_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'grant-documents' and auth.uid() = owner);

create policy "grant_documents_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'grant-documents' and auth.uid() = owner);

-- 비인증(anon) 접근 허용 — 회계사무소 토큰 포털에서 파일 열람
create policy "grant_documents_anon_select"
  on storage.objects for select
  to anon
  using (bucket_id = 'grant-documents');


-- ── report-attachments ─────────────────────────────────────
drop policy if exists "report_attachments_insert"      on storage.objects;
drop policy if exists "report_attachments_select"      on storage.objects;
drop policy if exists "report_attachments_anon_select" on storage.objects;
drop policy if exists "report_attachments_update"      on storage.objects;
drop policy if exists "report_attachments_delete"      on storage.objects;

create policy "report_attachments_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'report-attachments');

create policy "report_attachments_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'report-attachments');

-- 비인증(anon) 접근 허용 — 수혜기업 포털·회계 포털 파일 열람
create policy "report_attachments_anon_select"
  on storage.objects for select
  to anon
  using (bucket_id = 'report-attachments');

create policy "report_attachments_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'report-attachments' and auth.uid() = owner);

create policy "report_attachments_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'report-attachments' and auth.uid() = owner);


-- ── activity-logs ──────────────────────────────────────────
drop policy if exists "activity_logs_insert" on storage.objects;
drop policy if exists "activity_logs_select" on storage.objects;
drop policy if exists "activity_logs_update" on storage.objects;
drop policy if exists "activity_logs_delete" on storage.objects;

create policy "activity_logs_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'activity-logs');

create policy "activity_logs_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'activity-logs');

create policy "activity_logs_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'activity-logs' and auth.uid() = owner);

create policy "activity_logs_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'activity-logs' and auth.uid() = owner);


-- ── audit-reports ──────────────────────────────────────────
drop policy if exists "audit_reports_insert"      on storage.objects;
drop policy if exists "audit_reports_select"      on storage.objects;
drop policy if exists "audit_reports_anon_select" on storage.objects;
drop policy if exists "audit_reports_anon_insert" on storage.objects;
drop policy if exists "audit_reports_update"      on storage.objects;
drop policy if exists "audit_reports_delete"      on storage.objects;

create policy "audit_reports_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'audit-reports');

create policy "audit_reports_select"
  on storage.objects for select
  to authenticated
  using (bucket_id = 'audit-reports');

-- 비인증(anon) 접근 허용 — 회계사무소 토큰 포털 업로드 후 열람
create policy "audit_reports_anon_select"
  on storage.objects for select
  to anon
  using (bucket_id = 'audit-reports');

create policy "audit_reports_anon_insert"
  on storage.objects for insert
  to anon
  with check (bucket_id = 'audit-reports');

create policy "audit_reports_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'audit-reports' and auth.uid() = owner);

create policy "audit_reports_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'audit-reports' and auth.uid() = owner);


-- ── avatars (공개) ─────────────────────────────────────────
drop policy if exists "avatars_insert" on storage.objects;
drop policy if exists "avatars_select" on storage.objects;
drop policy if exists "avatars_update" on storage.objects;
drop policy if exists "avatars_delete" on storage.objects;

create policy "avatars_insert"
  on storage.objects for insert
  to authenticated
  with check (bucket_id = 'avatars');

create policy "avatars_select"
  on storage.objects for select
  to public
  using (bucket_id = 'avatars');

create policy "avatars_update"
  on storage.objects for update
  to authenticated
  using (bucket_id = 'avatars' and auth.uid() = owner);

create policy "avatars_delete"
  on storage.objects for delete
  to authenticated
  using (bucket_id = 'avatars' and auth.uid() = owner);
