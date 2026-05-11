// bal24 v2 — STEP-V1-SPLIT-FULL
// 커리큘럼 DB 호출 순수 함수 (CurriculumTab 분리 — toast/setState는 호출부 책임)

import { supabase } from '../../../lib/supabase';
import type { CurriculumType, ProgramCurriculum } from '../../../types/database';
import type { CurriculumWithStaff } from './curriculum/curriculumTabUtils';

export type AddErrorKind = 'column' | 'rls' | 'general';

export interface AddResult {
  ok: true; data: ProgramCurriculum;
}
export interface AddFailure {
  ok: false; kind: AddErrorKind;
}

/** 차시 신규 INSERT — 실패 시 에러 종류 분류 반환 */
export async function dbAddCurriculum(
  programId: string,
  curriculumType: CurriculumType,
  nextNo: number,
): Promise<AddResult | AddFailure> {
  const { data, error } = await supabase
    .from('program_curriculum')
    .insert({
      program_id: programId,
      session_no: nextNo,
      curriculum_type: curriculumType,
      title: '',
      content: '',
    })
    .select('*')
    .maybeSingle();
  if (error || !data) {
    const raw = (error?.message ?? '').toLowerCase();
    console.error('[curriculum-handlers] 차시 추가 실패:', error?.message);
    const kind: AddErrorKind = raw.includes('column') && raw.includes('does not exist')
      ? 'column'
      : raw.includes('row-level security') || raw.includes('permission denied')
        ? 'rls' : 'general';
    return { ok: false, kind };
  }
  return { ok: true, data: data as ProgramCurriculum };
}

/** planned → actual 복사. 성공 시 복사된 차시 수 반환, 실패 시 null */
export async function dbCopyPlannedToActual(programId: string): Promise<number | null> {
  const planned = await supabase.from('program_curriculum').select('*')
    .eq('program_id', programId).eq('curriculum_type', 'planned').order('session_no');
  if (planned.error || !planned.data) {
    console.error('[curriculum-handlers] planned 조회 실패:', planned.error?.message);
    return null;
  }
  const rows = planned.data as ProgramCurriculum[];
  if (rows.length === 0) return 0;
  const insertRows = rows.map((r) => ({
    program_id: programId, session_no: r.session_no, title: r.title,
    content: r.content ?? null, day_label: r.day_label ?? null,
    start_time: r.start_time ?? null, end_time: r.end_time ?? null,
    instructor_name_raw: r.instructor_name_raw ?? null, curriculum_type: 'actual' as const,
  }));
  const ins = await supabase.from('program_curriculum').insert(insertRows);
  if (ins.error) {
    console.error('[curriculum-handlers] actual 복사 실패:', ins.error.message);
    return null;
  }
  return rows.length;
}

/** 두 차시의 session_no swap — unique 충돌 회피 3단계 update */
export async function dbSwapSessionNo(
  aId: string, aNo: number, bId: string, bNo: number,
): Promise<boolean> {
  const tmp = -Math.abs(aNo) - 100000;
  const upd = (id: string, no: number) =>
    supabase.from('program_curriculum').update({ session_no: no }).eq('id', id);
  for (const [id, no] of [[aId, tmp], [bId, aNo], [aId, bNo]] as Array<[string, number]>) {
    const r = await upd(id, no);
    if (r.error) {
      console.error('[curriculum-handlers] swap 실패:', r.error.message);
      return false;
    }
  }
  return true;
}

/** 단일 차시 update */
export async function dbSaveCurriculum(id: string, patch: Partial<ProgramCurriculum>): Promise<boolean> {
  const { error } = await supabase.from('program_curriculum').update(patch).eq('id', id);
  if (error) {
    console.error('[curriculum-handlers] 차시 저장 실패:', error.message);
    return false;
  }
  return true;
}

/** 단일 차시 삭제 */
export async function dbRemoveCurriculum(id: string): Promise<boolean> {
  const { error } = await supabase.from('program_curriculum').delete().eq('id', id);
  if (error) {
    console.error('[curriculum-handlers] 차시 삭제 실패:', error.message);
    return false;
  }
  return true;
}

/** 드래그 정렬 결과 일괄 저장 — 실패 시 첫 실패 id 반환 */
export async function dbPersistOrder(reordered: CurriculumWithStaff[]): Promise<string | null> {
  for (let i = 0; i < reordered.length; i += 1) {
    const c = reordered[i];
    if (c.session_no === i + 1) continue;
    const { error } = await supabase
      .from('program_curriculum')
      .update({ session_no: i + 1 })
      .eq('id', c.id);
    if (error) {
      console.error('[curriculum-handlers] 순서 저장 실패:', error.message);
      return c.id;
    }
  }
  return null;
}
