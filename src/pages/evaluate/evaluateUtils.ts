// bal24 v2 — STEP-EVALUATION-SYSTEM 외부 평가 포털 헬퍼 (anon)

import { supabase } from '../../lib/supabase';
import type {
  ProgramEvaluator, EvaluatorStatus, EvaluationScore,
} from '../../types/database';

function pickOne<T>(value: T | T[] | null | undefined): T | null {
  if (!value) return null;
  if (Array.isArray(value)) return value[0] ?? null;
  return value;
}

export interface EvaluatorContext {
  evaluator: ProgramEvaluator;
  programName: string | null;
  evaluatorName: string | null;
}

interface JoinedRow extends ProgramEvaluator {
  programs: { name: string | null } | { name: string | null }[] | null;
  staff_pool: { name: string | null } | { name: string | null }[] | null;
}

export async function fetchEvaluatorByToken(token: string): Promise<EvaluatorContext | null> {
  const { data, error } = await supabase
    .from('program_evaluators')
    .select(`
      *,
      programs(name),
      staff_pool!staff_pool_id(name)
    `)
    .eq('eval_token', token)
    .maybeSingle();
  if (error) {
    console.error('[evaluate] 토큰 조회 실패:', error.message);
    return null;
  }
  if (!data) return null;
  const row = data as JoinedRow;
  return {
    evaluator: row,
    programName: pickOne(row.programs)?.name ?? null,
    evaluatorName: pickOne(row.staff_pool)?.name ?? null,
  };
}

export interface ApplicantRow {
  id: string;
  name: string;
  organization?: string | null;
  motivation?: string | null;
  status?: string | null;
}

export async function fetchApplicants(programId: string): Promise<ApplicantRow[]> {
  const { data, error } = await supabase
    .from('participant_applications')
    .select('id, name, organization, motivation, status')
    .eq('program_id', programId)
    .in('status', ['applied', 'reviewing'])
    .order('created_at');
  if (error) {
    console.error('[evaluate] 신청자 조회 실패:', error.message);
    return [];
  }
  return ((data ?? []) as ApplicantRow[]);
}

export async function fetchExistingScores(
  evaluatorId: string,
  applicationIds: string[],
): Promise<EvaluationScore[]> {
  if (applicationIds.length === 0) return [];
  const { data, error } = await supabase
    .from('evaluation_scores')
    .select('*')
    .eq('program_evaluator_id', evaluatorId)
    .in('application_id', applicationIds);
  if (error) {
    console.error('[evaluate] 기존 점수 조회 실패:', error.message);
    return [];
  }
  return ((data ?? []) as EvaluationScore[]);
}

export interface ScoreUpsertPayload {
  evaluatorId: string;
  applicationId: string;
  category: string;
  score: number;
  maxScore: number;
  comment?: string;
}

export async function upsertScore(p: ScoreUpsertPayload): Promise<{ success: boolean; error?: string }> {
  const { error } = await supabase
    .from('evaluation_scores')
    .upsert({
      program_evaluator_id: p.evaluatorId,
      application_id: p.applicationId,
      category: p.category,
      score: p.score,
      max_score: p.maxScore,
      comment: p.comment ?? null,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'program_evaluator_id,application_id,category' });
  if (error) {
    console.error('[evaluate] 점수 저장 실패:', error.message);
    return { success: false, error: '점수 저장 중 오류가 발생했어요.' };
  }
  return { success: true };
}

export async function setEvaluatorStatus(
  evaluatorId: string,
  status: EvaluatorStatus,
): Promise<boolean> {
  const now = new Date().toISOString();
  const updates: Record<string, unknown> = { status, updated_at: now };
  if (status === 'accepted') updates.accepted_at = now;
  const { error } = await supabase
    .from('program_evaluators')
    .update(updates)
    .eq('id', evaluatorId);
  if (error) {
    console.error('[evaluate] 상태 변경 실패:', error.message);
    return false;
  }
  return true;
}
