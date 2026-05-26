// bal24 v2 — STEP-EXPERTS-UI-REFINE (박경수님 2026-05-26)
// 전문가 카드 — 최근 참여 프로그램 배치 fetch.
// 3개 소스 통합 (curriculum_staff 강사 + mentoring_assignments 멘토 + instructor_invitations 초청).
// staff_pool_id 기준 일괄 fetch 후 staff 별 최신 3개로 그룹핑.

import { supabase } from '../../lib/supabase';

export interface ExpertProgramRef {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

interface ProgramRow {
  id: string;
  name: string;
  start_date: string | null;
  end_date: string | null;
  status: string | null;
}

type StaffProgramPair = { staff_id: string; program_id: string };

/** 여러 강사의 최근 참여 프로그램 (각자 최대 3개) 일괄 조회. */
export async function fetchRecentProgramsForExperts(
  staffPoolIds: string[],
): Promise<Map<string, ExpertProgramRef[]>> {
  const result = new Map<string, ExpertProgramRef[]>();
  if (staffPoolIds.length === 0) return result;

  const pairs: StaffProgramPair[] = [];

  // 1) curriculum_staff — 강사 (program_id 없음 → curriculum 통해 매핑)
  const { data: cs, error: csErr } = await supabase
    .from('curriculum_staff')
    .select('staff_pool_id, curriculum_id')
    .in('staff_pool_id', staffPoolIds);
  if (csErr) console.warn('[expertPrograms] curriculum_staff:', csErr.message);
  const csRows = ((cs ?? []) as Array<{ staff_pool_id: string; curriculum_id: string }>);
  if (csRows.length > 0) {
    const curIds = Array.from(new Set(csRows.map((r) => r.curriculum_id)));
    const { data: pc } = await supabase
      .from('program_curriculum')
      .select('id, program_id')
      .in('id', curIds);
    const curToProg = new Map(((pc ?? []) as Array<{ id: string; program_id: string }>).map((r) => [r.id, r.program_id]));
    csRows.forEach((r) => {
      const progId = curToProg.get(r.curriculum_id);
      if (progId) pairs.push({ staff_id: r.staff_pool_id, program_id: progId });
    });
  }

  // 2) mentoring_assignments — 멘토 (program_id 직접)
  const { data: ma, error: maErr } = await supabase
    .from('mentoring_assignments')
    .select('mentor_pool_id, program_id')
    .in('mentor_pool_id', staffPoolIds)
    .not('program_id', 'is', null);
  if (maErr) console.warn('[expertPrograms] mentoring_assignments:', maErr.message);
  ((ma ?? []) as Array<{ mentor_pool_id: string; program_id: string }>).forEach((r) => {
    if (r.program_id) pairs.push({ staff_id: r.mentor_pool_id, program_id: r.program_id });
  });

  // 3) instructor_invitations — 초청 (program_id 직접)
  const { data: inv, error: invErr } = await supabase
    .from('instructor_invitations')
    .select('staff_pool_id, program_id')
    .in('staff_pool_id', staffPoolIds)
    .not('program_id', 'is', null);
  if (invErr) console.warn('[expertPrograms] instructor_invitations:', invErr.message);
  ((inv ?? []) as Array<{ staff_pool_id: string; program_id: string }>).forEach((r) => {
    if (r.program_id) pairs.push({ staff_id: r.staff_pool_id, program_id: r.program_id });
  });

  if (pairs.length === 0) return result;

  // 4) programs 일괄 fetch (start_date 내림차순)
  const allProgIds = Array.from(new Set(pairs.map((p) => p.program_id)));
  const { data: programs, error: pErr } = await supabase
    .from('programs')
    .select('id, name, start_date, end_date, status')
    .in('id', allProgIds)
    .is('deleted_at', null)
    .order('start_date', { ascending: false, nullsFirst: false });
  if (pErr) {
    console.error('[expertPrograms] programs:', pErr.message);
    return result;
  }
  const progMap = new Map(((programs ?? []) as ProgramRow[]).map((p) => [p.id, p]));

  // 5) staff 별 그룹핑 (중복 제거 후 최신 3개)
  pairs.forEach((pair) => {
    const prog = progMap.get(pair.program_id);
    if (!prog) return;
    const existing = result.get(pair.staff_id) ?? [];
    // 중복 (같은 프로그램 중복 참여 — 강사+멘토 겸직 등) 제거
    if (existing.some((p) => p.id === prog.id)) return;
    if (existing.length >= 3) return;
    existing.push(prog);
    result.set(pair.staff_id, existing);
  });

  return result;
}
