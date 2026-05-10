// bal24 v2 — STEP-CURRICULUM-INSTRUCTOR-MATCH 강사명 → 인력풀 매칭 (v9 autoMatchInstructor 차용)

import { supabase } from './supabase';

export interface MatchedInstructor {
  staff_pool_id?: string | null;
  profile_id?: string | null;
  matched_name?: string | null;
  source: 'staff_pool' | 'profile' | 'none';
}

/** 단일 강사명 → 인력풀 매칭 (4단계 fallback. staff_pool 정확→profiles 정확→staff_pool ilike→profiles ilike) */
export async function matchInstructorByName(name: string): Promise<MatchedInstructor> {
  const trimmed = name?.trim() ?? '';
  if (!trimmed) return { source: 'none' };

  // 1) staff_pool 정확 일치
  const sp = await supabase.from('staff_pool').select('id, name').eq('name', trimmed).limit(1).maybeSingle();
  if (sp.data) return { staff_pool_id: sp.data.id, matched_name: sp.data.name, source: 'staff_pool' };

  // 2) profiles 정확 일치
  const pr = await supabase.from('profiles').select('id, name').eq('name', trimmed).limit(1).maybeSingle();
  if (pr.data) return { profile_id: pr.data.id, matched_name: pr.data.name, source: 'profile' };

  // 3) staff_pool ilike (부분 매칭)
  const spLike = await supabase.from('staff_pool').select('id, name').ilike('name', `%${trimmed}%`).limit(1).maybeSingle();
  if (spLike.data) return { staff_pool_id: spLike.data.id, matched_name: spLike.data.name, source: 'staff_pool' };

  // 4) profiles ilike
  const prLike = await supabase.from('profiles').select('id, name').ilike('name', `%${trimmed}%`).limit(1).maybeSingle();
  if (prLike.data) return { profile_id: prLike.data.id, matched_name: prLike.data.name, source: 'profile' };

  return { source: 'none' };
}

/** 다중 강사명 일괄 매칭 (이름 → MatchedInstructor) */
export async function matchInstructorsByNames(names: string[]): Promise<Map<string, MatchedInstructor>> {
  const map = new Map<string, MatchedInstructor>();
  const unique = [...new Set(names.map((n) => n?.trim()).filter(Boolean))];
  for (const n of unique) {
    map.set(n, await matchInstructorByName(n));
  }
  return map;
}

interface CurriculumStaffLink {
  curriculumId: string;
  match: MatchedInstructor;
}

/** 매칭된 강사 → curriculum_staff bulk INSERT (중복 체크 포함) */
export async function linkMatchedStaff(links: CurriculumStaffLink[]): Promise<{ inserted: number; skipped: number; error?: string }> {
  const valid = links.filter((l) => l.match.source !== 'none' && (l.match.staff_pool_id || l.match.profile_id));
  if (valid.length === 0) return { inserted: 0, skipped: 0 };

  const curriculumIds = [...new Set(valid.map((l) => l.curriculumId))];
  const exist = await supabase.from('curriculum_staff')
    .select('curriculum_id, staff_pool_id, profile_id').in('curriculum_id', curriculumIds);
  if (exist.error) {
    console.error('[instructor-match] 중복 조회 실패:', exist.error.message);
    return { inserted: 0, skipped: 0, error: exist.error.message };
  }

  const existSet = new Set((exist.data ?? []).map((e) =>
    `${e.curriculum_id}::${e.staff_pool_id ?? ''}::${e.profile_id ?? ''}`
  ));

  const rows = valid
    .map((l) => ({
      curriculum_id: l.curriculumId,
      staff_pool_id: l.match.staff_pool_id ?? null,
      profile_id: l.match.profile_id ?? null,
      role: '강사' as const,
    }))
    .filter((r) => !existSet.has(`${r.curriculum_id}::${r.staff_pool_id ?? ''}::${r.profile_id ?? ''}`));

  const skipped = valid.length - rows.length;
  if (rows.length === 0) return { inserted: 0, skipped };

  const { error } = await supabase.from('curriculum_staff').insert(rows);
  if (error) {
    console.error('[instructor-match] curriculum_staff INSERT 실패:', error.message);
    return { inserted: 0, skipped, error: error.message };
  }
  return { inserted: rows.length, skipped };
}
