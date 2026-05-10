// bal24 v2 — STEP-EVALUATION-SYSTEM PM 측 헬퍼
// 평가위원 fetch + 추가 + 평가 완료(→ program_staff_fees 자동 INSERT) + 점수 집계.

import { supabase } from '../../../lib/supabase';
import type { ProgramEvaluator, EvaluatorFeeType } from '../../../types/database';

/** 카테고리 3종 고정 (외부 평가 포털과 동일) */
export const EVALUATION_CATEGORIES = [
  { key: '사업계획 및 아이디어', max: 30 },
  { key: '실현가능성',           max: 40 },
  { key: '발표 태도',            max: 30 },
] as const;
export const EVALUATION_TOTAL_MAX = 100;

export interface EvaluatorRow extends ProgramEvaluator {
  staff_pool?: { id: string; name: string; email: string | null } | null;
}

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export async function fetchEvaluators(programId: string): Promise<EvaluatorRow[]> {
  const { data, error } = await supabase
    .from('program_evaluators')
    .select(`
      *,
      staff_pool:staff_pool!staff_pool_id(id, name, email)
    `)
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[evaluator] 목록 조회 실패:', error.message);
    return [];
  }
  type Row = ProgramEvaluator & { staff_pool: { id: string; name: string; email: string | null } | { id: string; name: string; email: string | null }[] | null };
  return ((data ?? []) as Row[]).map((row) => ({
    ...row,
    staff_pool: pickOne(row.staff_pool),
  }));
}

export interface AddEvaluatorPayload {
  programId: string;
  staffPoolId: string;
  feeAmount: number;
  feeType: EvaluatorFeeType;
  note?: string;
  createdBy: string | null;
}

export async function addEvaluator(p: AddEvaluatorPayload): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase.from('program_evaluators').insert({
    program_id: p.programId,
    staff_pool_id: p.staffPoolId,
    fee_amount: p.feeAmount,
    fee_type: p.feeType,
    note: p.note?.trim() || null,
    created_by: p.createdBy,
  });
  if (error) {
    const m = error.message.toLowerCase();
    console.error('[evaluator] 추가 실패:', error.message);
    if (m.includes('duplicate') || m.includes('unique')) {
      return { success: false, error: '이미 등록된 평가위원이에요.' };
    }
    if (m.includes('row-level security') || m.includes('permission')) {
      return { success: false, error: '평가위원 추가 권한이 없어요.' };
    }
    return { success: false, error: '평가위원 추가 중 오류가 발생했어요.' };
  }
  return { success: true };
}

export async function deleteEvaluator(id: string): Promise<boolean> {
  const { error } = await supabase.from('program_evaluators').delete().eq('id', id);
  if (error) {
    console.error('[evaluator] 삭제 실패:', error.message);
    return false;
  }
  return true;
}

/**
 * 평가 완료 처리: status='completed' + program_staff_fees 자동 INSERT.
 * 이미 staff_fee 가 연결돼 있으면 INSERT 스킵.
 */
export async function completeEvaluator(
  evaluator: EvaluatorRow,
  feeDescriptionPrefix = '평가위원료',
): Promise<{ success: boolean; error?: string }> {
  const now = new Date().toISOString();
  // 1) status='completed'
  const { error: updError } = await supabase
    .from('program_evaluators')
    .update({ status: 'completed', completed_at: now, updated_at: now })
    .eq('id', evaluator.id);
  if (updError) {
    console.error('[evaluator] 완료 처리 실패:', updError.message);
    return { success: false, error: '평가 완료 처리에 실패했어요.' };
  }
  // 2) program_staff_fees 자동 INSERT (외부 전문가 = expert_id)
  const description = evaluator.staff_pool?.name
    ? `${feeDescriptionPrefix} · ${evaluator.staff_pool.name}`
    : feeDescriptionPrefix;
  const { error: feeError } = await supabase.from('program_staff_fees').insert({
    program_id: evaluator.program_id,
    expert_id: evaluator.staff_pool_id,
    fee_type: 'consulting', // staff_fee 의 fee_type enum (활동 유형)
    description,
    input_mode: 'total',
    gross_amount: evaluator.fee_amount,
    tax_type: evaluator.fee_type, // '3.3'|'8.8'|'면세'
    payment_status: '미지급',
  });
  if (feeError) {
    const m = feeError.message.toLowerCase();
    console.error('[evaluator] staff_fee 생성 실패:', feeError.message);
    if (m.includes('duplicate') || m.includes('unique')) {
      // 이미 존재 — 무시 가능
      return { success: true };
    }
    return { success: false, error: '평가완료는 됐지만 강사료 등록에 실패했어요. 관리자에게 문의해 주세요.' };
  }
  return { success: true };
}

/** 신청자별 평균 점수 집계 */
export interface ApplicationScoreSummary {
  application_id: string;
  applicant_name: string | null;
  avg_score: number;
  evaluator_count: number;
  total_max: number;
}

export async function fetchScoreSummary(
  programId: string,
): Promise<ApplicationScoreSummary[]> {
  // 1) 평가위원 ID 목록
  const { data: evals, error: evalErr } = await supabase
    .from('program_evaluators')
    .select('id')
    .eq('program_id', programId);
  if (evalErr) {
    console.error('[evaluator] 평가위원 ID 조회 실패:', evalErr.message);
    return [];
  }
  const evaluatorIds = (evals ?? []).map((e: { id: string }) => e.id);
  if (evaluatorIds.length === 0) return [];

  // 2) 모든 점수 fetch
  const { data: scores, error: scoreErr } = await supabase
    .from('evaluation_scores')
    .select('application_id, score, max_score, program_evaluator_id')
    .in('program_evaluator_id', evaluatorIds);
  if (scoreErr) {
    console.error('[evaluator] 점수 조회 실패:', scoreErr.message);
    return [];
  }

  // 3) 신청자별 그룹핑
  type ScoreRow = { application_id: string; score: number; max_score: number; program_evaluator_id: string };
  const byApp = new Map<string, { totalScore: number; totalMax: number; evaluatorSet: Set<string> }>();
  ((scores ?? []) as ScoreRow[]).forEach((s) => {
    const cur = byApp.get(s.application_id) ?? { totalScore: 0, totalMax: 0, evaluatorSet: new Set<string>() };
    cur.totalScore += Number(s.score);
    cur.totalMax += Number(s.max_score);
    cur.evaluatorSet.add(s.program_evaluator_id);
    byApp.set(s.application_id, cur);
  });

  // 4) applicant 이름 fetch
  const appIds = Array.from(byApp.keys());
  if (appIds.length === 0) return [];
  const { data: apps, error: appErr } = await supabase
    .from('participant_applications')
    .select('id, name')
    .in('id', appIds);
  if (appErr) {
    console.error('[evaluator] 신청자 조회 실패:', appErr.message);
  }
  const nameMap = new Map<string, string>();
  ((apps ?? []) as { id: string; name: string | null }[]).forEach((a) => {
    if (a.name) nameMap.set(a.id, a.name);
  });

  // 5) 결과 정렬 (avg desc)
  const result: ApplicationScoreSummary[] = appIds.map((id) => {
    const cur = byApp.get(id);
    const evaluatorCount = cur?.evaluatorSet.size ?? 0;
    const avg = cur && evaluatorCount > 0 ? cur.totalScore / evaluatorCount : 0;
    return {
      application_id: id,
      applicant_name: nameMap.get(id) ?? null,
      avg_score: Math.round(avg * 10) / 10,
      evaluator_count: evaluatorCount,
      total_max: cur?.totalMax ?? 0,
    };
  });
  result.sort((a, b) => b.avg_score - a.avg_score);
  return result;
}

/** 평가 링크 생성 */
export function buildEvalUrl(token: string): string {
  if (typeof window === 'undefined') return `/evaluate/${token}`;
  return `${window.location.origin}/evaluate/${token}`;
}
