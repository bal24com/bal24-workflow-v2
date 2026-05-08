// bal24 v2 — 커리큘럼 인력 외부 응답 페이지 유틸 (STEP-CURRICULUM-INVITE)
// curriculum_staff.token 으로 본인 응답 정보 fetch.

import { supabase } from '../../lib/supabase';

export interface CurriculumInviteData {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  role: string;
  fee?: number | null;
  note?: string | null;
  responded_at?: string | null;
  token: string;
  curriculum: {
    id: string;
    session_no?: number | null;
    title?: string | null;
    session_date?: string | null;
    start_time?: string | null;
    end_time?: string | null;
    venue?: string | null;
    program: { id: string; name: string; venue?: string | null } | null;
  } | null;
  staff_pool?: { name: string } | null;
  profile?: { name: string } | null;
}

/** Supabase 의 nested join 은 단일/배열 둘 다 반환 가능 — 안전하게 단일 추출 */
function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (v == null) return null;
  return Array.isArray(v) ? (v[0] ?? null) : v;
}

interface RawRow {
  id: string;
  status: 'pending' | 'accepted' | 'rejected';
  role: string;
  fee: number | null;
  note: string | null;
  responded_at: string | null;
  token: string;
  curriculum: RawCurriculum | RawCurriculum[] | null;
  staff_pool: { name: string } | { name: string }[] | null;
  profile: { name: string } | { name: string }[] | null;
}

interface RawCurriculum {
  id: string;
  session_no: number | null;
  title: string | null;
  session_date: string | null;
  start_time: string | null;
  end_time: string | null;
  venue: string | null;
  program: { id: string; name: string; venue: string | null } | { id: string; name: string; venue: string | null }[] | null;
}

export async function fetchCurriculumInvite(
  token: string,
): Promise<CurriculumInviteData | null> {
  const { data, error } = await supabase
    .from('curriculum_staff')
    .select(`
      id, status, role, fee, note, responded_at, token,
      curriculum:program_curriculum(
        id, session_no, title, session_date, start_time, end_time, venue,
        program:programs(id, name, venue)
      ),
      staff_pool:staff_pool(name),
      profile:profiles(name)
    `)
    .eq('token', token)
    .maybeSingle();

  if (error) {
    console.error('[curriculum-invite] 조회 실패:', error.message);
    return null;
  }
  if (!data) return null;

  const raw = data as unknown as RawRow;
  const curriculum = pickOne(raw.curriculum);
  const program = curriculum ? pickOne(curriculum.program) : null;
  return {
    id: raw.id,
    status: raw.status,
    role: raw.role,
    fee: raw.fee,
    note: raw.note,
    responded_at: raw.responded_at,
    token: raw.token,
    curriculum: curriculum
      ? {
          id: curriculum.id,
          session_no: curriculum.session_no,
          title: curriculum.title,
          session_date: curriculum.session_date,
          start_time: curriculum.start_time,
          end_time: curriculum.end_time,
          venue: curriculum.venue,
          program,
        }
      : null,
    staff_pool: pickOne(raw.staff_pool),
    profile: pickOne(raw.profile),
  };
}

export function getInviteeName(data: CurriculumInviteData): string {
  return data.staff_pool?.name ?? data.profile?.name ?? '강사';
}

/** 차시 라벨: "3차시 · 리더십 워크숍" */
export function buildSessionLabel(c: CurriculumInviteData['curriculum']): string {
  if (!c) return '강의 차시';
  const parts: string[] = [];
  if (c.session_no != null) parts.push(`${c.session_no}차시`);
  if (c.title) parts.push(c.title);
  return parts.length > 0 ? parts.join(' · ') : '강의 차시';
}

/** 시각 라벨: "2026-05-15 · 14:00~16:00" */
export function buildScheduleLabel(c: CurriculumInviteData['curriculum']): string {
  if (!c) return '';
  const segs: string[] = [];
  if (c.session_date) segs.push(c.session_date);
  if (c.start_time && c.end_time) segs.push(`${c.start_time.slice(0, 5)}~${c.end_time.slice(0, 5)}`);
  else if (c.start_time) segs.push(c.start_time.slice(0, 5));
  return segs.join(' · ');
}
