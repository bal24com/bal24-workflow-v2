-- ============================================================
-- EVAL-REPORT: 평가 결과 집계 뷰
-- ============================================================
-- 신청자별 평균/최고/최저 점수 + 평가위원 수 + 순위
-- ============================================================

drop view if exists eval_result_summary;

create or replace view eval_result_summary as
select
  pa.id                                       as application_id,
  pa.program_id,
  pa.name                                     as applicant_name,
  pa.status                                   as application_status,
  pa.created_at                               as applied_at,
  coalesce(round(avg(es.score)::numeric, 1), 0) as avg_score,
  coalesce(max(es.score), 0)                  as max_score,
  coalesce(min(es.score), 0)                  as min_score,
  count(distinct es.program_evaluator_id)     as evaluator_count,
  rank() over (
    partition by pa.program_id
    order by coalesce(avg(es.score), 0) desc, pa.created_at asc
  )                                           as rank
from participant_applications pa
left join evaluation_scores es on es.application_id = pa.id
where pa.deleted_at is null
group by pa.id, pa.program_id, pa.name, pa.status, pa.created_at;

-- 뷰는 RLS 자동 상속 (참조 테이블 RLS 따라감) — 별도 정책 불필요.
-- authenticated 권한 부여 (Supabase 기본 anon/authenticated 둘 다 USAGE 보장)
grant select on eval_result_summary to authenticated;
