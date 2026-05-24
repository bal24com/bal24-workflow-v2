// bal24 v2 — STEP-MEMBER-ORPHAN-CLEANUP
// 고아 계정 정리 헬퍼 (Edge Function 호출 wrapper + 한글 에러 변환).

import { supabase } from '../../lib/supabase';

export interface CleanupResult {
  success: boolean;
  foundCount: number;
  deletedCount: number;
  errors: Array<{ email: string; error: string }>;
  dryRun?: boolean;
  orphans?: Array<{ id: string; email: string; created_at: string }>;
  errorMsg?: string;
}

interface RawResponse {
  success?: boolean;
  foundCount?: number;
  deletedCount?: number;
  errors?: Array<{ email: string; error: string }>;
  dryRun?: boolean;
  orphans?: Array<{ id: string; email: string; created_at: string }>;
  error?: string;
}

/** 고아 계정 정리 호출. targetEmail 지정 시 그 이메일만, 비우면 전체. */
export async function cleanupOrphans(opts: {
  targetEmail?: string;
  dryRun?: boolean;
} = {}): Promise<CleanupResult> {
  const { data, error } = await supabase.functions.invoke<RawResponse>('cleanup-orphans', {
    body: {
      targetEmail: opts.targetEmail?.trim() || undefined,
      dryRun: opts.dryRun === true,
    },
  });

  if (error) {
    const e = error as { message?: string; context?: { json?: () => Promise<RawResponse> } };
    let serverMsg = '';
    try {
      const j = await e.context?.json?.();
      serverMsg = j?.error ?? '';
    } catch { /* noop */ }
    const raw = serverMsg || e.message || '';
    console.error('[memberCleanup] invoke 실패:', raw);
    return {
      success: false, foundCount: 0, deletedCount: 0, errors: [],
      errorMsg: translateCleanupError(raw),
    };
  }
  if (data?.error) {
    console.error('[memberCleanup] 함수 반환 오류:', data.error);
    return {
      success: false, foundCount: 0, deletedCount: 0, errors: [],
      errorMsg: translateCleanupError(data.error),
    };
  }
  return {
    success: !!data?.success,
    foundCount: data?.foundCount ?? 0,
    deletedCount: data?.deletedCount ?? 0,
    errors: data?.errors ?? [],
    dryRun: data?.dryRun,
    orphans: data?.orphans,
  };
}

function translateCleanupError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('failed to send') || m.includes('failed to fetch') || m.includes('not found') || m.includes('404')) {
    return 'cleanup-orphans Edge Function이 배포되지 않았어요. 관리자에게 배포를 요청해 주세요.';
  }
  if (m.includes('unauthorized') || m.includes('401') || m.includes('403')) {
    return '권한이 없어요. ADMIN 계정으로 로그인해 주세요.';
  }
  if (m.includes('service') || m.includes('service_role')) {
    return 'Edge Function 환경변수(SERVICE_ROLE_KEY)가 설정되지 않았어요.';
  }
  return raw.length > 0 ? `정리 실패: ${raw}` : '정리 중 오류가 발생했어요.';
}
