// bal24 v2 — STEP-PARTICIPANT-PORTAL 참여자 토큰·링크·CSV·역할 배지 유틸

import { supabase } from './supabase';
import { copyToClipboard } from './clipboard';
import type {
  ParticipantRole, ProgramParticipant,
} from '../types/database';

export const PARTICIPANT_ROLE_LABEL: Record<ParticipantRole, string> = {
  participant: '교육생',
  mentor:      '멘토',
  client:      '고객사',
  ta:          'TA',
  observer:    '참관',
};

export const PARTICIPANT_ROLE_BADGE: Record<ParticipantRole, string> = {
  participant: 'bg-violet-100 text-violet-800',
  mentor:      'bg-blue-100 text-blue-800',
  client:      'bg-amber-100 text-amber-800',
  ta:          'bg-teal-100 text-teal-800',
  observer:    'bg-gray-100 text-gray-700',
};

export const PARTICIPANT_ROLE_VALUES: ParticipantRole[] = [
  'participant', 'mentor', 'client', 'ta', 'observer',
];

const LABEL_TO_ROLE: Record<string, ParticipantRole> = {
  '교육생': 'participant', '멘토': 'mentor', '고객사': 'client',
  'TA': 'ta', 'ta': 'ta', '참관': 'observer',
};

export function getParticipantPortalUrl(token: string): string {
  return `${window.location.origin}/participant/${token}`;
}

export async function copyParticipantLink(token: string): Promise<boolean> {
  return copyToClipboard(getParticipantPortalUrl(token));
}

export interface ParticipantPortalContext {
  participant: ProgramParticipant;
  program: {
    id: string;
    name: string;
    start_date: string | null;
    end_date: string | null;
    venue: string | null;
  };
}

export async function fetchParticipantByToken(token: string): Promise<ParticipantPortalContext | null> {
  const { data, error } = await supabase
    .from('program_participants')
    .select('*')
    .eq('access_token', token)
    .maybeSingle();
  if (error) {
    console.error('[participant] 토큰 조회 실패:', error.message);
    return null;
  }
  if (!data) return null;
  const p = data as ProgramParticipant;
  if (p.status !== 'active' && p.status !== 'completed') return null;
  if (p.token_expires_at && new Date(p.token_expires_at) < new Date()) return null;

  const { data: prog, error: progErr } = await supabase
    .from('programs').select('id, name, start_date, end_date, venue').eq('id', p.program_id).maybeSingle();
  if (progErr || !prog) {
    console.error('[participant] 프로그램 조회 실패:', progErr?.message);
    return null;
  }
  return {
    participant: p,
    program: {
      id: prog.id, name: prog.name,
      start_date: prog.start_date ?? null,
      end_date: prog.end_date ?? null,
      venue: prog.venue ?? null,
    },
  };
}

export interface ParsedParticipantRow {
  name: string;
  email?: string;
  phone?: string;
  organization?: string;
  id_number?: string;
  role: ParticipantRole;
}

// STEP-PARTICIPANTS-CSV-FIX — 헤더명 기반 동적 매핑 (순서 무관)
// 한글·영문·공백 변형 모두 정규화하여 매칭.
type FieldKey = 'name' | 'email' | 'phone' | 'role' | 'organization' | 'id_number';

const HEADER_MAP: Record<string, FieldKey> = {
  // 이름
  '이름': 'name', '성명': 'name', 'name': 'name',
  // 이메일
  '이메일': 'email', '메일': 'email', 'email': 'email', 'e-mail': 'email',
  // 연락처
  '연락처': 'phone', '휴대폰': 'phone', '전화': 'phone', '핸드폰': 'phone',
  '전화번호': 'phone', 'phone': 'phone', 'mobile': 'phone', 'tel': 'phone',
  // 역할
  '역할': 'role', '구분': 'role', 'role': 'role',
  // 소속
  '소속': 'organization', '회사': 'organization', '기관': 'organization',
  'organization': 'organization', 'org': 'organization', 'company': 'organization',
  // 주민번호
  '주민번호': 'id_number', '주민등록번호': 'id_number',
  'id_number': 'id_number', 'rrn': 'id_number',
};

function normalizeHeader(s: string): string {
  return s.trim().replace(/\s+/g, '').toLowerCase();
}

/** CSV 파싱 — 헤더명 기반 매핑 (순서 무관). 한글 역할 영문 자동 변환 */
export function parseParticipantCSV(csvText: string): ParsedParticipantRow[] {
  const rows: ParsedParticipantRow[] = [];
  const lines = csvText.split(/\r?\n/).map((l) => l.trim()).filter(Boolean);
  if (lines.length === 0) return rows;

  // 1) 헤더 행 분석 → 컬럼 인덱스 → 필드 키 매핑
  const headerCols = lines[0].split(',').map((c) => c.trim());
  const colToField: (FieldKey | null)[] = headerCols.map((h) => HEADER_MAP[normalizeHeader(h)] ?? null);
  const hasHeader = colToField.some((f) => f === 'name');

  // 헤더가 없으면 (이름·이메일·연락처·역할 순서로 가정) — 기존 호환
  const fieldOrder: (FieldKey | null)[] = hasHeader
    ? colToField
    : ['name', 'email', 'phone', 'role'];
  const startIdx = hasHeader ? 1 : 0;

  for (let i = startIdx; i < lines.length; i += 1) {
    const cols = lines[i].split(',').map((c) => c.trim());
    const rec: Partial<Record<FieldKey, string>> = {};
    cols.forEach((val, j) => {
      const field = fieldOrder[j];
      if (field && val) rec[field] = val;
    });
    const name = rec.name;
    if (!name) continue;
    const roleKey = (rec.role ?? '').trim();
    const role: ParticipantRole = LABEL_TO_ROLE[roleKey]
      ?? ((PARTICIPANT_ROLE_VALUES as string[]).includes(roleKey) ? (roleKey as ParticipantRole) : 'participant');
    rows.push({
      name,
      email: rec.email || undefined,
      phone: rec.phone || undefined,
      organization: rec.organization || undefined,
      id_number: rec.id_number || undefined,
      role,
    });
  }
  return rows;
}
