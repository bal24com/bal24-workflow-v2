// bal24 v2 — 공유 링크 통합 유틸 (STEP 19)
// 4종 외부 토큰을 하나의 SharedLink[] 로 병합

import { supabase } from '../../lib/supabase';
import { copyToClipboard as copyToClipboardLib } from '../../lib/clipboard';

export type LinkCategory = 'invitation' | 'attendance' | 'portal' | 'form';

export interface SharedLink {
  id: string;
  category: LinkCategory;
  label: string;
  subLabel?: string;
  token: string;
  /** "/invitation" | "/checkin" | "/portal" | "/form" */
  path: string;
  createdAt: string;
  status?: string;
}

export const CATEGORY_LABEL: Record<LinkCategory, string> = {
  invitation: '강사 초대',
  attendance: '출석 체크인',
  portal: '고객 포털',
  form: '외부 공개 폼',
};

export const CATEGORY_COLOR: Record<LinkCategory, string> = {
  invitation: '#7C3AED',
  attendance: '#10B981',
  portal: '#06B6D4',
  form: '#F97316',
};

export const CATEGORY_EMOJI: Record<LinkCategory, string> = {
  invitation: '🎤',
  attendance: '📋',
  portal: '🔐',
  form: '📝',
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

function pickName(rel: { name: string } | { name: string }[] | null | undefined): string | undefined {
  if (!rel) return undefined;
  if (Array.isArray(rel)) return rel[0]?.name;
  return rel.name;
}

/** 4종 외부 링크를 통합 조회 — 테이블 없으면 해당 카테고리 빈 배열 */
export async function fetchAllLinks(): Promise<SharedLink[]> {
  const links: SharedLink[] = [];

  const [invRes, sessRes, portalRes, formRes] = await Promise.all([
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
  ]);

  if (invRes.error) {
    console.error('[shares] 강사 초대 조회 실패:', invRes.error.message);
  } else {
    for (const r of (invRes.data as InvitationRow[] | null) ?? []) {
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
    for (const s of (sessRes.data as SessionRow[] | null) ?? []) {
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
    // 테이블 없거나 컬럼 다르면 조용히 SKIP (명세 가정)
    console.error('[shares] 고객 포털 조회 실패:', portalRes.error.message);
  } else {
    for (const p of (portalRes.data as PortalRow[] | null) ?? []) {
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
    for (const f of (formRes.data as FormRow[] | null) ?? []) {
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
