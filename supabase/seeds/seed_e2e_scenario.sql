-- 영업~정산 E2E 시드 — 시나리오 1 (진행중) + 시나리오 2 (종료)
-- ============================================================
-- 전제. reset_business_data.sql 선행 실행. profiles 1건 이상 존재.
-- 사용. Supabase SQL Editor 에서 직접 실행.
-- ============================================================

DO $$
DECLARE
  v_admin_id uuid;

  -- 시나리오 1 ID
  v_client1     uuid := gen_random_uuid();
  v_consortium1 uuid := gen_random_uuid();
  v_member1a    uuid := gen_random_uuid();
  v_member1b    uuid := gen_random_uuid();
  v_member1c    uuid := gen_random_uuid();
  v_project1    uuid := gen_random_uuid();
  v_program1a   uuid := gen_random_uuid();
  v_program1b   uuid := gen_random_uuid();

  -- 시나리오 2 ID
  v_client2     uuid := gen_random_uuid();
  v_consortium2 uuid := gen_random_uuid();
  v_member2a    uuid := gen_random_uuid();
  v_member2b    uuid := gen_random_uuid();
  v_project2    uuid := gen_random_uuid();
  v_program2    uuid := gen_random_uuid();
BEGIN
  SELECT id INTO v_admin_id FROM profiles ORDER BY created_at LIMIT 1;

  -- ============================================================
  -- 시나리오 1 — 진행중 (아리랑굿거리, 12억, 2026-03-27 ~ 2027-01-23)
  -- ============================================================

  INSERT INTO clients (id, name, client_type, created_by)
  VALUES (v_client1, '클라이언트_테스트_진도군청', 'client', v_admin_id);

  INSERT INTO consortiums (id, name, lead_org, status,
                            start_date, end_date, total_budget, created_by)
  VALUES (v_consortium1, '컨소시엄_테스트_아리랑굿거리', '밸런스닷', '진행',
          '2026-03-27', '2027-01-23', 1200000000, v_admin_id);

  INSERT INTO consortium_members (id, consortium_id, org_name, role,
                                   budget_ratio, budget_amount, access_token)
  VALUES
    (v_member1a, v_consortium1, '밸런스닷',   '주관', 50, 600000000, encode(gen_random_bytes(16),'hex')),
    (v_member1b, v_consortium1, '맥스컴퍼니', '공동', 30, 360000000, encode(gen_random_bytes(16),'hex')),
    (v_member1c, v_consortium1, '라온하제',   '공동', 20, 240000000, encode(gen_random_bytes(16),'hex'));

  INSERT INTO projects (id, consortium_id, client_id, name, type, status,
                         start_date, end_date, budget, pm_id,
                         client_access_token, our_role, created_by)
  VALUES (v_project1, v_consortium1, v_client1,
          '프로젝트_테스트_아리랑굿거리활성화',
          ARRAY['이벤트']::text[], '진행',
          '2026-03-27', '2027-01-23', 1200000000, v_admin_id,
          encode(gen_random_bytes(16),'hex'), 'operator', v_admin_id);

  INSERT INTO programs (id, project_id, consortium_id, name, type, status,
                         start_date, end_date, capacity, description, created_by)
  VALUES
    (v_program1a, v_project1, v_consortium1,
     '프로그램_테스트_문화예술시장운영', '교육', '진행',
     '2026-04-01', '2026-12-30', 30,
     '문화예술시장 활성화 교육형 프로그램', v_admin_id),
    (v_program1b, v_project1, v_consortium1,
     '프로그램_테스트_굿센터체험', '행사', '진행',
     '2026-06-01', '2026-11-30', 100,
     '굿센터 이벤트형 체험 프로그램', v_admin_id);

  INSERT INTO tasks (id, project_id, title, description, status, priority,
                      assignee_id, start_date, due_date, seq_num, created_by)
  VALUES
    (gen_random_uuid(), v_project1, '착수보고서 작성',          '진도군청 제출용 착수보고서 작성',          '실행', '높음', v_admin_id, '2026-03-28', '2026-04-10', 1, v_admin_id),
    (gen_random_uuid(), v_project1, '강사 섭외',                 '문화예술시장운영 강사 5명 섭외',           '인식', '보통', v_admin_id, '2026-04-01', '2026-05-15', 2, v_admin_id),
    (gen_random_uuid(), v_project1, '굿센터체험 행사 기획안',    '시나리오·동선·MC 섭외 포함 기획안',        '인식', '보통', v_admin_id, '2026-04-15', '2026-05-30', 3, v_admin_id),
    (gen_random_uuid(), v_project1, '진행 인력 배치표',          '운영요원·MC·기술스탭 배치 확정',           '인식', '낮음', v_admin_id, '2026-05-01', '2026-06-15', 4, v_admin_id);

  INSERT INTO income (id, ledger_type, project_id, consortium_id, client_id,
                       account_code, description, amount, income_date, status,
                       received_at, created_by)
  VALUES (gen_random_uuid(), 'consortium', v_project1, v_consortium1, v_client1,
          '4100', '1차 계약금 입금', 600000000,
          '2026-04-05', '입금완료', '2026-04-05', v_admin_id);

  INSERT INTO expenses (id, ledger_type, project_id, consortium_id,
                         account_code, description, gross_amount, withholding_type,
                         expense_date, status, created_by)
  VALUES
    (gen_random_uuid(), 'consortium', v_project1, v_consortium1,
     '5100', '기획비',           5000000, 'none',          '2026-04-10', '출금완료', v_admin_id),
    (gen_random_uuid(), 'consortium', v_project1, v_consortium1,
     '5200', '강사료 1차 지급분', 3300000, 'business_3_3', '2026-05-20', '출금완료', v_admin_id);

  INSERT INTO program_staff_fees (id, program_id, expert_id, profile_id, fee_type,
                                    description, input_mode, unit_price, quantity,
                                    gross_amount, tax_type, tax_amount, net_amount,
                                    payment_status, created_by)
  VALUES
    (gen_random_uuid(), v_program1b, NULL, v_admin_id, 'facilitation',
     '굿센터체험 운영 진행', 'total', 0, 1, 800000, '면세', 0, 800000,
     '미지급', v_admin_id);

  INSERT INTO grant_expenditures (id, project_id, program_id, item_name, account_code,
                                    expenditure_date, amount, fund_type,
                                    vendor_name, vendor_biz_reg_no, status, created_by)
  VALUES (gen_random_uuid(), v_project1, v_program1a,
          '교육교재 인쇄비', '5300',
          '2026-04-15', 1500000, 'grant',
          '시드_인쇄소_부광인쇄', '123-45-67890', 'submitted', v_admin_id);

  INSERT INTO activity_logs (id, program_id, project_id, log_type, title,
                              activity_date, start_time, end_time, duration_hours,
                              location, attendee_count, content, created_by)
  VALUES (gen_random_uuid(), v_program1a, v_project1, 'mentoring',
          '문화예술시장 1차 멘토링', '2026-04-20',
          '14:00:00', '17:00:00', 3,
          '진도군청 대회의실', 12,
          '예술시장 운영 노하우 공유 및 부스 배치 1차 검토', v_admin_id);

  INSERT INTO performance_reports (id, project_id, program_id, status,
                                     company_name, rep_name, manager_name,
                                     total_budget, grant_budget, self_budget,
                                     business_summary)
  VALUES (gen_random_uuid(), v_project1, v_program1a, 'draft',
          '밸런스닷', '시드_대표', '시드_담당자',
          1200000000, 1200000000, 0,
          '아리랑굿거리 활성화 사업 — 문화예술시장 운영 + 굿센터 체험 행사 1차 추진 현황');

  -- ============================================================
  -- 시나리오 2 — 종료 (광주관광상품공모전, 5천만, 2025-07-01 ~ 2025-12-31)
  -- ============================================================

  INSERT INTO clients (id, name, client_type, created_by)
  VALUES (v_client2, '클라이언트_테스트_광주광역시', 'client', v_admin_id);

  INSERT INTO consortiums (id, name, lead_org, status,
                            start_date, end_date, total_budget, created_by)
  VALUES (v_consortium2, '컨소시엄_테스트_광주관광활성화', '밸런스닷', '완료',
          '2025-07-01', '2025-12-31', 50000000, v_admin_id);

  INSERT INTO consortium_members (id, consortium_id, org_name, role,
                                   budget_ratio, budget_amount, access_token)
  VALUES
    (v_member2a, v_consortium2, '밸런스닷', '주관', 60, 30000000, encode(gen_random_bytes(16),'hex')),
    (v_member2b, v_consortium2, '고디자인', '공동', 40, 20000000, encode(gen_random_bytes(16),'hex'));

  INSERT INTO projects (id, consortium_id, client_id, name, type, status,
                         start_date, end_date, budget, pm_id,
                         client_access_token, our_role, created_by)
  VALUES (v_project2, v_consortium2, v_client2,
          '프로젝트_테스트_광주관광상품공모전',
          ARRAY['이벤트']::text[], '종료',
          '2025-07-01', '2025-12-31', 50000000, v_admin_id,
          encode(gen_random_bytes(16),'hex'), 'operator', v_admin_id);

  INSERT INTO programs (id, project_id, consortium_id, name, type, status,
                         start_date, end_date, capacity, description, created_by)
  VALUES (v_program2, v_project2, v_consortium2,
          '프로그램_테스트_관광상품개발오리엔테이션', '교육', '완료',
          '2025-08-01', '2025-08-15', 40,
          '광주 관광상품 공모전 참가자 대상 OT', v_admin_id);

  INSERT INTO tasks (id, project_id, title, description, status, priority,
                      assignee_id, start_date, due_date, seq_num, created_by)
  VALUES
    (gen_random_uuid(), v_project2, '공모전 모집 공고 게시', '광주광역시 홈페이지·SNS 모집 공고 등록', '완료', '높음', v_admin_id, '2025-07-05', '2025-07-15', 1, v_admin_id),
    (gen_random_uuid(), v_project2, '심사위원 위촉 및 평가', '5인 심사위원 위촉 + 본선 평가 진행',     '완료', '높음', v_admin_id, '2025-09-01', '2025-10-31', 2, v_admin_id);

  INSERT INTO income (id, ledger_type, project_id, consortium_id, client_id,
                       account_code, description, amount, income_date, status,
                       received_at, created_by)
  VALUES (gen_random_uuid(), 'consortium', v_project2, v_consortium2, v_client2,
          '4100', '최종 정산금 입금', 50000000,
          '2025-12-20', '입금완료', '2025-12-20', v_admin_id);

  INSERT INTO expenses (id, ledger_type, project_id, consortium_id,
                         account_code, description, gross_amount, withholding_type,
                         expense_date, status, created_by)
  VALUES
    (gen_random_uuid(), 'consortium', v_project2, v_consortium2,
     '5100', 'OT 운영비',     2000000, 'none',          '2025-08-15', '출금완료', v_admin_id),
    (gen_random_uuid(), 'consortium', v_project2, v_consortium2,
     '5200', '심사위원 수당', 1100000, 'business_3_3', '2025-10-31', '출금완료', v_admin_id);

  INSERT INTO program_staff_fees (id, program_id, expert_id, profile_id, fee_type,
                                    description, input_mode, unit_price, quantity,
                                    gross_amount, tax_type, tax_amount, net_amount,
                                    payment_status, paid_at, created_by)
  VALUES (gen_random_uuid(), v_program2, NULL, v_admin_id, 'education',
          '관광상품 OT 강의', 'total', 0, 1, 500000, '3.3', 16500, 483500,
          '지급완료', '2025-08-20', v_admin_id);

  INSERT INTO performance_reports (id, project_id, program_id, status,
                                     company_name, rep_name, manager_name,
                                     total_budget, grant_budget, self_budget,
                                     total_executed, grant_executed, self_executed,
                                     business_summary, achievement_notes,
                                     submitted_at, pm_reviewed_by, pm_reviewed_at, pm_comment)
  VALUES (gen_random_uuid(), v_project2, v_program2, 'approved',
          '밸런스닷', '시드_대표', '시드_담당자',
          50000000, 50000000, 0,
          50000000, 50000000, 0,
          '광주관광상품공모전 — 모집·OT·심사 전 단계 완료',
          '본선 진출 12개팀 / 수상 3개팀 / OT 만족도 4.6점',
          '2025-12-25T09:00:00+09:00', v_admin_id, '2025-12-30T11:00:00+09:00',
          '계획 대비 100% 집행 완료. 차년도 연계 추진 권장.');

  RAISE NOTICE 'E2E 시드 완료. 시나리오 1 project_id=%, 시나리오 2 project_id=%', v_project1, v_project2;
END $$;
