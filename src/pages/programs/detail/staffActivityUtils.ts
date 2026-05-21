// bal24 v2 — STEP-STAFF-ASSIGNMENT-FEE
// 강사 활동 fetch + UNION (instructor_invitations + curriculum_staff) + 강사료 매칭

import { supabase } from '../../../lib/supabase';
import { calculateFee } from './staffFeeUtils';
import type { InvitationStatus } from '../../../types/database';
import type { StaffFee } from '../../../types/staffFee';

export interface CurriculumLite {
  id: string;
  session_no: number;
  title: string;
  session_date: string | null;
  day_label: string | null;
  start_time: string | null;
  end_time: string | null;
  is_completed: boolean;
  actual_instructor_id: string | null;
  /** 이 차시에 배정된 강사 식별 (sourceType 분기) */
  staff_pool_id: string | null;
  profile_id: string | null;
  instructor_name_raw: string | null;
}

/** 강사 1명을 식별하는 키 */
export interface StaffKey {
  staff_pool_id: string | null;
  profile_id: string | null;
  instructor_name_raw: string | null;
}

export interface StaffActivity extends StaffKey {
  name: string;
  organization: string | null;
  /** instructor_invitations 행이 있다면 그 상태 */
  invitationStatus: InvitationStatus | null;
  invitationId: string | null;
  staffPortalToken: string | null;
  mentorInviteToken: string | null;
  /** 이 강사가 담당한 차시 목록 */
  curriculums: CurriculumLite[];
  /** 일치하는 program_staff_fees 행 (단가·세율 등) */
  feeRule: StaffFee | null;
  /** 완료된 차시 수 (curriculums 중 is_completed=true) */
  completedCount: number;
  /** 실제 강의 기준 강사료 계산 */
  calcGross: number;
  calcTax: number;
  calcNet: number;
  /** 멘토링 일지 카운트 */
  mentoringLogCount: number;
}

function staffKeyOf(k: StaffKey): string {
  // STEP-INSTRUCTOR-MATCH-FIX — ID 우선 매칭 (이름 차이로 인한 중복 방지)
  if (k.staff_pool_id) return `pool:${k.staff_pool_id}`;
  if (k.profile_id) return `prof:${k.profile_id}`;
  return `raw:${(k.instructor_name_raw ?? '').trim()}`;
}

/** UNION: instructor_invitations + curriculum_staff → 강사 활동 목록 */
export async function fetchStaffActivity(programId: string): Promise<StaffActivity[]> {
  // 1) 차시 전체 (program_curriculum)
  const { data: curRaw, error: curErr } = await supabase
    .from('program_curriculum')
    .select('id, session_no, title, session_date, day_label, start_time, end_time, is_completed, actual_instructor_id')
    .eq('program_id', programId)
    .order('session_no', { ascending: true });
  if (curErr) {
    console.error('[staff-activity] 차시 조회 실패:', curErr.message);
  }
  const curMap = new Map<string, Omit<CurriculumLite, 'staff_pool_id' | 'profile_id' | 'instructor_name_raw'>>();
  (curRaw ?? []).forEach((r) => {
    curMap.set(r.id as string, {
      id: r.id as string,
      session_no: Number(r.session_no ?? 0),
      title: (r.title as string) ?? '',
      session_date: (r.session_date as string | null) ?? null,
      day_label: (r.day_label as string | null) ?? null,
      start_time: (r.start_time as string | null) ?? null,
      end_time: (r.end_time as string | null) ?? null,
      is_completed: Boolean(r.is_completed),
      actual_instructor_id: (r.actual_instructor_id as string | null) ?? null,
    });
  });

  // 2) curriculum_staff (강사 ↔ 차시) — 차시가 이 프로그램에 속한 것만
  const curIds = Array.from(curMap.keys());
  let csRows: Array<{
    curriculum_id: string;
    staff_pool_id: string | null;
    profile_id: string | null;
    instructor_name_raw: string | null;
  }> = [];
  if (curIds.length > 0) {
    const { data, error } = await supabase
      .from('curriculum_staff')
      .select('curriculum_id, staff_pool_id, profile_id, instructor_name_raw')
      .in('curriculum_id', curIds);
    if (error) console.error('[staff-activity] curriculum_staff 조회 실패:', error.message);
    csRows = (data ?? []) as typeof csRows;
  }

  // 3) instructor_invitations (이 프로그램의)
  const { data: invRaw, error: invErr } = await supabase.from('instructor_invitations')
    .select('id, name, status, staff_pool_id, profile_id, instructor_name_raw')
    .eq('program_id', programId);
  if (invErr) console.error('[staff-activity] 초대 조회 실패:', invErr.message);
  type InvRow = {
    id: string; name: string; status: InvitationStatus;
    staff_pool_id: string | null; profile_id: string | null;
    instructor_name_raw: string | null;
  };
  const invRows = ((invRaw ?? []) as InvRow[]);

  // 4) 강사 ID 집합 수집 (staff_pool + profiles)
  const allPoolIds = new Set<string>();
  const allProfIds = new Set<string>();
  csRows.forEach((r) => {
    if (r.staff_pool_id) allPoolIds.add(r.staff_pool_id);
    if (r.profile_id) allProfIds.add(r.profile_id);
  });
  invRows.forEach((r) => {
    if (r.staff_pool_id) allPoolIds.add(r.staff_pool_id);
    if (r.profile_id) allProfIds.add(r.profile_id);
  });

  // 5) staff_pool / profiles 이름·소속·포털토큰 fetch
  const poolInfo = new Map<string, { name: string; organization: string | null; token: string | null }>();
  if (allPoolIds.size > 0) {
    const { data, error } = await supabase.from('staff_pool')
      .select('id, name, organization, staff_portal_token')
      .in('id', Array.from(allPoolIds));
    if (error) console.warn('[staff-activity] staff_pool 조회 경고:', error.message);
    (data ?? []).forEach((r) => {
      poolInfo.set(r.id as string, {
        name: (r.name as string) ?? '',
        organization: (r.organization as string | null) ?? null,
        token: (r.staff_portal_token as string | null) ?? null,
      });
    });
  }
  const profInfo = new Map<string, { name: string; department: string | null; token: string | null }>();
  if (allProfIds.size > 0) {
    const { data, error } = await supabase.from('profiles')
      .select('id, name, department, staff_portal_token')
      .in('id', Array.from(allProfIds));
    if (error) console.warn('[staff-activity] profiles 조회 경고:', error.message);
    (data ?? []).forEach((r) => {
      profInfo.set(r.id as string, {
        name: (r.name as string) ?? '',
        department: (r.department as string | null) ?? null,
        token: (r.staff_portal_token as string | null) ?? null,
      });
    });
  }

  // 6) program_staff_fees (강사별 단가·세율)
  const { data: feeRaw } = await supabase.from('program_staff_fees')
    .select('*').eq('program_id', programId);
  type FeeRow = StaffFee & { /* expert·profile join 없음 */ };
  const feeRules = (feeRaw ?? []) as FeeRow[];
  const feeByPool = new Map<string, StaffFee>();
  const feeByProf = new Map<string, StaffFee>();
  feeRules.forEach((f) => {
    if (f.expert_id) feeByPool.set(f.expert_id, f);
    if (f.profile_id) feeByProf.set(f.profile_id, f);
  });

  // 7) 멘토링 일지 카운트 (mentoring_assignments → mentoring_logs)
  const logsByPool = new Map<string, number>();
  const logsByProf = new Map<string, number>();
  const { data: asn } = await supabase.from('mentoring_assignments')
    .select('id, mentor_pool_id, mentor_profile_id, mentor_invite_token')
    .eq('program_id', programId);
  type AsnRow = { id: string; mentor_pool_id: string | null; mentor_profile_id: string | null; mentor_invite_token: string | null };
  const asnRows = (asn ?? []) as AsnRow[];
  const inviteTokenByPool = new Map<string, string>();
  const inviteTokenByProf = new Map<string, string>();
  asnRows.forEach((a) => {
    if (a.mentor_pool_id && a.mentor_invite_token) inviteTokenByPool.set(a.mentor_pool_id, a.mentor_invite_token);
    if (a.mentor_profile_id && a.mentor_invite_token) inviteTokenByProf.set(a.mentor_profile_id, a.mentor_invite_token);
  });
  const asnIds = asnRows.map((a) => a.id);
  if (asnIds.length > 0) {
    const { data: logs, error } = await supabase.from('mentoring_logs')
      .select('assignment_id').in('assignment_id', asnIds);
    if (error) {
      const m = (error.message ?? '').toLowerCase();
      if (!m.includes('does not exist') && !m.includes('pgrst205')) {
        console.warn('[staff-activity] mentoring_logs 경고:', error.message);
      }
    } else {
      const cntByAsn = new Map<string, number>();
      (logs ?? []).forEach((l) => {
        const k = (l as { assignment_id: string }).assignment_id;
        cntByAsn.set(k, (cntByAsn.get(k) ?? 0) + 1);
      });
      asnRows.forEach((a) => {
        const c = cntByAsn.get(a.id) ?? 0;
        if (a.mentor_pool_id) logsByPool.set(a.mentor_pool_id, (logsByPool.get(a.mentor_pool_id) ?? 0) + c);
        if (a.mentor_profile_id) logsByProf.set(a.mentor_profile_id, (logsByProf.get(a.mentor_profile_id) ?? 0) + c);
      });
    }
  }

  // 8) 강사별 그룹핑 (UNION)
  const byKey = new Map<string, StaffActivity>();

  // 8-1) curriculum_staff 기반 강사
  csRows.forEach((cs) => {
    const key = staffKeyOf(cs);
    const cur = curMap.get(cs.curriculum_id);
    if (!cur) return;
    const item: CurriculumLite = {
      ...cur,
      staff_pool_id: cs.staff_pool_id,
      profile_id: cs.profile_id,
      instructor_name_raw: cs.instructor_name_raw,
    };
    let existing = byKey.get(key);
    if (!existing) {
      const pName = cs.staff_pool_id ? poolInfo.get(cs.staff_pool_id)?.name : null;
      const profName = cs.profile_id ? profInfo.get(cs.profile_id)?.name : null;
      const name = pName ?? profName ?? cs.instructor_name_raw ?? '이름 없음';
      const organization =
        (cs.staff_pool_id ? poolInfo.get(cs.staff_pool_id)?.organization : null) ??
        (cs.profile_id ? profInfo.get(cs.profile_id)?.department : null) ??
        null;
      existing = {
        staff_pool_id: cs.staff_pool_id, profile_id: cs.profile_id,
        instructor_name_raw: cs.instructor_name_raw,
        name, organization,
        invitationStatus: null, invitationId: null,
        staffPortalToken: (cs.staff_pool_id ? poolInfo.get(cs.staff_pool_id)?.token : null)
          ?? (cs.profile_id ? profInfo.get(cs.profile_id)?.token : null) ?? null,
        mentorInviteToken: (cs.staff_pool_id ? inviteTokenByPool.get(cs.staff_pool_id) : null)
          ?? (cs.profile_id ? inviteTokenByProf.get(cs.profile_id) : null) ?? null,
        curriculums: [],
        feeRule: (cs.staff_pool_id ? feeByPool.get(cs.staff_pool_id) : null)
          ?? (cs.profile_id ? feeByProf.get(cs.profile_id) : null) ?? null,
        completedCount: 0, calcGross: 0, calcTax: 0, calcNet: 0,
        mentoringLogCount: (cs.staff_pool_id ? logsByPool.get(cs.staff_pool_id) ?? 0 : 0)
          + (cs.profile_id ? logsByProf.get(cs.profile_id) ?? 0 : 0),
      };
      byKey.set(key, existing);
    }
    existing.curriculums.push(item);
  });

  // 8-2) 초대만 있고 curriculum_staff에는 없는 강사 (예: 초빙 대기 상태)
  invRows.forEach((inv) => {
    const key = staffKeyOf({
      staff_pool_id: inv.staff_pool_id,
      profile_id: inv.profile_id,
      instructor_name_raw: inv.instructor_name_raw,
    });
    let existing = byKey.get(key);
    if (!existing) {
      const pName = inv.staff_pool_id ? poolInfo.get(inv.staff_pool_id)?.name : null;
      const profName = inv.profile_id ? profInfo.get(inv.profile_id)?.name : null;
      const name = pName ?? profName ?? inv.name ?? inv.instructor_name_raw ?? '이름 없음';
      const organization =
        (inv.staff_pool_id ? poolInfo.get(inv.staff_pool_id)?.organization : null) ??
        (inv.profile_id ? profInfo.get(inv.profile_id)?.department : null) ??
        null;
      existing = {
        staff_pool_id: inv.staff_pool_id, profile_id: inv.profile_id,
        instructor_name_raw: inv.instructor_name_raw,
        name, organization,
        invitationStatus: inv.status, invitationId: inv.id,
        staffPortalToken: (inv.staff_pool_id ? poolInfo.get(inv.staff_pool_id)?.token : null)
          ?? (inv.profile_id ? profInfo.get(inv.profile_id)?.token : null) ?? null,
        mentorInviteToken: (inv.staff_pool_id ? inviteTokenByPool.get(inv.staff_pool_id) : null)
          ?? (inv.profile_id ? inviteTokenByProf.get(inv.profile_id) : null) ?? null,
        curriculums: [],
        feeRule: (inv.staff_pool_id ? feeByPool.get(inv.staff_pool_id) : null)
          ?? (inv.profile_id ? feeByProf.get(inv.profile_id) : null) ?? null,
        completedCount: 0, calcGross: 0, calcTax: 0, calcNet: 0,
        mentoringLogCount: (inv.staff_pool_id ? logsByPool.get(inv.staff_pool_id) ?? 0 : 0)
          + (inv.profile_id ? logsByProf.get(inv.profile_id) ?? 0 : 0),
      };
      byKey.set(key, existing);
    } else if (!existing.invitationStatus) {
      existing.invitationStatus = inv.status;
      existing.invitationId = inv.id;
    }
  });

  // 9) 완료 차시 수·강사료 계산
  const result: StaffActivity[] = [];
  byKey.forEach((entry) => {
    entry.completedCount = entry.curriculums.filter((c) => c.is_completed).length;
    if (entry.feeRule) {
      const unit = Number(entry.feeRule.unit_price ?? 0);
      const gross = entry.feeRule.input_mode === 'total'
        ? Number(entry.feeRule.gross_amount ?? 0)
        : unit * entry.completedCount;
      const calc = calculateFee(gross, entry.feeRule.tax_type);
      entry.calcGross = calc.grossAmount;
      entry.calcTax = calc.taxAmount;
      entry.calcNet = calc.netAmount;
    }
    result.push(entry);
  });

  // 이름 가나다순 정렬
  result.sort((a, b) => a.name.localeCompare(b.name, 'ko'));
  return result;
}

/** 차시 완료 토글 */
export async function setCurriculumCompleted(
  curriculumId: string, isCompleted: boolean,
): Promise<boolean> {
  const { error } = await supabase.from('program_curriculum')
    .update({ is_completed: isCompleted }).eq('id', curriculumId);
  if (error) {
    console.error('[staff-activity] 완료 토글 실패:', error.message);
    return false;
  }
  return true;
}

/** 실제 강의자 변경 */
export async function setActualInstructor(
  curriculumId: string, actualInstructorId: string | null,
): Promise<boolean> {
  const { error } = await supabase.from('program_curriculum')
    .update({ actual_instructor_id: actualInstructorId }).eq('id', curriculumId);
  if (error) {
    console.error('[staff-activity] 실제 강의자 변경 실패:', error.message);
    return false;
  }
  return true;
}
