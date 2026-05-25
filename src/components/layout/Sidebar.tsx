// bal24 v2 — 좌측 사이드바 (STEP-MENU-RESTRUCTURE)
// 다크 슬레이트(#0F172A) 배경. 5그룹 구조로 재편 — 홈/사업/주관기관·인력/재무/도구.
// PARTNER 는 3그룹(홈/사업/도구), MEMBER 는 1그룹(내 사업).

import { NavLink, Link } from 'react-router-dom';
import {
  LayoutDashboard,
  CalendarDays,
  FolderKanban,
  Building2,
  Briefcase,
  Users,
  UserCog,
  BarChart3,
  BookOpen,
  Sparkles,
  Home,
  ExternalLink,
  Trash2,
  FileText,
  ClipboardCheck,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useEffect, useState } from 'react';

type MenuItem = {
  to: string;
  label: string;
  Icon: LucideIcon;
  /** STEP-SIDEBAR-PROGRAM-RESTORE — 상위 항목의 하위 메뉴로 들여쓰기 표시 */
  nested?: boolean;
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
      // STEP-MENU-INTEGRATION-1A — 프로그램 메뉴 제거. 프로젝트 상세 안의 "프로그램" 탭으로 통합 진입.
      // 기존 /programs URL 은 라우트 보존 (북마크 호환).
      { to: '/consortium', label: '컨소시엄', Icon: Building2 },
    ],
  },
  {
    heading: '주관기관·인력',
    items: [
      { to: '/clients', label: '고객사', Icon: Briefcase },
      { to: '/experts', label: '전문가', Icon: Users },
      { to: '/members', label: '팀원',   Icon: UserCog },
    ],
  },
  {
    heading: '재무',
    items: [
      // STEP-ACCOUNTING-ALL — 수입→수입/계약, 지출→외주/급여, 증빙 제거, 회계 검토 신규
      { to: '/contracts',          label: '수입/계약', Icon: FileText },
      { to: '/payroll',            label: '외주/급여', Icon: Users },
      { to: '/accounting-reviews', label: '회계 검토', Icon: ClipboardCheck },
      { to: '/reports',            label: '리포트',    Icon: BarChart3 },
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

// STEP-EXPERT-CRUD-FULL — admin 전용 추가 메뉴 (휴지통 등)
const ADMIN_EXTRA: MenuSection = {
  heading: '관리',
  items: [
    { to: '/admin', label: '휴지통·관리', Icon: Trash2 },
  ],
};

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
      // STEP-SIDEBAR-PROGRAM-RESTORE — PARTNER 사이드바도 동일하게 프로그램 하위 추가
      { to: '/programs',   label: '프로그램', Icon: BookOpen, nested: true },
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

// MEMBER 전용 사이드바
const MEMBER_SECTIONS: MenuSection[] = [
  {
    heading: '내 사업',
    items: [
      { to: '/home',      label: '홈',       Icon: Home },
      { to: '/schedule',  label: '일정',     Icon: CalendarDays },
      { to: '/my-report', label: '사업보고', Icon: BookOpen },
    ],
  },
];

// FINANCE 전용 사이드바 (3그룹 — 홈/재무/도구)
const FINANCE_SECTIONS: MenuSection[] = [
  {
    heading: '홈',
    items: [
      { to: '/home',     label: '대시보드', Icon: LayoutDashboard },
      { to: '/schedule', label: '일정',     Icon: CalendarDays },
    ],
  },
  {
    heading: '재무',
    items: [
      // STEP-ACCOUNTING-ALL — 수입→수입/계약, 지출→외주/급여, 증빙 제거, 회계 검토 신규
      { to: '/contracts',          label: '수입/계약', Icon: FileText },
      { to: '/payroll',            label: '외주/급여', Icon: Users },
      { to: '/accounting-reviews', label: '회계 검토', Icon: ClipboardCheck },
      { to: '/reports',            label: '리포트',    Icon: BarChart3 },
    ],
  },
  {
    heading: '도구',
    items: [
      { to: '/ai', label: 'AI', Icon: Sparkles },
    ],
  },
];

function MenuLink({ to, label, Icon, nested }: MenuItem) {
  return (
    <NavLink
      to={to}
      className={({ isActive }) =>
        [
          'flex items-center gap-3 py-2 rounded-lg text-sm transition-colors',
          // STEP-SIDEBAR-PROGRAM-RESTORE — nested 항목은 왼쪽 들여쓰기 + 트리 가지 표시
          nested ? 'pl-8 pr-3 relative' : 'px-3',
          isActive
            ? 'bg-primary/20 text-white font-semibold'
            : 'text-slate-300 hover:bg-white/5 hover:text-white',
        ].join(' ')
      }
    >
      {nested && (
        <span aria-hidden="true" className="absolute left-4 top-0 bottom-1/2 border-l border-b border-white/20 w-2.5 rounded-bl" />
      )}
      <Icon size={16} aria-hidden="true" />
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
  const isAdmin   = role === 'admin';
  const isPartner = role === 'partner';
  const isMember  = role === 'member';
  const isFinance = role === 'finance';
  const baseSections = isPartner ? PARTNER_SECTIONS
                     : isMember  ? MEMBER_SECTIONS
                     : isFinance ? FINANCE_SECTIONS
                     : SECTIONS;
  // STEP-EXPERT-CRUD-FULL — admin 만 [관리] 그룹 추가 노출
  const sections = isAdmin ? [...baseSections, ADMIN_EXTRA] : baseSections;

  return (
    <aside
      className="fixed inset-y-0 left-0 w-60 bg-[#0F172A] text-slate-100 flex flex-col"
      aria-label="주 메뉴"
    >
      <div className="px-5 py-6 border-b border-white/10">
        {/* 로고 영역 — 클릭 시 홈(/home)으로 이동. 박경수님 요청으로 큰글씨/작은글씨 위치 교환 */}
        <Link
          to="/home"
          className="flex items-center gap-2 rounded-lg -mx-1 px-1 py-1 hover:bg-white/5 transition-colors"
          aria-label="홈으로 이동"
        >
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/20 text-primary text-lg">
            🚀
          </span>
          <div className="leading-tight">
            <div className="text-base font-bold">
              {isPartner ? 'WorkFlow · 참여사' : isMember ? 'WorkFlow · 수혜기업' : 'WorkFlow v2'}
            </div>
            <div className="text-xs text-slate-400">bal24</div>
          </div>
        </Link>
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
