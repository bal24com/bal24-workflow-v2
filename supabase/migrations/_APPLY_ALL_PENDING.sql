-- ============================================================
-- bal24 v2 — 누적 미적용 마이그레이션 3개 일괄 적용 SQL
-- Supabase Studio → SQL Editor → 전체 복사 후 Run
-- ============================================================
-- 적용 후 이 파일은 삭제하셔도 됩니다 (개별 마이그레이션은 그대로 보관).
-- 모든 ALTER 문은 IF NOT EXISTS / IF EXISTS 가드 사용 — 재실행 안전.
-- ============================================================

-- ─────────────────────────────────────────────
-- 1) STEP-MENTORING-LOG-FORM (20260601)
--    mentoring_logs: 실제 멘토링 일지 양식 필드 추가
-- ─────────────────────────────────────────────
alter table public.mentoring_logs add column if not exists location   text;
alter table public.mentoring_logs add column if not exists start_time text;  -- HH:MM
alter table public.mentoring_logs add column if not exists end_time   text;  -- HH:MM


-- ─────────────────────────────────────────────
-- 2) STEP-STAFF-PORTAL-PIN (20260602)
--    staff_pool.portal_pin: 강사 포털 접속 PIN
-- ─────────────────────────────────────────────
alter table public.staff_pool
  add column if not exists portal_pin text;


-- ─────────────────────────────────────────────
-- 3) STEP-PARTICIPANTS-LIST-UPDATE (20260603)
--    program_participants: '미수료' 상태 + display_order 컬럼
--    ⚠️ 순서 매우 중요: DROP → UPDATE → ADD
-- ─────────────────────────────────────────────

-- 3-1) ⭐ 먼저 status 관련 check constraint 모두 제거
--      (이름이 다른 잠재 constraint까지 안전 제거)
do $$
declare r record;
begin
  for r in
    select conname
    from pg_constraint
    where conrelid = 'public.program_participants'::regclass
      and contype = 'c'
      and pg_get_constraintdef(oid) ilike '%status%'
  loop
    execute format('alter table public.program_participants drop constraint %I', r.conname);
  end loop;
end $$;

-- 3-2) constraint가 없는 상태에서 기존 행 status 값 정규화
--      ・ 과거 한글 상태값 → 영문 변환
--      ・ NULL 또는 알 수 없는 값 → 'pending' (대기)
update public.program_participants set status = 'pending'    where status in ('대기');
update public.program_participants set status = 'active'     where status in ('진행', '진행중');
update public.program_participants set status = 'completed'  where status in ('수료', '완료');
update public.program_participants set status = 'incomplete' where status in ('미수료');
update public.program_participants set status = 'dropped'    where status in ('탈락', '중도탈락');
update public.program_participants set status = 'inactive'   where status in ('비활성');

-- 그 외 알 수 없는 값(NULL 포함) → 'pending'로 안전 처리
update public.program_participants
  set status = 'pending'
  where status is null
     or status not in ('pending','active','completed','incomplete','dropped','inactive');

-- 3-3) 정규화 완료 → 새 constraint 추가
alter table public.program_participants
  add constraint program_participants_status_check
  check (status in ('pending','active','completed','incomplete','dropped','inactive'));

-- 3-4) display_order 컬럼 (사용자 정의 ▲▼ 순서)
alter table public.program_participants
  add column if not exists display_order int default 0;

create index if not exists idx_program_participants_display_order
  on public.program_participants(program_id, display_order);


-- ============================================================
-- 진단 쿼리 (적용 전에 어떤 값이 있는지 확인하고 싶을 때만 사용)
-- ============================================================
-- select status, count(*) from public.program_participants
--   group by status order by count(*) desc;

-- 현재 program_participants에 걸린 모든 check constraint 보기
-- select conname, pg_get_constraintdef(oid)
--   from pg_constraint
--   where conrelid = 'public.program_participants'::regclass
--     and contype = 'c';


-- ============================================================
-- 검증 쿼리 (적용 후 정상 확인용)
-- ============================================================
-- 1) mentoring_logs 컬럼 확인
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='mentoring_logs'
--     and column_name in ('location','start_time','end_time');
--   -- 기대: 3행 반환

-- 2) staff_pool.portal_pin 확인
-- select column_name from information_schema.columns
--   where table_schema='public' and table_name='staff_pool'
--     and column_name = 'portal_pin';
--   -- 기대: 1행 반환

-- 3) program_participants status 허용값
-- select pg_get_constraintdef(oid) from pg_constraint
--   where conname = 'program_participants_status_check';
--   -- 기대: check (status IN ('pending','active','completed','incomplete','dropped','inactive'))

-- 4) display_order 컬럼
-- select column_name, data_type, column_default from information_schema.columns
--   where table_schema='public' and table_name='program_participants'
--     and column_name = 'display_order';
--   -- 기대: 1행 (integer, default 0)

-- 끝.
