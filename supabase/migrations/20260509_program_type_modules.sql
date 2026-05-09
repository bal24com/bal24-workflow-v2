-- ============================================================
-- STEP-PROGRAM-TYPE: 프로그램 유형 시스템
-- 실행 대상: Supabase SQL Editor (박경수님 직접 실행)
-- ============================================================

-- ============================================================
-- 1. programs 테이블 — 3개 컬럼 추가
-- ============================================================
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS program_type TEXT DEFAULT '기타'
    CHECK (program_type IN (
      '교육','멘토링','행사','체험','마켓','마케팅',
      '납품','기획','모집','이동','보고','조사·연구','기타'
    )),
  ADD COLUMN IF NOT EXISTS display_order INT DEFAULT 0,
  ADD COLUMN IF NOT EXISTS modules JSONB;  -- 템플릿 참조 후 실제 모듈 목록 캐시

-- 기존 레코드 백필: type이 있는 경우 program_type으로 복사, 없으면 '기타'
UPDATE programs
SET program_type = CASE
  WHEN type = '교육' THEN '교육'
  WHEN type = '멘토링' THEN '멘토링'
  WHEN type = '행사' THEN '행사'
  ELSE '기타'
END
WHERE program_type = '기타';

-- ============================================================
-- 2. program_templates 테이블 신규 생성
-- ============================================================
CREATE TABLE IF NOT EXISTS program_templates (
  id           UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  name         TEXT NOT NULL,
  base_type    TEXT NOT NULL CHECK (base_type IN (
    '교육','멘토링','행사','체험','마켓','마케팅',
    '납품','기획','모집','이동','보고','조사·연구','기타'
  )),
  description  TEXT,
  modules      JSONB NOT NULL DEFAULT '[]',
  is_system    BOOLEAN DEFAULT false,  -- true: 시스템 기본 (ADMIN만 삭제 가능)
  created_by   UUID REFERENCES profiles(id) ON DELETE SET NULL,
  created_at   TIMESTAMPTZ DEFAULT now(),
  updated_at   TIMESTAMPTZ DEFAULT now()
);

-- 인덱스
CREATE INDEX IF NOT EXISTS idx_program_templates_base_type
  ON program_templates(base_type);
CREATE INDEX IF NOT EXISTS idx_program_templates_is_system
  ON program_templates(is_system);

-- RLS
ALTER TABLE program_templates ENABLE ROW LEVEL SECURITY;

-- 인증된 사용자: 전체 조회 가능
DROP POLICY IF EXISTS "authenticated_read" ON program_templates;
CREATE POLICY "authenticated_read" ON program_templates
  FOR SELECT TO authenticated USING (true);

-- 시스템 템플릿: ADMIN만 수정/삭제
DROP POLICY IF EXISTS "admin_manage_system" ON program_templates;
CREATE POLICY "admin_manage_system" ON program_templates
  FOR ALL TO authenticated
  USING (
    is_system = false
    OR (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'ADMIN'
  )
  WITH CHECK (
    is_system = false
    OR (SELECT raw_user_meta_data->>'role' FROM auth.users WHERE id = auth.uid()) = 'ADMIN'
  );

-- PM/STAFF: 커스텀 템플릿 생성 가능
DROP POLICY IF EXISTS "pm_create_custom" ON program_templates;
CREATE POLICY "pm_create_custom" ON program_templates
  FOR INSERT TO authenticated
  WITH CHECK (is_system = false);

-- 본인이 만든 커스텀 템플릿: 수정·삭제 가능
DROP POLICY IF EXISTS "owner_manage_custom" ON program_templates;
CREATE POLICY "owner_manage_custom" ON program_templates
  FOR ALL TO authenticated
  USING (created_by = auth.uid() AND is_system = false)
  WITH CHECK (created_by = auth.uid() AND is_system = false);

-- ============================================================
-- 3. 시스템 기본 템플릿 11개 INSERT
-- ============================================================
INSERT INTO program_templates (name, base_type, description, modules, is_system) VALUES
  ('교육 기본형', '교육', '강사·출석·만족도 중심 표준 교육',
   '["curriculum","staff","attendance","survey","report","files"]', true),
  ('창업교육 복합형', '교육', '모집부터 멘토링까지 전 단계 창업교육',
   '["recruitment","curriculum","staff","attendance","mentoring","survey","report","files"]', true),
  ('창업교육 견학형', '교육', '국내 견학·경진대회 포함 창업교육',
   '["recruitment","curriculum","mentoring","domestic_travel","event_schedule","report","files"]', true),
  ('멘토링 기본형', '멘토링', '1:1 멘토링 세션·제출물 관리',
   '["mentoring","attendance","report","files"]', true),
  ('행사 단독형', '행사', '일정·홍보·체크리스트 중심 행사',
   '["event_schedule","promotion","checklist","files"]', true),
  ('문화예술시장형', '마켓', '셀러·부스·행사 운영 복합 마켓',
   '["seller","booth","checklist","event_schedule","files","report"]', true),
  ('납품·기획형', '납품', '산출물 버전관리 및 발주처 승인',
   '["deliverable","approval","files"]', true),
  ('SNS·마케팅형', '마케팅', '콘텐츠 계획·SNS 운영 실적 관리',
   '["content_plan","sns","files","report"]', true),
  ('해외연수형', '이동', '항공·국내외 이동 포함 연수',
   '["curriculum","domestic_travel","flight","overseas_travel","report","files"]', true),
  ('타당성조사형', '조사·연구', '환경분석→타당성검토→납품 보고서 구조',
   '["environment_analysis","demand_survey","feasibility","deliverable","report","files"]', true),
  ('사업운영·현장관리형', '기획', '주민참여·현장관리·콘텐츠 복합 사업운영',
   '["environment_analysis","demand_survey","community_participation","field_management","curriculum","sns","report","files"]', true)
ON CONFLICT DO NOTHING;
