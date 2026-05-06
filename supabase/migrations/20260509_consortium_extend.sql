-- bal24 WorkFlow v2 — STEP 11
-- 컨소시엄 확장: lead_client_id / project_id, 새 status 4종, 멤버 정규화, files.consortium_id

-- ───────────────────────────────────────────────
-- 1) consortiums: FK 컬럼 추가
-- ───────────────────────────────────────────────
alter table public.consortiums
  add column if not exists project_id uuid references public.projects(id) on delete set null,
  add column if not exists lead_client_id uuid references public.clients(id) on delete set null;

comment on column public.consortiums.project_id is '연결 프로젝트 (선택)';
comment on column public.consortiums.lead_client_id is '주관사 (clients FK). 기존 lead_org text는 레거시로 유지.';

-- 2) consortiums status 4종으로 재정의
--    기존 '제안/진행/정산/종료' → '구성중/진행/완료/해산' 매핑
update public.consortiums set status = '구성중' where status = '제안';
update public.consortiums set status = '완료'   where status = '종료';
update public.consortiums set status = '진행'   where status = '정산';

alter table public.consortiums drop constraint if exists consortiums_status_check;
alter table public.consortiums
  add constraint consortiums_status_check check (status in ('구성중','진행','완료','해산'));
alter table public.consortiums alter column status set default '구성중';

-- 3) consortiums RLS
alter table public.consortiums enable row level security;
drop policy if exists "consortiums_select_authenticated" on public.consortiums;
create policy "consortiums_select_authenticated" on public.consortiums for select to authenticated using (true);
drop policy if exists "consortiums_insert_authenticated" on public.consortiums;
create policy "consortiums_insert_authenticated" on public.consortiums for insert to authenticated with check (true);
drop policy if exists "consortiums_update_authenticated" on public.consortiums;
create policy "consortiums_update_authenticated" on public.consortiums for update to authenticated using (true) with check (true);
drop policy if exists "consortiums_delete_authenticated" on public.consortiums;
create policy "consortiums_delete_authenticated" on public.consortiums for delete to authenticated using (true);


-- ───────────────────────────────────────────────
-- 4) consortium_members: FK + 책임/역할
-- ───────────────────────────────────────────────
alter table public.consortium_members
  add column if not exists client_id uuid references public.clients(id) on delete set null,
  add column if not exists responsibilities text;

-- role check 추가 (null 허용). budget_ratio는 지분율(%)로 재사용.
alter table public.consortium_members drop constraint if exists consortium_members_role_check;
alter table public.consortium_members
  add constraint consortium_members_role_check
  check (role is null or role in ('주관','공동','위탁'));

create index if not exists idx_consortium_members_consortium_id on public.consortium_members(consortium_id);
create index if not exists idx_consortium_members_client_id on public.consortium_members(client_id);

comment on column public.consortium_members.client_id is '참여사 (clients FK). 등록되지 않은 외부 조직이면 org_name만 사용.';
comment on column public.consortium_members.responsibilities is '담당 업무 / 역할 상세';
comment on column public.consortium_members.budget_ratio is '지분율 (%). 0~100 범위 권장.';

alter table public.consortium_members enable row level security;
drop policy if exists "consortium_members_select_authenticated" on public.consortium_members;
create policy "consortium_members_select_authenticated" on public.consortium_members for select to authenticated using (true);
drop policy if exists "consortium_members_insert_authenticated" on public.consortium_members;
create policy "consortium_members_insert_authenticated" on public.consortium_members for insert to authenticated with check (true);
drop policy if exists "consortium_members_update_authenticated" on public.consortium_members;
create policy "consortium_members_update_authenticated" on public.consortium_members for update to authenticated using (true) with check (true);
drop policy if exists "consortium_members_delete_authenticated" on public.consortium_members;
create policy "consortium_members_delete_authenticated" on public.consortium_members for delete to authenticated using (true);


-- ───────────────────────────────────────────────
-- 5) files: 컨소시엄 파일 지원
-- ───────────────────────────────────────────────
alter table public.files
  add column if not exists consortium_id uuid references public.consortiums(id) on delete cascade;

create index if not exists idx_files_consortium_id on public.files(consortium_id);
comment on column public.files.consortium_id is '컨소시엄 파일 (Storage: consortium-files 버킷)';

alter table public.files enable row level security;
drop policy if exists "files_select_authenticated" on public.files;
create policy "files_select_authenticated" on public.files for select to authenticated using (true);
drop policy if exists "files_insert_authenticated" on public.files;
create policy "files_insert_authenticated" on public.files for insert to authenticated with check (true);
drop policy if exists "files_delete_authenticated" on public.files;
create policy "files_delete_authenticated" on public.files for delete to authenticated using (true);
