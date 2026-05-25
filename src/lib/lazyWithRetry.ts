// 박경수님 + SkyClaw 2026-05-26 — chunk 로드 실패 시 자동 새로고침
// 증상: Netlify 새 배포 후 옛 index.html 캐시 → 옛 chunk 파일명 404 → React.lazy 실패 → 흰 화면
// 해결: 첫 실패 시 1회만 자동 새로고침 (sessionStorage 로 무한루프 방지)

import { lazy } from 'react';
import type { ComponentType } from 'react';

const RETRY_FLAG = 'bal24_chunk_retry_at';

export function lazyWithRetry<T extends ComponentType<unknown>>(
  factory: () => Promise<{ default: T }>,
): ReturnType<typeof lazy<T>> {
  return lazy(async () => {
    try {
      const mod = await factory();
      // 성공 시 retry 기록 제거
      try { sessionStorage.removeItem(RETRY_FLAG); } catch { /* sessionStorage 차단 환경 */ }
      return mod;
    } catch (err) {
      // sessionStorage 안전 접근
      let alreadyRetried = false;
      try { alreadyRetried = sessionStorage.getItem(RETRY_FLAG) !== null; } catch { /* 무시 */ }

      if (!alreadyRetried) {
        try { sessionStorage.setItem(RETRY_FLAG, String(Date.now())); } catch { /* 무시 */ }
        console.warn('[lazyWithRetry] chunk 로드 실패 → 강제 새로고침합니다.', err);
        window.location.reload();
        // reload 가 즉시 일어나지 않을 수 있어 대기 (영원히 resolve 안 되는 promise)
        return new Promise<{ default: T }>(() => { /* never resolves */ });
      }
      // 두 번째 실패는 그대로 throw → ErrorBoundary 가 캐치
      console.error('[lazyWithRetry] 재시도 후에도 실패. ErrorBoundary 로 위임.', err);
      throw err;
    }
  });
}
