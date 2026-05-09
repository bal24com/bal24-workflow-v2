-- bal24 v2 — STEP-MYPAGE 마이그레이션 (2026-05-09)
-- /my/:token 참여자 마이페이지를 위한 컬럼 2개 추가.
-- ⚠️ Supabase Dashboard 에서 이미 실행 완료. 본 파일은 보존용.

-- ============================================================
-- 1. profiles.my_token — 개인 마이페이지 접근 토큰
-- ============================================================
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS my_token TEXT UNIQUE DEFAULT gen_random_uuid()::text;

UPDATE profiles
SET my_token = gen_random_uuid()::text
WHERE my_token IS NULL;

CREATE INDEX IF NOT EXISTS idx_profiles_my_token ON profiles(my_token);

-- ============================================================
-- 2. programs.entry_code — 프로그램별 입장코드 (선택적)
-- NULL = 코드 없음 (토큰만으로 입장)
-- 값 있음 = 입장 시 코드 입력 필요
-- ============================================================
ALTER TABLE programs
  ADD COLUMN IF NOT EXISTS entry_code TEXT;
