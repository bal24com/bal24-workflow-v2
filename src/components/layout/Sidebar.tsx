// bal24 v2 — 좌측 사이드바 (STEP-MENU-RESTRUCTURE)
// 다크 슬레이트(#0F172A) 배경. 5그룹 구조로 재편 — 홈/사업/거래처·인력/재무/도구.
// PARTNER 는 3그룹(홈/사업/도구), MEMBER 는 1그룹(내 사업).

import { NavLink } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  FolderKanban,
  Building2,
  Briefcase,
  Users,
  UserCog,
  TrendingUp,
  TrendingDown,
  Receipt,
  BarChart3,
  BookOpen,
  Sparkles,
  Home,
  ExternalLink,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useState } from 'react';

type MenuItem = {
  to: string;
  label: string;
  Icon: LucideIcon;
};

type MenuSection = {
  heading: string;
  items: MenuItem[];
};

// SECTIONS — admin / pm / staff / finance 공용 (5그룹)
const SECTIONS: MenuSection[] = [
  {
    heading: '홈',
    items: [
      { to: '/home',     label: '대시보드', Icon: LayoutDashboard },
      { to: '/schedule', label: '일정',     Icon: CalendarDays },
    ],
  },
  {
    heading: '사업',
    items: [
      { to: '/projects',   label: '프로젝트', Icon: FolderKanban },
      { to: '/consortium', label: '컨소시엄', Icon: Building2 },
    ],
  },
  {
    heading: '거래처·인력',
    items: [
      { to: '/clients', label: '고객사', Icon: Briefcase },
      { to: '/experts', label: '전문가', Icon: Users },
      { to: '/members', label: '팀원',   Icon: UserCog },
    ],
  },
  {
    heading: '재무',
    items: [
      { to: '/income',   label: '수입',   Icon: TrendingUp },
      { to: '/expense',  label: '지출',   Icon: TrendingDown },
      { to: '/receipts', label: '증빙',   Icon: Receipt },
      { to: '/reports',  label: '리포트', Icon: BarChart3 },
    ],
  },
  {
    heading: '도구',
    items: [
      { to: '/logs', label: '일지', Icon: BookOpen },
      { to: '/ai',   label: 'AI',   Icon: Sparkles },
    ],
  },
];

// PARTNER 사이드바 (3그룹 — 홈/사업/도구)
const PARTNER_SECTIONS: MenuSection[] = [
  {
    heading: '홈',
    items: [
      { to: '/home',     label: '대시보드', Icon: LayoutDashboard },
      { to: '/schedule', label: '일정',     Icon: CalendarDays },
    ],
  },
  {
    heading: '사업',
    items: [
      { to: '/projects',   label: '프로젝트', Icon: FolderKanban },
      { to: '/consortium', label: '컨소시엄', Icon: Building2 },
    ],
  },
  {
    heading: '도구',
    items: [
      { to: '/logs', label: '일지', Icon: BookOpen },
      { to: '/ai',   label: 'AI',   Icon: Sparkles },
    ],
  },
];

// STEP-MEMBER-REPORT-PORTAL — MEMBER 전용 사이드바 (변경 없음)
const MEMBER_SECTIONS: MenuSection[] = [
  {
    heading: '내 사업',
    items: [
      { to: '/home',      label: '홈',       Icon: Home },
      { to: '/my-report', label: '사업보고', Icon: BookOpen },
    ],
  },
];

function MenuLink({ to, label, Icon }: MenuItem) {
  return (
    <NavLink
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
  );
}

export default function Sidebar() {
  const { user } = useAuth();
  const [role, setRole] = useState<string | null>(null);
  const [myToken, setMyToken] = useState<string | null>(null);

  useEffect(() => {
    if (!user) {
      setRole(null);
      setMyToken(null);
      return;
    }
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('profiles')
        .select('role, my_token')
        .eq('id', user.id)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[partner] 사이드바 role 조회 실패:', error.message);
        return;
      }
      setRole((data?.role as string | null) ?? null);
      setMyToken((data?.my_token as string | null) ?? null);
    })();
    return () => { cancelled = true; };
  }, [user]);

  // V2 실측 가정: profiles.role 은 소문자 ('admin', 'partner', 'member' 등)
  const isPartner = role === 'partner';
  const isMember  = role === 'member';
  const sections  = isPartner ? PARTNER_SECTIONS
                  : isMember  ? MEMBER_SECTIONS
                  : SECTIONS;

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
            <div className="text-xs text-slate-400">
              {isPartner ? 'WorkFlow · 참여사' : isMember ? 'WorkFlow · 수혜기업' : 'WorkFlow v2'}
            </div>
          </div>
        </div>
      </div>

      <nav className="flex-1 px-3 py-4 overflow-y-auto" aria-label="섹션 메뉴">
        {sections.map((section, idx) => (
          <div
            key={section.heading}
            className={idx > 0 ? 'mt-4 pt-4 border-t border-white/10' : ''}
          >
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-500">
              {section.heading}
            </div>
            <div className="space-y-1">
              {section.items.map((item) => (
                <MenuLink key={item.to} {...item} />
              ))}
            </div>
          </div>
        ))}

        {/* PARTNER/MEMBER — 마이페이지 바로가기 */}
        {(isPartner || isMember) && myToken && (
          <div className="mt-4 pt-4 border-t border-white/10 space-y-1">
            <div className="px-3 mb-1.5 text-[10px] font-bold tracking-widest uppercase text-slate-500">
              개인
            </div>
            <NavLink
              to={`/my/${myToken}`}
              className="flex items-center gap-3 px-3 py-2 rounded-lg text-sm text-slate-300 hover:bg-white/5 hover:text-white transition-colors"
            >
              <ExternalLink size={18} aria-hidden="true" />
              <span>내 마이페이지</span>
            </NavLink>
          </div>
        )}
      </nav>

      <div className="px-5 py-4 text-xs text-slate-500 border-t border-white/10">
        © 2026 bal24
      </div>
    </aside>
  );
}
