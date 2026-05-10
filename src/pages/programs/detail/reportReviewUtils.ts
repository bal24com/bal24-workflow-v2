// bal24 v2 — STEP-AUDIT-TOKEN-UI · ReportReviewTab 헬퍼
// 감사 토큰 발급 / 링크 복사 / 멘토 배정 — 컴포넌트 외부 추출 (V-1 충족용).

import { supabase } from '../../../lib/supabase';

export interface UtilResult {
  ok: boolean;
  error?: string;
}

/**
 * 감사 토큰 발급 — 이중 발급 방지(`audit_token IS NULL` 가드).
 * 호출자가 setActing / toast / refresh 처리.
 */
export async function generateAuditToken(reportId: string): Promise<UtilResult> {
  const auditToken = crypto.randomUUID(); // HTTPS / 최신 브라우저 (Netlify 환경 OK)
  const { error } = await supabase
    .from('performance_reports')
    .update({ audit_token: auditToken, updated_at: new Date().toISOString() })
    .eq('id', reportId)
    .is('audit_token', null);
  if (error) {
    console.error('[report-review] 감사 의뢰 실패:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}

/** 감사 포털 링크를 OS 클립보드에 복사 (clipboard API). */
export async function copyAuditPortalLink(token: string): Promise<UtilResult> {
  const url = `${window.location.origin}/audit/${token}`;
  try {
    await navigator.clipboard.writeText(url);
    return { ok: true };
  } catch (err) {
    console.error('[report-review] 클립보드 복사 실패:', err instanceof Error ? err.message : '');
    return { ok: false };
  }
}

/** 보고서에 멘토(profiles.id) 배정/해제. */
export async function updateMentorAssignment(
  reportId: string,
  mentorId: string | null,
): Promise<UtilResult> {
  const { error } = await supabase
    .from('performance_reports')
    .update({ mentor_id: mentorId, updated_at: new Date().toISOString() })
    .eq('id', reportId);
  if (error) {
    console.error('[report-review] 멘토 배정 실패:', error.message);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
