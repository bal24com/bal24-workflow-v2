-- bal24 WorkFlow v2 — 컨소시엄 포털 보안 강화 (토큰 검증 RPC)
-- 박경수님 2026-06-08 — 직전 마이그레이션의 anon 전체 읽기 정책을 제거하고,
--   토큰을 검증해 해당 컨소시엄 데이터만 반환하는 SECURITY DEFINER 함수로 교체.
-- Supabase SQL Editor 에서 그대로 실행. (멱등 — 여러 번 실행 안전)

-- ============================================================
-- 1. 직전에 열어둔 광범위 anon 읽기 정책 회수
-- ============================================================
drop policy if exists "anon_read_consortiums"        on public.consortiums;
drop policy if exists "anon_read_consortium_members" on public.consortium_members;
drop policy if exists "anon_read_tasks"              on public.tasks;
-- consortium_links 도 anon 직접 읽기 차단 (토큰 열거 방지). RPC 가 definer 로 대신 읽음.
drop policy if exists "anon_read_by_token"           on public.consortium_links;

-- ============================================================
-- 2. 토큰 검증 + 역할별 데이터 반환 RPC
--    - 유효한 토큰이 아니면 null 반환 (외부인은 아무것도 못 봄)
--    - 역할별로 민감 섹션(재무·참여사·태스크)을 서버에서 필터
-- ============================================================
create or replace function public.get_consortium_portal(p_token text, p_role text)
returns jsonb
language plpgsql
security definer
set search_path = public
as $$
declare
  v_cid uuid;
  v_show_finance boolean;
  v_show_members boolean;
  v_show_tasks   boolean;
  v_result jsonb;
begin
  -- 토큰·역할·활성·만료 검증
  select consortium_id into v_cid
  from public.consortium_links
  where token = p_token
    and link_type = p_role
    and is_active = true
    and (expires_at is null or expires_at > now())
  limit 1;

  if v_cid is null then
    return null;
  end if;

  -- 역할별 노출 섹션 (서버측 강제)
  v_show_finance := (p_role = 'supporter');
  v_show_members := (p_role in ('supporter','beneficiary'));
  v_show_tasks   := (p_role in ('supporter','beneficiary','team'));

  select jsonb_build_object(
    'consortium', (
      select jsonb_build_object(
        'id', c.id,
        'name', c.name,
        'status', c.status,
        'start_date', c.start_date,
        'end_date', c.end_date,
        'total_budget', case when v_show_finance then c.total_budget else null end,
        'description', c.description,
        'lead_client_name', (select cl.name from public.clients cl where cl.id = c.lead_client_id)
      )
      from public.consortiums c
      where c.id = v_cid and c.deleted_at is null
    ),
    'members', case when v_show_members then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', m.id,
        'member_type', m.member_type,
        'client_name', (select cl.name from public.clients cl where cl.id = m.client_id),
        'allocated_budget', case when v_show_finance then m.allocated_budget else null end
      )), '[]'::jsonb)
      from public.consortium_members m
      where m.consortium_id = v_cid
    ) else '[]'::jsonb end,
    'programs', (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', p.id,
        'name', p.name,
        'type', p.type,
        'status', p.status,
        'start_date', p.start_date,
        'end_date', p.end_date
      ) order by p.start_date), '[]'::jsonb)
      from public.programs p
      where p.consortium_id = v_cid and p.deleted_at is null
    ),
    'tasks', case when v_show_tasks then (
      select coalesce(jsonb_agg(jsonb_build_object(
        'id', t.id,
        'title', t.title,
        'status', t.status,
        'due_date', t.due_date
      ) order by t.due_date), '[]'::jsonb)
      from public.tasks t
      where t.consortium_id = v_cid
    ) else '[]'::jsonb end
  ) into v_result;

  -- 클릭수 카운트 (실패해도 무시)
  update public.consortium_links
    set click_count = click_count + 1, updated_at = now()
  where token = p_token and link_type = p_role;

  return v_result;
end;
$$;

-- 비로그인(anon) 도 호출 가능하게 실행 권한 부여
grant execute on function public.get_consortium_portal(text, text) to anon, authenticated;

comment on function public.get_consortium_portal(text, text) is
  '컨소시엄 외부 포털 — 토큰·역할 검증 후 해당 컨소시엄 데이터만 반환. 재무/참여사/태스크는 역할별로 서버에서 필터.';
