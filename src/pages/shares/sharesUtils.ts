// bal24 v2 — 공유 링크 통합 유틸 (STEP 19)
// 4종 외부 토큰을 하나의 SharedLink[] 로 병합

import { supabase } from '../../lib/supabase';
import { copyToClipboard as copyToClipboardLib } from '../../lib/clipboard';
import {
  Mic,
  ClipboardCheck,
  ShieldCheck,
  FileText,
  Handshake,
  Link2,
  Palette,
  type LucideIcon,
} from 'lucide-react';

export type LinkCategory =
  | 'invitation'
  | 'attendance'
  | 'portal'
  | 'form'
  | 'consortium'
  | 'program_share'
  | 'club';

export interface SharedLink {
  id: string;
  category: LinkCategory;
  label: string;
  subLabel?: string;
  token: string;
  /** "/invitation" | "/checkin" | "/portal" | "/form" | "/share/..." */
  path: string;
  createdAt: string;
  status?: string;
  /** 클릭/응답 통계 (지원하는 경우) */
  stats?: { clicks: number; responses: number };
}

export const CATEGORY_LABEL: Record<LinkCategory, string> = {
  invitation: '강사 초대',
  attendance: '출석 체크인',
  portal: '고객 포털',
  form: '외부 공개 폼',
  consortium: '컨소시엄 공유',
  program_share: '역할별 공유',
  club: '동아리 활동',
};

export const CATEGORY_COLOR: Record<LinkCategory, string> = {
  invitation: '#7C3AED',
  attendance: '#10B981',
  portal: '#06B6D4',
  form: '#F97316',
  consortium: '#3B82F6',
  program_share: '#8B5CF6',
  club: '#EC4899',
};

export const CATEGORY_EMOJI: Record<LinkCategory, string> = {
  invitation: '🎤',
  attendance: '📋',
  portal: '🔐',
  form: '📝',
  consortium: '🤝',
  program_share: '🔗',
  club: '🎨',
};

export const CATEGORY_ICON: Record<LinkCategory, LucideIcon> = {
  invitation: Mic,
  attendance: ClipboardCheck,
  portal: ShieldCheck,
  form: FileText,
  consortium: Handshake,
  program_share: Link2,
  club: Palette,
};

/** 토큰으로 외부 공개 링크 생성 */
export function buildLink(path: string, token: string): string {
  if (typeof window === 'undefined') return `${path}/${token}`;
  return `${window.location.origin}${path}/${token}`;
}

/** 클립보드 복사 — lib/clipboard 의 fallback 포함 구현을 re-export */
export const copyToClipboard = copyToClipboardLib;

/** 상태값 한글 통일 (영문이 들어오면 한글로, 한글이면 그대로) */
function statusLabel(raw: string | null | undefined): string | undefined {
  if (!raw) return undefined;
  const v = raw.trim();
  if (v === 'pending') return '대기';
  if (v === 'accepted') return '수락';
  if (v === 'rejected') return '거절';
  if (v === 'completed') return '완료';
  return v;
}

interface InvitationRow {
  id: string;
  portal_token: string | null;
  status: string;
  created_at: string;
  name: string | null;
  programs: { name: string } | { name: string }[] | null;
}

interface SessionRow {
  id: string;
  title: string;
  session_date: string;
  check_in_open: boolean;
  student_token: string | null;
  instructor_token: string | null;
  ta_token: string | null;
  created_at: string;
  programs: { name: string } | { name: string }[] | null;
}

interface PortalRow {
  id: string;
  portal_token: string;
  title: string;
  is_active: boolean;
  created_at: string;
  projects: { name: string } | { name: string }[] | null;
}

interface FormRow {
  id: string;
  form_token: string;
  title: string;
  is_active: boolean;
  created_at: string;
}

interface ConsortiumLinkRow {
  id: string;
  token: string;
  link_type: string;
  label: string | null;
  url_path: string;
  is_active: boolean;
  click_count: number;
  response_count: number;
  created_at: string;
  consortiums: { name: string } | { name: string }[] | null;
}

interface ProgramShareRow {
  program_id: string;
  supporter_token: string | null;
  beneficiary_token: string | null;
  team_token: string | null;
  staff_token: string | null;
  created_at: string;
  programs: { name: string } | { name: string }[] | null;
}

interface ProgramClubRow {
  id: string;
  club_token: string;
  school_name: string;
  club_name: string;
  mentor_name: string | null;
  created_at: string;
  programs: { name: string } | { name: string }[] | null;
}

function pickName(rel: { name: string } | { name: string }[] | null | undefined): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  return rel.name;
}

/** 7종 외부 링크를 통합 조회 — 테이블 없으면 해당 카테고리 빈 배열 */
export async function fetchAllLinks(): Promise<SharedLink[]> {
  const links: SharedLink[] = [];

  const [invRes, sessRes, portalRes, formRes, conRes, shareRes, clubRes] = await Promise.all([
    supabase
      .from('instructor_invitations')
      .select('id, portal_token, status, created_at, name, programs(name)')
      .not('portal_token', 'is', null)
      .order('created_at', { ascending: false })
      .limit(50),
    supabase
      .from('attendance_sessions')
      .select(
        'id, title, session_date, check_in_open, student_token, instructor_token, ta_token, created_at, programs(name)',
      )
      .order('session_date', { ascending: false })
      .limit(30),
    supabase
      .from('project_portals')
      .select('id, portal_token, title, is_active, created_at, projects(name)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('public_forms')
      .select('id, form_token, title, is_active, created_at')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('consortium_links')
      .select('id, token, link_type, label, url_path, is_active, click_count, response_count, created_at, consortiums(name)')
      .order('created_at', { ascending: false })
      .limit(30),
    supabase
      .from('program_share')
      .select('program_id, supporter_token, beneficiary_token, team_token, staff_token, created_at, programs(name)')
      .order('created_at', { ascending: false })
      .limit(20),
    supabase
      .from('program_clubs')
      .select('id, club_token, school_name, club_name, mentor_name, created_at, programs(name)')
      .order('created_at', { ascending: false })
      .limit(30),
  ]);

  if (invRes.error) {
    console.error('[shares] 강사 초대 조회 실패:', invRes.error.message);
  } else {
    for (const r of (invRes.data as unknown as InvitationRow[] | null) ?? []) {
      if (!r.portal_token) continue;
      links.push({
        id: `inv-${r.id}`,
        category: 'invitation',
        label: `강사 초대 — ${r.name ?? '미지정'}`,
        subLabel: pickName(r.programs),
        token: r.portal_token,
        path: '/invitation',
        createdAt: r.created_at,
        status: statusLabel(r.status),
      });
    }
  }

  if (sessRes.error) {
    console.error('[shares] 출석 세션 조회 실패:', sessRes.error.message);
  } else {
    for (const s of (sessRes.data as unknown as SessionRow[] | null) ?? []) {
      const sub = pickName(s.programs)
        ? `${pickName(s.programs)} · ${s.session_date}`
        : s.session_date;
      const status = s.check_in_open ? '열림' : '닫힘';
      const tokens: Array<{ token: string | null; role: string }> = [
        { token: s.student_token, role: '교육생' },
        { token: s.instructor_token, role: '강사' },
        { token: s.ta_token, role: 'TA' },
      ];
      for (const { token, role } of tokens) {
        if (!token) continue;
        links.push({
          id: `sess-${s.id}-${role}`,
          category: 'attendance',
          label: `출석 체크인 — ${s.title} (${role})`,
          subLabel: sub,
          token,
          path: '/checkin',
          createdAt: s.created_at,
          status,
        });
      }
    }
  }

  if (portalRes.error) {
    console.error('[shares] 고객 포털 조회 실패:', portalRes.error.message);
  } else {
    for (const p of (portalRes.data as unknown as PortalRow[] | null) ?? []) {
      if (!p.portal_token) continue;
      links.push({
        id: `portal-${p.id}`,
        category: 'portal',
        label: `고객 포털 — ${p.title}`,
        subLabel: pickName(p.projects),
        token: p.portal_token,
        path: '/portal',
        createdAt: p.created_at,
        status: p.is_active ? '활성' : '비활성',
      });
    }
  }

  if (formRes.error) {
    console.error('[shares] 외부 폼 조회 실패:', formRes.error.message);
  } else {
    for (const f of (formRes.data as unknown as FormRow[] | null) ?? []) {
      if (!f.form_token) continue;
      links.push({
        id: `form-${f.id}`,
        category: 'form',
        label: `외부 폼 — ${f.title}`,
        token: f.form_token,
        path: '/form',
        createdAt: f.created_at,
        status: f.is_active ? '활성' : '비활성',
      });
    }
  }

  if (conRes.error) {
    console.error('[shares] 컨소시엄 링크 조회 실패:', conRes.error.message);
  } else {
    for (const c of (conRes.data as unknown as ConsortiumLinkRow[] | null) ?? []) {
      links.push({
        id: `con-${c.id}`,
        category: 'consortium',
        label: `${c.label || '컨소시엄 공유'}`,
        subLabel: pickName(c.consortiums),
        token: c.token,
        path: c.url_path.replace(c.token, '').replace(/\/$/, ''), // url_path에서 token 제거하여 base path 추출
        createdAt: c.created_at,
        status: c.is_active ? '활성' : '비활성',
        stats: { clicks: c.click_count, responses: c.response_count },
      });
    }
  }

  if (shareRes.error) {
    console.error('[shares] 역할별 공유 조회 실패:', shareRes.error.message);
  } else {
    const data = (shareRes.data as unknown as ProgramShareRow[] | null) ?? [];
    for (const r of data) {
      const progName = pickName(r.programs) ?? '프로그램';
      const tokens: Array<{ token: string | null; role: string; path: string }> = [
        { token: r.supporter_token, role: '지원기관', path: '/share/supporter' },
        { token: r.beneficiary_token, role: '수혜기관', path: '/share/beneficiary' },
        { token: r.team_token, role: '참여팀', path: '/share/team' },
        { token: r.staff_token, role: '강사/멘토', path: '/share/staff' },
      ];
      for (const { token, role, path } of tokens) {
        if (!token) continue;
        links.push({
          id: `share-${r.program_id}-${role}`,
          category: 'program_share',
          label: `${progName} — ${role} 공유`,
          subLabel: progName,
          token,
          path,
          createdAt: r.created_at,
          status: '활성',
        });
      }
    }
  }

  if (clubRes.error) {
    console.error('[shares] 동아리 조회 실패:', clubRes.error.message);
  } else {
    for (const c of (clubRes.data as unknown as ProgramClubRow[] | null) ?? []) {
      links.push({
        id: `club-${c.id}`,
        category: 'club',
        label: `동아리 — ${c.school_name} ${c.club_name}`,
        subLabel: `${pickName(c.programs) ?? ''} · 멘토: ${c.mentor_name ?? '미지정'}`,
        token: c.club_token,
        path: '/share/club',
        createdAt: c.created_at,
        status: '활성',
      });
    }
  }

  return links.sort(
    (a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime(),
  );
}

const STATUS_TONE: Record<string, { bg: string; text: string }> = {
  대기: { bg: 'bg-slate-100', text: 'text-slate-600' },
  수락: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  거절: { bg: 'bg-rose-100', text: 'text-rose-700' },
  완료: { bg: 'bg-violet-100', text: 'text-violet-700' },
  열림: { bg: 'bg-emerald-100', text: 'text-emerald-700' },
  닫힘: { bg: 'bg-slate-100', text: 'text-slate-500' },
  활성: { bg: 'bg-violet-100', text: 'text-violet-700' },
  비활성: { bg: 'bg-slate-100', text: 'text-slate-500' },
};

export function statusTone(status?: string): { bg: string; text: string } {
  if (!status) return { bg: 'bg-slate-100', text: 'text-slate-500' };
  return STATUS_TONE[status] ?? { bg: 'bg-slate-100', text: 'text-slate-600' };
}
