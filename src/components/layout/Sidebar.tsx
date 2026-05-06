// bal24 v2 — 좌측 사이드바
// 다크 슬레이트(#0F172A) 배경, 8개 메뉴

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CheckSquare,
  Calendar,
  Video,
  Briefcase,
  Users,
  Wallet,
  FileText,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type MenuItem = {
  to: string;
  label: string;
  Icon: LucideIcon;
};

const MENU: MenuItem[] = [
  { to: '/dashboard', label: '대시보드', Icon: LayoutDashboard },
  { to: '/tasks',     label: '업무관리', Icon: CheckSquare },
  { to: '/schedule',  label: '일정관리', Icon: Calendar },
  { to: '/meetings',  label: '미팅',     Icon: Video },
  { to: '/clients',   label: '거래처',   Icon: Briefcase },
  { to: '/staff',     label: '인력',     Icon: Users },
  { to: '/billing',   label: '정산',     Icon: Wallet },
  { to: '/reports',   label: '사업보고', Icon: FileText },
];

export default function Sidebar() {
  return (
    <aside
      className="fixed inset-y-0 left-0 w-60 bg-[#0F172A] text-slate-100 flex flex-col"
      aria-label="주 메뉴"
    >
      <div className="px-5 py-6 border-b border-white/10">
        <div className="flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20 text-primary text-lg">
            🚀
          </span>
          <div className="leading-tight">
            <div className="text-base font-bold">bal24</div>
            <div className="text-xs text-slate-400">WorkFlow v2</div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 space-y-1 overflow-y-auto">
        {MENU.map(({ to, label, Icon }) => (
          <NavLink
            key={to}
            to={to}
            className={({ isActive }) =>
              [
                'flex items-center gap-3 px-3 py-2 rounded-lg text-sm transition-colors',
                isActive
                  ? 'bg-primary/20 text-white font-semibold'
                  : 'text-slate-300 hover:bg-white/5 hover:text-white',
              ].join(' ')
            }
          >
            <Icon size={18} aria-hidden="true" />
            <span>{label}</span>
          </NavLink>
        ))}
      </nav>

      <div className="px-5 py-4 text-xs text-slate-500 border-t border-white/10">
        © 2026 bal24
      </div>
    </aside>
  );
}
