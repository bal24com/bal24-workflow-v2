-- bal24 WorkFlow v2 — 프로그램 외부공유 지원기관명 자동 표기 (P1)
-- 박경수님 2026-06-08 — supporter(지원기관) 거래처 FK + 표시용 이름 스냅샷.
--   FK 로 거래처를 연결하되, 외부(anon) 페이지가 clients 테이블을 직접 못 읽으므로
--   선택 시점의 거래처명을 supporter_org_name 에 함께 저장(비정규화)해 헤더에 표기.
-- Supabase SQL Editor 에서 실행. (멱등)

alter table public.program_share
  add column if not exists supporter_client_id uuid references public.clients(id) on delete set null,
  add column if not exists supporter_org_name  text;

comment on column public.program_share.supporter_client_id is '지원기관(거래처) FK — 외부공유 supporter 헤더 표기용';
comment on column public.program_share.supporter_org_name  is '지원기관명 스냅샷 — anon 외부 페이지 표기용 (clients 직접 노출 방지)';
