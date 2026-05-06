// bal24 v2 — 인증된 사용자용 레이아웃
// 좌 사이드바 고정 + 상단 헤더 고정 + 우측 콘텐츠 영역(#F8FAFC)

import { useMemo, useState } from 'react';
import { Outlet, useLocation } from 'react-router-dom';
import { LogOut } from 'lucide-react';
import Sidebar from './Sidebar';
import { useAuth } from '../../contexts/AuthContext';

const TITLES: Record<string, string> = {
  '/home':        '홈',
  '/schedule':    '일정',
  '/projects':    '프로젝트',
  '/consortium':  '컨소시엄',
  '/programs':    '프로그램',
  '/clients':     '고객사',
  '/experts':     '전문가',
  '/shares':      '공유',
  '/attendance':  '출석체크',
  '/certificates':'수료증',
  '/activity-logs':'일지',
  '/income':      '수입',
  '/expense':     '지출',
  '/receipts':    '증빙',
  '/reports':     '리포트',
  '/team':        '팀원',
  '/ai':          'AI',
};

export default function Layout() {
  const { user, signOut } = useAuth();
  const location = useLocation();
  const [signingOut, setSigningOut] = useState(false);

  const title = useMemo(() => {
    const exact = TITLES[location.pathname];
    if (exact) return exact;
    const prefix = Object.keys(TITLES).find((k) => location.pathname.startsWith(k + '/'));
    return prefix ? TITLES[prefix] : 'bal24 WorkFlow';
  }, [location.pathname]);

  const handleSignOut = async () => {
    setSigningOut(true);
    try {
      await signOut();
    } catch (err) {
      const message = err instanceof Error ? err.message : '로그아웃에 실패했어요.';
      console.error('[layout] signOut 실패:', message);
      setSigningOut(false);
    }
  };

  return (
    <div className="min-h-screen bg-[#F8FAFC]">
      <Sidebar />

      <div className="ml-60 flex flex-col min-h-screen">
        <header className="sticky top-0 z-10 h-14 bg-white border-b border-slate-200 flex items-center justify-between px-6">
          <h1 className="text-lg font-bold text-slate-900">{title}</h1>

          <div className="flex items-center gap-3">
            <span className="text-sm text-slate-500 hidden sm:inline">
              {user?.email}
            </span>
            <button
              type="button"
              onClick={() => void handleSignOut()}
              disabled={signingOut}
              className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-btn text-sm font-semibold text-slate-700 border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition-colors"
            >
              <LogOut size={16} aria-hidden="true" />
              {signingOut ? '로그아웃 중…' : '로그아웃'}
            </button>
          </div>
        </header>

        <main className="flex-1 p-6">
          <Outlet />
        </main>
      </div>
    </div>
  );
}
