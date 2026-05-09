// bal24 v2 — 좌측 사이드바
// 다크 슬레이트(#0F172A) 배경, 14개 메뉴 + 섹션 구분 (운영 / 재무 / 기타)

import { NavLink } from 'react-router-dom';
import {
  Home,
  CalendarDays,
  Briefcase,
  Users2,
  GraduationCap,
  Building2,
  UserStar,
  Share2,
  CheckSquare,
  Award,
  BookOpen,
  ClipboardList,
  UserCheck,
  Megaphone,
  Link as LinkIcon,
  TrendingUp,
  TrendingDown,
  Receipt,
  CreditCard,
  FileBarChart,
  Users,
  Sparkles,
  LayoutGrid,
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

// PARTNER 전용 사이드바 — 2개 메뉴 + 마이페이지 링크 (Q1, Q5)
const PARTNER_SECTIONS: MenuSection[] = [
  {
    heading: '내 작업',
    items: [
      { to: '/partner-home', label: '내 프로그램', Icon: LayoutGrid },
      { to: '/expense',      label: '내 정산',     Icon: Receipt },
    ],
  },
];

const SECTIONS: MenuSection[] = [
  {
    heading: '운영',
    items: [
      { to: '/home',        label: '홈',       Icon: Home },
      { to: '/schedule',    label: '일정',     Icon: CalendarDays },
      { to: '/projects',    label: '프로젝트', Icon: Briefcase },
      { to: '/consortium',  label: '컨소시엄', Icon: Users2 },
      { to: '/programs',    label: '프로그램', Icon: GraduationCap },
      { to: '/clients',     label: '고객사',   Icon: Building2 },
      { to: '/experts',     label: '전문가',   Icon: UserStar },
      { to: '/shares',      label: '공유',     Icon: Share2 },
      { to: '/attendance',  label: '출석체크', Icon: CheckSquare },
      { to: '/certificates', label: '수료증',  Icon: Award },
      { to: '/activity-logs', label: '일지',   Icon: BookOpen },
      { to: '/forms',         label: '폼 관리', Icon: ClipboardList },
      { to: '/applications',  label: '교육생 신청', Icon: UserCheck },
      { to: '/recruit-manage',label: '모집 공고',   Icon: Megaphone },
      { to: '/portals',       label: '포털',    Icon: LinkIcon },
    ],
  },
  {
    heading: '재무',
    items: [
      { to: '/income',      label: '수입',   Icon: TrendingUp },
      { to: '/expense',     label: '지출',   Icon: TrendingDown },
      { to: '/receipts',    label: '증빙',   Icon: Receipt },
      { to: '/settlements', label: '정산',   Icon: CreditCard },
      { to: '/reports',     label: '리포트', Icon: FileBarChart },
    ],
  },
  {
    heading: '기타',
    items: [
      { to: '/members', label: '팀원', Icon: Users },
      { to: '/ai',   label: 'AI',   Icon: Sparkles },
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

  // V2 실측 가정: profiles.role 은 소문자 ('admin', 'partner' 등)
  const isPartner = role === 'partner';
  const sections = isPartner ? PARTNER_SECTIONS : SECTIONS;

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
              {isPartner ? 'WorkFlow · 참여사' : 'WorkFlow v2'}
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

        {/* PARTNER 전용 — 마이페이지 바로가기 (Q5) */}
        {isPartner && myToken && (
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
