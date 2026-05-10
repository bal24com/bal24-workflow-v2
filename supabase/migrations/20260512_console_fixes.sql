-- ============================================================
-- bal24 v2 — 콘솔 에러 일괄 fix
--   1) files.program_id 컬럼 추가 (program detail 파일 탭 fkColumn)
--   2) report_sections RLS authenticated 정책
--   3) satisfaction_surveys.ai_analysis 컬럼 (AI 분석 결과 저장)
--   4) program_curriculum 누락 컬럼 안전망
-- ============================================================

-- 1. files 테이블에 program_id 추가 (SharedFilesTab program detail에서 사용)
alter table public.files
  add column if not exists program_id uuid references public.programs(id) on delete cascade;

create index if not exists idx_files_program_id
  on public.files(program_id) where program_id is not null;

-- 2. report_sections RLS 누락 → authenticated_all 정책
do $$
begin
  if exists (select 1 from information_schema.tables where table_name = 'report_sections') then
    execute 'alter table public.report_sections enable row level security';
    execute 'drop policy if exists "report_sections_authenticated_all" on public.report_sections';
    execute 'create policy "report_sections_authenticated_all" on public.report_sections for all to authenticated using (true) with check (true)';
  end if;
end $$;

-- 3. 만족도 분석에 AI 결과 저장 컬럼
alter table public.satisfaction_surveys
  add column if not exists ai_per_question  jsonb not null default '{}',  -- 항목별 AI 분석
  add column if not exists ai_overall       text,                          -- 전체 인사이트 요약
  add column if not exists ai_analyzed_at   timestamptz;

-- 4. program_curriculum 누락 컬럼 안전망 (이전 마이그레이션 미적용 케이스)
alter table public.program_curriculum
  add column if not exists content              text,
  add column if not exists instructor_name_raw  text,
  add column if not exists day_label            text,
  add column if not exists start_time           time,
  add column if not exists end_time             time,
  add column if not exists attendance_link      text,
  add column if not exists attendance_file_url  text;

alter table public.program_curriculum
  add column if not exists curriculum_type text not null default 'planned'
    check (curriculum_type in ('planned','actual'));

alter table public.programs
  add column if not exists report_curriculum_type text not null default 'planned'
    check (report_curriculum_type in ('planned','actual'));

create index if not exists idx_curriculum_type
  on public.program_curriculum(program_id, curriculum_type, session_no);

-- 끝.
