// bal24 v2 — STEP-APPLICATION-MGMT 신청자 관리 헬퍼 (PM)
// fetch / 단건 상태 변경 / 일괄 상태 변경 / MEMBER 초대.
// 박경수님 2026-06-02 STEP-RECRUIT-CUSTOM-QUESTIONS — 추가 질문·응답 집계 헬퍼.

import { supabase } from '../../../lib/supabase';
import type {
  ParticipantApplication, ParticipantStatus, AppQuestion,
} from '../../../types/application';

/** 박경수님 2026-06-02 — programs.application_questions 단건 조회. */
export async function fetchApplicationQuestions(programId: string): Promise<AppQuestion[]> {
  const { data, error } = await supabase
    .from('programs').select('application_questions').eq('id', programId).maybeSingle();
  if (error) {
    console.error('[applications] 추가 질문 조회 실패:', error.message);
    return [];
  }
  const raw = (data?.application_questions ?? []) as unknown;
  return Array.isArray(raw) ? (raw as AppQuestion[]) : [];
}

/** 박경수님 2026-06-02 — 신청자 행들에 대해 select 형 질문 응답 집계. (희망 일정 카운트 등) */
export function tallySelectAnswers(
  apps: ParticipantApplication[],
  question: AppQuestion,
): Record<string, number> {
  const tally: Record<string, number> = {};
  apps.forEach((a) => {
    const ans = (a.extra_answers ?? {})[question.id]?.trim() || '미응답';
    tally[ans] = (tally[ans] ?? 0) + 1;
  });
  return tally;
}

// ─── STEP-MEMBER-INVITE-REPORT — 합격자 MEMBER 초대 결과 타입 ───
export interface InviteAsMemberResult {
  success: boolean;
  alreadyInvited?: boolean;
  emailFailed?: boolean;
  inviteLink?: string;
  errorMessage?: string;
}

/**
 * 합격자 신청 정보를 받아 member_invitations 에 INSERT + send-invite Edge Function 호출.
 * 호출자가 토스트/상태 setter 처리 (UI 와 분리).
 */
export async function inviteAsMember(
  app: ParticipantApplication,
  invitedByUserId: string | null,
): Promise<InviteAsMemberResult> {
  if (!app.email) {
    return { success: false, errorMessage: '신청 시 이메일이 입력되지 않아 초대할 수 없어요.' };
  }
  const email = app.email.trim().toLowerCase();
  // 1) 중복 확인
  const { data: existing, error: existErr } = await supabase
    .from('member_invitations').select('id, status')
    .eq('email', email).is('deleted_at', null).maybeSingle();
  if (existErr) {
    console.error('[member-invite] 중복 확인 실패:', existErr.message);
    return { success: false, errorMessage: '초대 확인 중 오류가 발생했어요.' };
  }
  if (existing) {
    return { success: false, alreadyInvited: true, errorMessage: '이미 초대가 발송된 이메일이에요.' };
  }
  // 2) INSERT
  const { data: inv, error: invErr } = await supabase
    .from('member_invitations')
    .insert({ email, role: 'member', invited_by: invitedByUserId })
    .select('id, token').single();
  if (invErr || !inv) {
    const m = invErr?.message?.toLowerCase() ?? '';
    console.error('[member-invite] INSERT 실패:', invErr?.message);
    if (m.includes('row-level security') || m.includes('permission')) {
      return { success: false, errorMessage: '초대 권한이 없어요. ADMIN 만 초대할 수 있어요.' };
    }
    return { success: false, errorMessage: '초대 생성 중 오류가 발생했어요.' };
  }
  // 3) Edge Function 호출
  const row = inv as { id: string; token: string };
  const inviteLink = `${window.location.origin}/invite/member/${row.token}`;
  const { error: fnErr } = await supabase.functions.invoke('send-invite', {
    body: { invitation_id: row.id },
  });
  if (fnErr) {
    console.error('[member-invite] 이메일 발송 실패:', fnErr.message);
    return { success: true, emailFailed: true, inviteLink };
  }
  return { success: true, inviteLink };
}

export const PARTICIPANT_STATUS_VALUES: ParticipantStatus[] = [
  'applied', 'reviewing', 'accepted', 'rejected', 'withdrawn', 'completed',
];

export const PARTICIPANT_STATUS_LABELS: Record<ParticipantStatus, string> = {
  applied:   '신청',
  reviewing: '검토중',
  accepted:  '합격',
  rejected:  '탈락',
  withdrawn: '취소',
  completed: '수료',
};

export const PARTICIPANT_STATUS_TONE: Record<ParticipantStatus, string> = {
  applied:   'bg-slate-100 text-slate-700 border-slate-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  accepted:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-rose-50 text-rose-700 border-rose-200',
  withdrawn: 'bg-slate-50 text-slate-500 border-slate-200',
  completed: 'bg-cyan-50 text-cyan-700 border-cyan-200',
};

export async function fetchApplications(programId: string): Promise<ParticipantApplication[]> {
  const { data, error } = await supabase
    .from('participant_applications')
    .select('*')
    .eq('program_id', programId)
    .is('deleted_at', null)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[applications] 조회 실패:', error.message);
    return [];
  }
  return ((data ?? []) as ParticipantApplication[]);
}

export async function updateApplicationStatus(
  id: string,
  status: ParticipantStatus,
  reviewedBy: string | null,
): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('participant_applications')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    })
    .eq('id', id);
  if (error) {
    console.error('[applications] 상태 변경 실패:', error.message);
    const m = error.message.toLowerCase();
    if (m.includes('check') && m.includes('status')) {
      return { success: false, error: '허용되지 않은 상태 값이에요.' };
    }
    return { success: false, error: '상태 변경에 실패했어요.' };
  }
  return { success: true };
}

export async function bulkUpdateStatus(
  ids: string[],
  status: ParticipantStatus,
  reviewedBy: string | null,
): Promise<{ success: boolean; updatedCount: number; error?: string }> {
  if (ids.length === 0) return { success: true, updatedCount: 0 };
  const { error, count } = await supabase
    .from('participant_applications')
    .update({
      status,
      reviewed_by: reviewedBy,
      reviewed_at: new Date().toISOString(),
      updated_at: new Date().toISOString(),
    }, { count: 'exact' })
    .in('id', ids);
  if (error) {
    console.error('[applications] 일괄 상태 변경 실패:', error.message);
    return { success: false, updatedCount: 0, error: '일괄 상태 변경에 실패했어요.' };
  }
  return { success: true, updatedCount: count ?? ids.length };
}

/**
 * 신청자별 평균 평가 점수 (application_type='evaluation' 일 때만 의미).
 * applicationIds 가 비어 있으면 빈 Map 반환.
 */
export async function fetchAvgScores(
  applicationIds: string[],
): Promise<Map<string, { avg: number; count: number }>> {
  const result = new Map<string, { avg: number; count: number }>();
  if (applicationIds.length === 0) return result;

  const { data, error } = await supabase
    .from('evaluation_scores')
    .select('application_id, score, program_evaluator_id')
    .in('application_id', applicationIds);
  if (error) {
    console.error('[applications] 점수 조회 실패:', error.message);
    return result;
  }

  type Row = { application_id: string; score: number; program_evaluator_id: string };
  const grouped = new Map<string, { sum: number; evaluatorSet: Set<string> }>();
  ((data ?? []) as Row[]).forEach((r) => {
    const cur = grouped.get(r.application_id) ?? { sum: 0, evaluatorSet: new Set<string>() };
    cur.sum += Number(r.score);
    cur.evaluatorSet.add(r.program_evaluator_id);
    grouped.set(r.application_id, cur);
  });

  grouped.forEach((v, key) => {
    const count = v.evaluatorSet.size;
    const avg = count > 0 ? v.sum / count : 0;
    result.set(key, { avg: Math.round(avg * 10) / 10, count });
  });
  return result;
}
