-- bal24 v2 — STEP-CURRICULUM-FULL
-- 커리큘럼 전면 개편: content + 제안/실제 이중 + 결과보고서 선택 컬럼

-- ============================================================
-- 1. content 컬럼 (없으면 추가)
-- ============================================================
alter table public.program_curriculum
  add column if not exists content text;

-- ============================================================
-- 2. curriculum_type — 제안(planned) / 실제 운영(actual)
--    AI 추출·최초 등록은 'planned', 실제 운영 후 조정본은 'actual'
-- ============================================================
alter table public.program_curriculum
  add column if not exists curriculum_type text not null default 'planned'
    check (curriculum_type in ('planned', 'actual'));

-- ============================================================
-- 3. programs.report_curriculum_type — 결과보고서에서 어느 버전 사용할지
-- ============================================================
alter table public.programs
  add column if not exists report_curriculum_type text not null default 'planned'
    check (report_curriculum_type in ('planned', 'actual'));

-- ============================================================
-- 4. 정렬 인덱스 (program_id + type + session_no)
-- ============================================================
create index if not exists idx_curriculum_type
  on public.program_curriculum(program_id, curriculum_type, session_no);

-- 끝.
