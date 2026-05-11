-- ============================================================
-- bal24 v2 — STEP-CURRICULUM-INVITE-UPLOAD-FIX
-- curriculum_staff: 미등록 인력(staff_pool_id/profile_id 둘 다 null)
-- 케이스 허용 + instructor_name_raw 컬럼으로 이름만 보관
-- ============================================================

-- 1) instructor_name_raw 컬럼 추가
alter table public.curriculum_staff
  add column if not exists instructor_name_raw text;

-- 2) 기존 one-source check 제거 (staff_pool_id XOR profile_id 강제 해제)
alter table public.curriculum_staff
  drop constraint if exists curriculum_staff_one_source;

-- 3) 새 check — 셋(staff_pool_id, profile_id, instructor_name_raw) 중 정확히 1개만 값
alter table public.curriculum_staff
  add constraint curriculum_staff_one_source check (
    (case when staff_pool_id      is not null then 1 else 0 end)
  + (case when profile_id         is not null then 1 else 0 end)
  + (case when instructor_name_raw is not null and length(btrim(instructor_name_raw)) > 0 then 1 else 0 end)
    = 1
  );

-- 4) 미등록 인력 조회용 부분 인덱스
create index if not exists idx_curriculum_staff_manual
  on public.curriculum_staff(curriculum_id)
  where staff_pool_id is null and profile_id is null;

-- 끝.
