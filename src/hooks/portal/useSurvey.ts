// 설문 시스템 데이터 훅 — program_surveys / survey_questions / survey_responses.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL PART D.

import { supabase } from '../../lib/supabase';
import type { Survey, SurveyQuestion, SurveyResponse } from '../../types/schoolPortal';

/** 설문 신규 생성 — 인증 사용자 (PM) */
export async function createSurvey(payload: Partial<Survey>): Promise<{ data?: Survey; error?: string }> {
  if (!payload.title?.trim()) return { error: '설문 제목을 입력해 주세요.' };
  const { data, error } = await supabase
    .from('program_surveys')
    .insert({
      project_id: payload.project_id ?? null,
      program_id: payload.program_id ?? null,
      title: payload.title.trim(),
      description: payload.description ?? null,
      target_scope: payload.target_scope ?? 'team',
      survey_type: payload.survey_type ?? 'satisfaction',
      is_active: payload.is_active ?? true,
      due_date: payload.due_date ?? null,
      created_by: payload.created_by ?? null,
    })
    .select('*')
    .single<Survey>();
  if (error || !data) {
    console.error('[createSurvey] 실패:', error?.message);
    return { error: '설문 생성에 실패했어요.' };
  }
  return { data };
}

/** 설문 활성/비활성 토글 */
export async function toggleSurveyActive(surveyId: string, isActive: boolean): Promise<{ error?: string }> {
  const { error } = await supabase
    .from('program_surveys')
    .update({ is_active: isActive })
    .eq('id', surveyId);
  if (error) {
    console.error('[toggleSurveyActive] 실패:', error.message);
    return { error: '설문 상태 변경에 실패했어요.' };
  }
  return {};
}

/** 문항 추가 */
export async function addQuestion(
  surveyId: string,
  q: Partial<SurveyQuestion>,
): Promise<{ data?: SurveyQuestion; error?: string }> {
  if (!q.question_text?.trim()) return { error: '문항 내용을 입력해 주세요.' };
  const { data, error } = await supabase
    .from('survey_questions')
    .insert({
      survey_id: surveyId,
      question_text: q.question_text.trim(),
      question_type: q.question_type ?? 'rating',
      options: q.options ?? [],
      is_required: q.is_required ?? true,
      order_index: q.order_index ?? 0,
    })
    .select('*')
    .single<SurveyQuestion>();
  if (error || !data) {
    console.error('[addQuestion] 실패:', error?.message);
    return { error: '문항 추가에 실패했어요.' };
  }
  return { data };
}

/** 문항 삭제 */
export async function deleteQuestion(questionId: string): Promise<{ error?: string }> {
  const { error } = await supabase.from('survey_questions').delete().eq('id', questionId);
  if (error) {
    console.error('[deleteQuestion] 실패:', error.message);
    return { error: '문항 삭제에 실패했어요.' };
  }
  return {};
}

/** 응답 제출 — anon 허용 */
export async function submitResponse(args: {
  surveyId: string;
  portalToken: string | null;
  respondentName: string;
  answers: Record<string, unknown>;
}): Promise<{ error?: string }> {
  if (!args.respondentName.trim()) return { error: '응답자 이름을 입력해 주세요.' };
  const { error } = await supabase.from('survey_responses').insert({
    survey_id: args.surveyId,
    portal_token: args.portalToken,
    respondent_name: args.respondentName.trim(),
    answers: args.answers,
  });
  if (error) {
    console.error('[submitResponse] 실패:', error.message);
    return { error: '응답 제출에 실패했어요. 잠시 후 다시 시도해 주세요.' };
  }
  return {};
}

/** 설문 결과 — 문항 + 응답 묶음 */
export async function getSurveyResults(surveyId: string): Promise<{
  questions: SurveyQuestion[];
  responses: SurveyResponse[];
}> {
  const [qRes, rRes] = await Promise.all([
    supabase.from('survey_questions').select('*').eq('survey_id', surveyId).order('order_index'),
    supabase.from('survey_responses').select('*').eq('survey_id', surveyId).order('submitted_at', { ascending: false }),
  ]);
  if (qRes.error) console.error('[getSurveyResults] questions:', qRes.error.message);
  if (rRes.error) console.error('[getSurveyResults] responses:', rRes.error.message);
  return {
    questions: (qRes.data ?? []) as SurveyQuestion[],
    responses: (rRes.data ?? []) as SurveyResponse[],
  };
}

/** 단일 설문 + 문항 (응답 폼용) */
export async function getSurveyForResponse(surveyId: string): Promise<{
  survey: Survey | null;
  questions: SurveyQuestion[];
  error?: string;
}> {
  const [sRes, qRes] = await Promise.all([
    supabase.from('program_surveys').select('*').eq('id', surveyId).eq('is_active', true).maybeSingle<Survey>(),
    supabase.from('survey_questions').select('*').eq('survey_id', surveyId).order('order_index'),
  ]);
  if (sRes.error || !sRes.data) {
    return { survey: null, questions: [], error: '설문이 없거나 종료됐어요.' };
  }
  if (qRes.error) console.error('[getSurveyForResponse] questions:', qRes.error.message);
  return { survey: sRes.data, questions: (qRes.data ?? []) as SurveyQuestion[] };
}

/** 프로그램별 설문 목록 */
export async function getSurveysByProgram(programId: string): Promise<Survey[]> {
  const { data, error } = await supabase
    .from('program_surveys')
    .select('*')
    .eq('program_id', programId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getSurveysByProgram] 실패:', error.message);
    return [];
  }
  return (data ?? []) as Survey[];
}

/** 프로젝트별 설문 목록 (교육지원청 포털용) */
export async function getSurveysByProject(projectId: string): Promise<Survey[]> {
  const { data, error } = await supabase
    .from('program_surveys')
    .select('*')
    .eq('project_id', projectId)
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[getSurveysByProject] 실패:', error.message);
    return [];
  }
  return (data ?? []) as Survey[];
}

/** 응답 수 카운트 (응답률 계산용) */
export async function countResponses(surveyId: string): Promise<number> {
  const { count, error } = await supabase
    .from('survey_responses')
    .select('id', { count: 'exact', head: true })
    .eq('survey_id', surveyId);
  if (error) {
    console.error('[countResponses] 실패:', error.message);
    return 0;
  }
  return count ?? 0;
}
