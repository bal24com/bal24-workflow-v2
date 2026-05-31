// 박경수님 2026-05-29 STEP-PORTAL-EXPIRY — 외부 토큰 만료 정책 공용 유틸.
// 프로젝트가 '종료' 상태이면 그 프로젝트의 모든 외부 포털 토큰 만료로 판정.
// 관리자 확인 후 수동 재활성화 가능 (project.status 를 '진행' 등으로 되돌리면 자동 풀림).

import { supabase } from './supabase';

/** 프로젝트 ID 로 종료 상태 여부 확인. */
export async function isProjectExpired(projectId: string | null | undefined): Promise<boolean> {
  if (!projectId) return false;
  const { data, error } = await supabase
    .from('projects')
    .select('status')
    .eq('id', projectId)
    .maybeSingle();
  if (error) {
    console.warn('[portalExpiry] projects.status 조회 실패:', error.message);
    return false;  // 안전 — 만료 미판정 시 통과 (false positive 방지)
  }
  const status = (data?.status ?? '') as string;
  // 박경수님 매뉴얼 — 프로젝트 상태 4종 (제안·진행·정산·종료). '종료' 만 만료.
  return status === '종료';
}

/** 만료 안내 메시지 (외부 페이지에서 공통 사용). */
export const PORTAL_EXPIRED_MESSAGE =
  '이 링크는 프로젝트가 종료되어 만료됐어요. 관리자에게 문의해 주세요.';
