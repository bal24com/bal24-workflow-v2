-- ============================================================
--  bal24 WorkFlow v2 — STEP 2 초기 스키마
--  실행: Supabase SQL Editor → New query → 전체 복붙 → Run
--
--  안전: 모든 CREATE는 IF NOT EXISTS, RLS 정책은 DROP IF EXISTS 후 CREATE
--  순서: 사용자 → 거래처 → 인력풀 → 컨소시엄 → 프로젝트 → 태스크
--        → 교육 → 강사초빙 → 교육생 → 정산 → 파일 → 알림 → 활동로그
--        → RLS 정책
-- ============================================================


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-1. 사용자 프로필 (Supabase Auth users 확장)                    │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.profiles (
  id uuid references auth.users primary key,
  email text not null,
  name text not null,
  role text not null check (role in ('ADMIN','PM','MEMBER')),
  department text,
  phone text,
  avatar_url text,
  slogan text,
  is_active boolean default true,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-2. 거래처                                                      │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.clients (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  business_number text,
  representative text,
  address text,
  phone text,
  email text,
  bank_name text,
  bank_account text,
  bank_holder text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-3. 인력풀 (외부 강사)                                          │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.staff_pool (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  phone text,
  email text,
  specialty text[],
  career_summary text,
  portfolio_url text,
  bank_name text,
  bank_account text,
  bank_holder text,
  id_number text,
  note text,
  tags text[],
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-4. 컨소시엄                                                    │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.consortiums (
  id uuid primary key default gen_random_uuid(),
  name text not null,
  description text,
  lead_org text,
  start_date date,
  end_date date,
  total_budget bigint,
  status text default '진행' check (status in ('제안','진행','정산','종료')),
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.consortium_members (
  id uuid primary key default gen_random_uuid(),
  consortium_id uuid references public.consortiums(id) on delete cascade,
  org_name text not null,
  role text,
  budget_ratio numeric,
  budget_amount bigint,
  contact_name text,
  contact_phone text,
  contact_email text,
  access_token text unique default encode(gen_random_bytes(16), 'hex'),
  created_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-5. 프로젝트                                                    │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.projects (
  id uuid primary key default gen_random_uuid(),
  consortium_id uuid references public.consortiums(id),
  client_id uuid references public.clients(id),
  name text not null,
  type text[] default '{}' check (type <@ array['교육','컨설팅','이벤트']),
  status text default '제안' check (status in ('제안','진행','정산','종료')),
  start_date date,
  end_date date,
  budget bigint,
  description text,
  pm_id uuid references public.profiles(id),
  client_access_token text unique default encode(gen_random_bytes(16), 'hex'),  -- STEP 6 거래처 외부 공유용
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.project_members (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  profile_id uuid references public.profiles(id),
  role text,
  created_at timestamptz default now(),
  unique(project_id, profile_id)
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-6. 태스크                                                      │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.tasks (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  title text not null,
  description text,
  status text default '인식' check (status in ('인식','실행','검토','완료')),
  priority text default '보통' check (priority in ('낮음','보통','높음','긴급')),
  assignee_id uuid references public.profiles(id),
  due_date date,
  seq_num serial,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-7. 교육 + 커리큘럼                                             │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.educations (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  name text not null,
  venue text,
  target_audience text,
  max_participants int,
  start_date date,
  end_date date,
  status text default '준비' check (status in ('준비','진행','완료')),
  completion_criteria jsonb default '{"attendance_rate":80,"assignment":true,"survey":true}',
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.curriculum (
  id uuid primary key default gen_random_uuid(),
  education_id uuid references public.educations(id) on delete cascade,
  day_num int not null,
  session_num int not null,
  title text not null,
  content text,
  start_time time,
  end_time time,
  venue text,
  sort_order int,
  created_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-8. 강사 초빙                                                   │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.instructor_invitations (
  id uuid primary key default gen_random_uuid(),
  education_id uuid references public.educations(id) on delete cascade,
  curriculum_id uuid references public.curriculum(id),
  staff_pool_id uuid references public.staff_pool(id),
  profile_id uuid references public.profiles(id),
  name text not null,
  phone text,
  email text,
  status text default '대기' check (status in ('대기','수락','거절','완료')),
  access_token text unique default encode(gen_random_bytes(16), 'hex'),
  invited_at timestamptz default now(),
  responded_at timestamptz,
  lecture_fee bigint,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-9. 교육생 + 출석 + 설문 + 과제                                 │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.students (
  id uuid primary key default gen_random_uuid(),
  education_id uuid references public.educations(id) on delete cascade,
  name text not null,
  phone text,
  email text,
  organization text,
  department text,
  position text,
  access_token text unique default encode(gen_random_bytes(16), 'hex'),
  is_completed boolean default false,
  completion_date date,
  note text,
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);

create table if not exists public.attendance (
  id uuid primary key default gen_random_uuid(),
  student_id uuid references public.students(id) on delete cascade,
  curriculum_id uuid references public.curriculum(id),
  is_present boolean default false,
  checked_at timestamptz,
  note text
);

create table if not exists public.surveys (
  id uuid primary key default gen_random_uuid(),
  education_id uuid references public.educations(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  type text check (type in ('사전','사후')),
  answers jsonb,
  submitted_at timestamptz default now()
);

create table if not exists public.assignments (
  id uuid primary key default gen_random_uuid(),
  education_id uuid references public.educations(id) on delete cascade,
  student_id uuid references public.students(id) on delete cascade,
  title text,
  file_url text,
  submitted_at timestamptz default now(),
  feedback text
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-10. 정산                                                       │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.settlements (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id) on delete cascade,
  category text not null,
  item_name text not null,
  amount bigint not null,
  status text default '미지급' check (status in ('미지급','부분지급','지급완료')),
  paid_amount bigint default 0,
  payment_date date,
  recipient_name text,
  note text,
  created_by uuid references public.profiles(id),
  created_at timestamptz default now(),
  updated_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-11. 파일                                                       │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.files (
  id uuid primary key default gen_random_uuid(),
  project_id uuid references public.projects(id),
  education_id uuid references public.educations(id),
  uploader_id uuid references public.profiles(id),
  file_name text not null,
  file_url text not null,
  file_size bigint,
  file_type text,
  category text,
  created_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-12. 알림                                                       │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.notifications (
  id uuid primary key default gen_random_uuid(),
  recipient_id uuid references public.profiles(id) on delete cascade,
  type text not null,
  title text not null,
  body text,
  link text,
  is_read boolean default false,
  created_at timestamptz default now()
);


-- ┌─────────────────────────────────────────────────────────────────┐
-- │ 2-13. 활동 로그                                                  │
-- └─────────────────────────────────────────────────────────────────┘
create table if not exists public.activity_logs (
  id uuid primary key default gen_random_uuid(),
  actor_id uuid references public.profiles(id),
  actor_name text,
  action text not null,
  target_type text,
  target_id uuid,
  target_name text,
  detail jsonb,
  created_at timestamptz default now()
);


-- ============================================================
--  2-14. RLS 정책
-- ============================================================

-- 인증 사용자만 접근하는 테이블
alter table public.profiles enable row level security;
alter table public.projects enable row level security;
alter table public.educations enable row level security;
alter table public.tasks enable row level security;
alter table public.settlements enable row level security;
alter table public.notifications enable row level security;
alter table public.activity_logs enable row level security;

-- profiles: 본인 및 같은 팀 열람
drop policy if exists "profiles_select" on public.profiles;
create policy "profiles_select" on public.profiles
  for select using (auth.uid() is not null);

drop policy if exists "profiles_update" on public.profiles;
create policy "profiles_update" on public.profiles
  for update using (auth.uid() = id);

drop policy if exists "profiles_insert" on public.profiles;
create policy "profiles_insert" on public.profiles
  for insert with check (auth.uid() = id);

-- projects: 인증 사용자 전체 (PM/ADMIN 권한은 앱 레벨 처리)
drop policy if exists "projects_select" on public.projects;
create policy "projects_select" on public.projects
  for select using (auth.uid() is not null);

drop policy if exists "projects_insert" on public.projects;
create policy "projects_insert" on public.projects
  for insert with check (auth.uid() is not null);

drop policy if exists "projects_update" on public.projects;
create policy "projects_update" on public.projects
  for update using (auth.uid() is not null);

-- educations·tasks·settlements: 인증 사용자 전체
drop policy if exists "educations_all" on public.educations;
create policy "educations_all" on public.educations
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "tasks_all" on public.tasks;
create policy "tasks_all" on public.tasks
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "settlements_all" on public.settlements;
create policy "settlements_all" on public.settlements
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- notifications: 본인 것만
drop policy if exists "notifications_select" on public.notifications;
create policy "notifications_select" on public.notifications
  for select using (auth.uid() = recipient_id);

drop policy if exists "notifications_update" on public.notifications;
create policy "notifications_update" on public.notifications
  for update using (auth.uid() = recipient_id);

-- activity_logs: 인증 사용자 열람 + 시스템 insert
drop policy if exists "activity_logs_select" on public.activity_logs;
create policy "activity_logs_select" on public.activity_logs
  for select using (auth.uid() is not null);

drop policy if exists "activity_logs_insert" on public.activity_logs;
create policy "activity_logs_insert" on public.activity_logs
  for insert with check (auth.uid() is not null);

-- ─── 외부 접근 테이블: anon이 토큰으로 직접 조회·수정 (로그인 X) ───
alter table public.students enable row level security;
alter table public.instructor_invitations enable row level security;
alter table public.consortium_members enable row level security;
alter table public.attendance enable row level security;
alter table public.surveys enable row level security;
alter table public.assignments enable row level security;
alter table public.curriculum enable row level security;

-- students: 토큰 매칭은 앱 레벨에서 처리 (RLS는 anon SELECT/UPDATE 허용)
drop policy if exists "students_anon_select" on public.students;
create policy "students_anon_select" on public.students for select using (true);

drop policy if exists "students_anon_update" on public.students;
create policy "students_anon_update" on public.students for update using (true);

drop policy if exists "students_auth_insert" on public.students;
create policy "students_auth_insert" on public.students for insert with check (auth.uid() is not null);

-- instructor_invitations: 강사가 토큰으로 조회·수정
drop policy if exists "invitations_anon_select" on public.instructor_invitations;
create policy "invitations_anon_select" on public.instructor_invitations for select using (true);

drop policy if exists "invitations_anon_update" on public.instructor_invitations;
create policy "invitations_anon_update" on public.instructor_invitations for update using (true);

drop policy if exists "invitations_auth_insert" on public.instructor_invitations;
create policy "invitations_auth_insert" on public.instructor_invitations for insert with check (auth.uid() is not null);

-- consortium_members: 협력기관이 토큰으로 조회
drop policy if exists "consortium_members_anon_select" on public.consortium_members;
create policy "consortium_members_anon_select" on public.consortium_members for select using (true);

drop policy if exists "consortium_members_auth_write" on public.consortium_members;
create policy "consortium_members_auth_write" on public.consortium_members
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- attendance·surveys·assignments: anon SELECT + INSERT (교육생 제출)
drop policy if exists "attendance_anon_all" on public.attendance;
create policy "attendance_anon_all" on public.attendance for all using (true) with check (true);

drop policy if exists "surveys_anon_all" on public.surveys;
create policy "surveys_anon_all" on public.surveys for all using (true) with check (true);

drop policy if exists "assignments_anon_all" on public.assignments;
create policy "assignments_anon_all" on public.assignments for all using (true) with check (true);

-- curriculum: 외부 페이지에서 강사·학생이 차시 조회
drop policy if exists "curriculum_anon_select" on public.curriculum;
create policy "curriculum_anon_select" on public.curriculum for select using (true);

drop policy if exists "curriculum_auth_write" on public.curriculum;
create policy "curriculum_auth_write" on public.curriculum
  for all using (auth.uid() is not null) with check (auth.uid() is not null);

-- 그 외 테이블 (clients, staff_pool, consortiums, project_members, files):
-- 인증 사용자 전체 접근 (RLS 활성화 + all policy)
alter table public.clients enable row level security;
alter table public.staff_pool enable row level security;
alter table public.consortiums enable row level security;
alter table public.project_members enable row level security;
alter table public.files enable row level security;

drop policy if exists "clients_all" on public.clients;
create policy "clients_all" on public.clients for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "staff_pool_all" on public.staff_pool;
create policy "staff_pool_all" on public.staff_pool for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "consortiums_all" on public.consortiums;
create policy "consortiums_all" on public.consortiums for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "project_members_all" on public.project_members;
create policy "project_members_all" on public.project_members for all using (auth.uid() is not null) with check (auth.uid() is not null);

drop policy if exists "files_all" on public.files;
create policy "files_all" on public.files for all using (auth.uid() is not null) with check (auth.uid() is not null);


-- ============================================================
--  적용 확인 — 14개 테이블 카운트
-- ============================================================
select
  (select count(*) from public.profiles) as profiles,
  (select count(*) from public.clients) as clients,
  (select count(*) from public.staff_pool) as staff_pool,
  (select count(*) from public.consortiums) as consortiums,
  (select count(*) from public.consortium_members) as consortium_members,
  (select count(*) from public.projects) as projects,
  (select count(*) from public.project_members) as project_members,
  (select count(*) from public.tasks) as tasks,
  (select count(*) from public.educations) as educations,
  (select count(*) from public.curriculum) as curriculum,
  (select count(*) from public.instructor_invitations) as instructor_invitations,
  (select count(*) from public.students) as students,
  (select count(*) from public.attendance) as attendance,
  (select count(*) from public.surveys) as surveys,
  (select count(*) from public.assignments) as assignments,
  (select count(*) from public.settlements) as settlements,
  (select count(*) from public.files) as files,
  (select count(*) from public.notifications) as notifications,
  (select count(*) from public.activity_logs) as activity_logs;
