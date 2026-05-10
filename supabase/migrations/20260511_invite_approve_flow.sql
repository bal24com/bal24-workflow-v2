-- bal24 v2 — STEP-INVITE-APPROVE-PART1
-- 강사 초대 2단계 승인 구조: 상태 확장 + role 매핑 + curriculum_staff 자동 INSERT trigger

-- ============================================================
-- 1. 기존 '완료' 데이터 정규화
--    v2 InvitationStatus enum에 있던 '완료'는 어디서도 SET 되지 않음
--    혹시 남아있다면 '수락'으로 통합 (보존적 마이그레이션)
-- ============================================================
update public.instructor_invitations
   set status = '수락'
 where status = '완료';

-- ============================================================
-- 2. instructor_invitations.status CHECK 확장
--    추가: '제출' (강사 제출 완료, 담당자 승인 대기)
--    추가: '교체됨' (관리자가 교체 처리)
-- ============================================================
alter table public.instructor_invitations
  drop constraint if exists instructor_invitations_status_check;

alter table public.instructor_invitations
  add constraint instructor_invitations_status_check
  check (status in ('대기','제출','수락','거절','교체됨'));

-- ============================================================
-- 3. role 컬럼 보장 + 인덱스
--    InvitationRole 영문 enum: 'instructor'|'ta'|'mentor'|'facilitator'
-- ============================================================
alter table public.instructor_invitations
  add column if not exists role text default 'instructor';

create index if not exists idx_instructor_invitations_status
  on public.instructor_invitations(status);

-- ============================================================
-- 4. curriculum_staff 중복 INSERT 방지 partial unique index
--    (curriculum_id, 인력, role) 단위로 한 번만 등록
-- ============================================================
create unique index if not exists curriculum_staff_unique_external
  on public.curriculum_staff (curriculum_id, staff_pool_id, role)
  where staff_pool_id is not null;

create unique index if not exists curriculum_staff_unique_internal
  on public.curriculum_staff (curriculum_id, profile_id, role)
  where profile_id is not null;

-- ============================================================
-- 5. invitation.role(영문) → curriculum_staff.role(한글) 매핑 함수
--    curriculum_staff.role CHECK = ('강사','FT','멘토','TA','운영진')
-- ============================================================
create or replace function public.map_invitation_role_to_staff(invitation_role text)
returns text language sql immutable as $$
  select case invitation_role
    when 'instructor'  then '강사'
    when 'ta'          then 'TA'
    when 'mentor'      then '멘토'
    when 'facilitator' then '운영진'
    else '강사'
  end;
$$;

-- ============================================================
-- 6. status='수락' 변경 시 curriculum_staff 자동 INSERT trigger
-- ============================================================
create or replace function public.sync_curriculum_staff_on_approve()
returns trigger
language plpgsql
security definer
as $$
declare
  v_role text;
  v_xor  boolean;
begin
  -- '수락'으로 변경되었고, curriculum_id가 있고, staff_pool_id ↔ profile_id XOR 충족 시에만 동작
  v_xor := (new.staff_pool_id is not null) <> (new.profile_id is not null);
  if new.status = '수락'
     and (old.status is distinct from '수락')
     and new.curriculum_id is not null
     and v_xor
  then
    v_role := public.map_invitation_role_to_staff(new.role);
    insert into public.curriculum_staff (
      curriculum_id, staff_pool_id, profile_id, role, status, responded_at, created_at
    ) values (
      new.curriculum_id, new.staff_pool_id, new.profile_id, v_role,
      '수락', coalesce(new.responded_at, now()), now()
    )
    on conflict do nothing;
  end if;
  return new;
end;
$$;

drop trigger if exists trg_curriculum_staff_on_approve on public.instructor_invitations;
create trigger trg_curriculum_staff_on_approve
  after update of status on public.instructor_invitations
  for each row
  execute function public.sync_curriculum_staff_on_approve();

-- ============================================================
-- 7. 기존 '수락' 데이터 backfill
--    trigger 설치 이전에 수락 처리된 invitation도 curriculum_staff에 동기화
-- ============================================================
insert into public.curriculum_staff (
  curriculum_id, staff_pool_id, profile_id, role, status, responded_at, created_at
)
select
  i.curriculum_id, i.staff_pool_id, i.profile_id,
  public.map_invitation_role_to_staff(i.role),
  '수락',
  coalesce(i.responded_at, i.updated_at, i.invited_at),
  coalesce(i.responded_at, i.updated_at, i.invited_at)
from public.instructor_invitations i
where i.status = '수락'
  and i.curriculum_id is not null
  and ((i.staff_pool_id is not null) <> (i.profile_id is not null))
on conflict do nothing;

-- 끝.
