-- ============================================================
-- bal24 v2 — STEP-CURRICULUM-ATTEND-SURVEY-FULL
-- 출석 링크/파일, 만족도 응답 저장
-- ============================================================

-- 1. program_curriculum에 출석 관련 컬럼 추가
alter table public.program_curriculum
  add column if not exists attendance_link     text,    -- 구글폼 등 외부 링크
  add column if not exists attendance_file_url text;    -- 출석부 스캔 파일 URL

-- 2. 만족도 조사 응답 저장 테이블
create table if not exists public.satisfaction_surveys (
  id            uuid primary key default gen_random_uuid(),
  program_id    uuid not null references public.programs(id) on delete cascade,
  file_name     text,                                       -- 업로드한 원본 파일명
  file_url      text,                                       -- Storage 저장 경로
  total_count   int  not null default 0,                    -- 총 응답 수
  avg_overall   numeric(3,2),                               -- 전반적 만족도 평균
  summary_json  jsonb not null default '{}',                -- 항목별 평균 집계
  comments      jsonb not null default '[]',                -- 자유서술 배열
  uploaded_at   timestamptz not null default now(),
  uploaded_by   uuid references public.profiles(id)
);

create index if not exists idx_satisfaction_program
  on public.satisfaction_surveys(program_id);

alter table public.satisfaction_surveys enable row level security;

drop policy if exists "satisfaction_authenticated_all" on public.satisfaction_surveys;
create policy "satisfaction_authenticated_all" on public.satisfaction_surveys
  for all to authenticated using (true) with check (true);

-- 끝.
