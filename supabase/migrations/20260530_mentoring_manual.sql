-- ============================================================
-- bal24 v2 — STEP-MENTORING-FULL
-- mentoring_assignments: 미등록 멘토 직접 입력 + 초대 토큰 지원
-- ============================================================

-- 1) 미등록 멘토 이름 (mentor_pool_id / mentor_profile_id 둘 다 null일 때 사용)
alter table public.mentoring_assignments
  add column if not exists mentor_name_raw text;

-- 2) 외부 멘토 초대용 토큰 (등록 안 된 멘토에게 발송)
alter table public.mentoring_assignments
  add column if not exists mentor_invite_token uuid default gen_random_uuid();

-- 3) 인덱스 (초대 토큰 조회 빠르게)
create index if not exists idx_mentoring_assignments_invite_token
  on public.mentoring_assignments(mentor_invite_token);

-- 끝.
