-- bal24 WorkFlow v2 — STEP 18
-- profiles 테이블 확장: 5종 role + 추가 컬럼 (position·joined_at)
-- 박경수님이 Supabase Dashboard 에서 이미 실행한 SQL 의 사후 보존본.

-- 1) role CHECK 제약 변경 (3종 → 6종, 기존 'MEMBER' 호환)
alter table public.profiles drop constraint if exists profiles_role_check;
alter table public.profiles add constraint profiles_role_check
  check (role in ('ADMIN','PM','STAFF','FINANCE','PARTNER','MEMBER'));

-- 2) profiles 누락 컬럼 추가 (5/7 이미 존재 — position/joined_at 만 신규)
alter table public.profiles
  add column if not exists department  text,
  add column if not exists position    text,
  add column if not exists phone       text,
  add column if not exists avatar_url  text,
  add column if not exists is_active   boolean not null default true,
  add column if not exists joined_at   date,
  add column if not exists slogan      text;

-- 3) 인덱스
create index if not exists idx_profiles_role on public.profiles(role);
create index if not exists idx_profiles_is_active on public.profiles(is_active);

comment on column public.profiles.role is 'ADMIN/PM/STAFF/FINANCE/PARTNER/MEMBER — 한 사람이 단일 role (복수 role 필요 시 별도 테이블).';
comment on column public.profiles.position is '직책 (예: 매니저·팀장·이사).';
comment on column public.profiles.joined_at is '입사일.';
