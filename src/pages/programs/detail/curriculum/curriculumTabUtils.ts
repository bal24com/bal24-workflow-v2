// bal24 v2 — 커리큘럼 상세 탭 fetch 유틸 (Stage 3-A)
// program_curriculum + curriculum_staff 통합 조회 + 매칭 인력 연락처 join.

import { supabase } from '../../../../lib/supabase';
import { staffSource } from '../../../../lib/curriculumStaff';
import type {
  CurriculumStaff, ProgramCurriculum,
} from '../../../../types/database';
import type { MatchedStaffRow } from './StaffMatchRow';

export interface CurriculumWithStaff extends ProgramCurriculum {
  staff: MatchedStaffRow[];
}

type StaffJoinRow = CurriculumStaff & {
  staff_pool:
    | { id: string; name: string; phone: string | null; email: string | null }
    | { id: string; name: string; phone: string | null; email: string | null }[]
    | null;
  profile:
    | { id: string; name: string; phone: string | null; email: string | null }
    | { id: string; name: string; phone: string | null; email: string | null }[]
    | null;
};

function pickOne<T>(v: T | T[] | null): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v;
}

export async function fetchCurriculumBundle(
  programId: string,
  curriculumType: 'planned' | 'actual' = 'planned',
): Promise<CurriculumWithStaff[]> {
  const curRes = await supabase
    .from('program_curriculum')
    .select('*')
    .eq('program_id', programId)
    .eq('curriculum_type', curriculumType)
    .order('session_no', { ascending: true });

  if (curRes.error) {
    console.error('[curriculum-tab] 차시 조회 실패:', curRes.error.message);
    return [];
  }

  const rows = (curRes.data as ProgramCurriculum[] | null) ?? [];
  if (rows.length === 0) return [];
  const ids = rows.map((c) => c.id);

  const staffRes = await supabase
    .from('curriculum_staff')
    .select(
      '*, staff_pool:staff_pool(id,name,phone,email), profile:profiles(id,name,phone,email)',
    )
    .in('curriculum_id', ids)
    .order('created_at', { ascending: true });

  if (staffRes.error) {
    console.error('[curriculum-tab] 매칭 인력 조회 실패:', staffRes.error.message);
    return rows.map((c) => ({ ...c, staff: [] }));
  }

  const staffByCur: Record<string, MatchedStaffRow[]> = {};
  ((staffRes.data as StaffJoinRow[] | null) ?? []).forEach((s) => {
    const sp = pickOne(s.staff_pool);
    const pf = pickOne(s.profile);
    const sourceVal = staffSource(s);
    const name = sourceVal === 'external' ? sp?.name ?? '?' : pf?.name ?? '?';
    const phone = sourceVal === 'external' ? sp?.phone ?? null : pf?.phone ?? null;
    const email = sourceVal === 'external' ? sp?.email ?? null : pf?.email ?? null;
    (staffByCur[s.curriculum_id] ||= []).push({
      id: s.id,
      name,
      source: sourceVal,
      role: s.role,
      status: s.status,
      fee: s.fee ?? null,
      token: s.token,
      note: s.note ?? null,
      phone,
      email,
    });
  });

  return rows.map((c) => ({ ...c, staff: staffByCur[c.id] ?? [] }));
}

/** 시작·종료 시간으로 duration(분) 자동 계산 */
export function computeDuration(start: string | null, end: string | null): number | null {
  if (!start || !end) return null;
  const [sh, sm] = start.split(':').map(Number);
  const [eh, em] = end.split(':').map(Number);
  if ([sh, sm, eh, em].some((n) => Number.isNaN(n))) return null;
  const startMin = sh * 60 + sm;
  const endMin = eh * 60 + em;
  if (endMin <= startMin) return null;
  return endMin - startMin;
}

/** 'HH:MM:SS' / 'HH:MM' / null → 'HH:MM' */
export function trimTime(t: string | null | undefined): string {
  if (!t) return '';
  return t.slice(0, 5);
}

/** 'HH:MM' → 'HH:MM:00' (DB time 컬럼 호환) */
export function padTime(t: string | null): string | null {
  if (!t) return null;
  if (t.length === 5) return `${t}:00`;
  return t;
}
