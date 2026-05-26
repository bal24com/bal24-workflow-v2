// 재무 페이지 진입 가드 훅 + 공용 로더 — 박경수님 + SkyClaw STEP-RBAC-SETUP (2026-05-28)
// /contracts · /payroll · /payroll-mgmt · /accounting-reviews 등에서 사용.
// admin/finance 만 허용, 그 외는 toast + 리디렉트.

import { useEffect } from 'react';
import { useNavigate } from 'react-router-dom';
import { Loader2 } from 'lucide-react';
import { useUserProfile } from './useUserProfile';
import { useToast } from '../contexts/ToastContext';

export function useFinanceGuard(redirectTo: string = '/home') {
  // isFinance 는 useUserProfile 내부에서 isAdmin || hasRole('finance') 처리됨
  const { isFinance, loading } = useUserProfile();
  const navigate = useNavigate();
  const toast = useToast();

  useEffect(() => {
    if (loading) return;
    if (!isFinance) {
      toast.error('재무 메뉴는 재무 담당자(또는 관리자)만 접근할 수 있어요.');
      navigate(redirectTo, { replace: true });
    }
  }, [loading, isFinance, navigate, toast, redirectTo]);

  return { loading, allowed: isFinance };
}

/** 권한 확인 중 표시. 페이지마다 동일 마크업 반복 방지 */
export function FinanceGuardLoader() {
  return (
    <div className="flex items-center justify-center py-16 text-slate-500 text-sm">
      <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" />
      권한 확인 중…
    </div>
  );
}

/** HOC — 페이지 default export 를 감싸 admin/finance 만 통과시킴.
 *  페이지 컴포넌트는 props 가 없는 router element 라는 가정. lazy import 호환을 위해 단순 타입 사용. */
export function withFinanceGuard(
  Component: React.ComponentType,
  redirectTo: string = '/home',
) {
  function Guarded() {
    const { loading, allowed } = useFinanceGuard(redirectTo);
    if (loading) return <FinanceGuardLoader />;
    if (!allowed) return null;
    return <Component />;
  }
  Guarded.displayName = `withFinanceGuard(${Component.displayName ?? Component.name ?? 'Component'})`;
  return Guarded;
}
