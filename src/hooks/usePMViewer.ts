// bal24 v2 — PM/ADMIN 뷰어 모드 감지 훅 (STEP-PM-VIEWER)
// 토큰 기반 외부 페이지에 PM/ADMIN 이 로그인 상태로 접근할 때 읽기 전용 뷰어 모드 활성.
// AuthContext 와 무관하게 독립 동작 (외부 라우트는 ProtectedRoute 밖에 있음).

import { useEffect, useState } from 'react';
import { supabase } from '../lib/supabase';

interface PMViewerResult {
  /** true = PM/ADMIN 로그인 상태 → 뷰어 모드 (수정 차단) */
  isViewer: boolean;
  isLoading: boolean;
  /** 뷰어 모드일 때 배너에 표시할 사용자 이름 */
  viewerName: string;
}

export function usePMViewer(): PMViewerResult {
  const [isViewer, setIsViewer] = useState(false);
  const [isLoading, setIsLoading] = useState(true);
  const [viewerName, setViewerName] = useState('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const { data: { user } } = await supabase.auth.getUser();
        if (!user) {
          if (!cancelled) {
            setIsViewer(false);
            setIsLoading(false);
          }
          return;
        }
        const { data, error } = await supabase
          .from('profiles')
          .select('name, role')
          .eq('id', user.id)
          .maybeSingle();
        if (error) {
          console.error('[pm-viewer] 프로필 조회 실패:', error.message);
        }
        if (!cancelled) {
          // V2 보정: profiles.role 은 대문자 'PM' / 'ADMIN' 만 사용 (database.ts Role 타입 참조)
          const role = data?.role ?? null;
          const isPMorAdmin = role === 'PM' || role === 'ADMIN';
          setIsViewer(isPMorAdmin);
          setViewerName(data?.name ?? '');
          setIsLoading(false);
        }
      } catch (err) {
        const raw = err instanceof Error ? err.message : '';
        console.error('[pm-viewer] 역할 확인 실패:', raw);
        if (!cancelled) setIsLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  return { isViewer, isLoading, viewerName };
}
