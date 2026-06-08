-- bal24 WorkFlow v2 — 프로젝트 외부 포털 anon 접근 수정
-- 박경수님 2026-06-08 — projects 가 로그인 전용(auth.uid() is not null)이라
--   외부인(비로그인)이 /share/{role}/:token 프로젝트 포털을 못 열던 문제 해결.
--   '활성 project_portals 가 있는 사업'에 한해 anon SELECT 허용 (전체 개방 아님).
-- Supabase SQL Editor 실행. (멱등)

drop policy if exists "anon_select_projects_via_portal" on public.projects;
create policy "anon_select_projects_via_portal" on public.projects
  for select to anon
  using (
    exists (
      select 1 from public.project_portals pp
      where pp.project_id = projects.id
        and pp.is_active = true
    )
  );
