-- 업무 데이터 초기화 SQL — profiles·auth·storage·staff_pool 보존
-- ============================================================
-- 사용. Supabase SQL Editor 에서 직접 실행. 멱등 가능.
-- 박경수님 명세의 performance_reports 는 실제 테이블명 project_reports.
-- ============================================================

BEGIN;

TRUNCATE TABLE
  portal_responses,
  portal_items,
  project_portals,
  attendance_records,
  attendance_sessions,
  grant_expenditures,
  receipts,
  expenses,
  income,
  program_staff_fees,
  project_reports,
  activity_logs,
  tasks,
  member_requests,
  programs,
  consortium_members,
  consortiums,
  projects,
  clients
RESTART IDENTITY CASCADE;

COMMIT;
