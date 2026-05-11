// bal24 v2 — STEP-SURVEY-IMPORT
// xlsx 업로드 시 만족도 문항·응답을 survey_questions / survey_responses에 자동 등록
// 기존 스키마 (20260510_survey.sql) 호환: program_id 직접 참조, 응답은 문항당 1 row 정규화

import { supabase } from '../../../lib/supabase';

type QType = 'star' | 'text';

const TIMESTAMP_HEADERS = ['타임스탬프', '타임 스탬프', 'timestamp'];

function isTimestampHeader(h: string): boolean {
  const t = h.trim().toLowerCase();
  return TIMESTAMP_HEADERS.some((k) => t.includes(k.toLowerCase()));
}

/** 문항 유형 추론
 *  - 모든 비어있지 않은 응답이 1~5 숫자 → 'star' (점수형)
 *  - 그 외 (선택지/자유서술) → 'text'
 */
export function inferQuestionType(values: Array<string | number>): QType {
  const nonEmpty = values.filter((v) => v != null && String(v).trim() !== '');
  if (nonEmpty.length === 0) return 'text';
  const nums = nonEmpty.map((v) => Number(v)).filter((n) => Number.isFinite(n));
  if (nums.length === nonEmpty.length && nums.every((n) => n >= 1 && n <= 5)) return 'star';
  return 'text';
}

export interface ImportResult {
  ok: boolean;
  questionCount: number;
  responseCount: number;
  /** 컬럼 미존재·테이블 미존재 등 안내용 메시지 */
  warning?: string;
}

/**
 * xlsx에서 파싱된 rows를 받아 문항·응답을 자동 등록.
 * - 같은 programId에 기존 문항이 있으면 삭제 후 재등록 (덮어쓰기 — 한 프로그램 = 1 설문 정책)
 * - 응답 1개당 (문항 수)개의 row 생성
 *
 * @returns 등록된 문항·응답 카운트. 실패 시 ok=false + warning
 */
export async function importSurveyFromXlsx(
  programId: string,
  rows: Record<string, string | number>[],
): Promise<ImportResult> {
  if (rows.length === 0) return { ok: false, questionCount: 0, responseCount: 0, warning: '응답 데이터가 비어 있어요.' };

  // 1) 헤더 추출 + 타임스탬프 컬럼 제외
  const allHeaders = Object.keys(rows[0]);
  const questionHeaders = allHeaders.filter((h) => !isTimestampHeader(h));
  if (questionHeaders.length === 0) {
    return { ok: false, questionCount: 0, responseCount: 0, warning: '문항 열을 찾지 못했어요.' };
  }

  // 2) 기존 문항·응답 정리 (1 프로그램 = 1 설문 — 덮어쓰기)
  //    survey_responses는 FK CASCADE로 자동 삭제됨 (survey_questions ON DELETE CASCADE)
  const delRes = await supabase.from('survey_questions').delete().eq('program_id', programId);
  if (delRes.error) {
    const raw = (delRes.error.message ?? '').toLowerCase();
    if (raw.includes('does not exist') || raw.includes('pgrst205')) {
      return {
        ok: false, questionCount: 0, responseCount: 0,
        warning: 'survey_questions 테이블이 적용되지 않았어요. Supabase에서 20260510_survey.sql 실행 필요.',
      };
    }
    console.error('[survey-import] 기존 문항 삭제 실패:', delRes.error.message);
    return { ok: false, questionCount: 0, responseCount: 0, warning: '기존 설문 정리에 실패했어요.' };
  }

  // 3) 문항 INSERT (헤더 순서 = order_index)
  const questionPayload = questionHeaders.map((q, i) => {
    const colValues = rows.map((r) => r[q]).filter((v) => v != null) as Array<string | number>;
    return {
      program_id: programId,
      order_index: i,
      question_text: q,
      question_type: inferQuestionType(colValues),
      phase: 'post' as const,
    };
  });
  const qRes = await supabase.from('survey_questions').insert(questionPayload).select('id, order_index, question_type, question_text');
  if (qRes.error || !qRes.data) {
    console.error('[survey-import] 문항 INSERT 실패:', qRes.error?.message);
    return { ok: false, questionCount: 0, responseCount: 0, warning: '문항 등록에 실패했어요.' };
  }

  // 4) 응답 INSERT (응답자 × 문항)
  const insertedQs = qRes.data as Array<{ id: string; order_index: number; question_type: QType; question_text: string }>;
  const responsePayload: Array<Record<string, unknown>> = [];
  for (const row of rows) {
    for (const q of insertedQs) {
      const raw = row[q.question_text];
      if (raw == null || String(raw).trim() === '') continue;
      const asNum = Number(raw);
      const isScore = q.question_type === 'star' && Number.isFinite(asNum) && asNum >= 1 && asNum <= 5;
      responsePayload.push({
        program_id: programId,
        question_id: q.id,
        answer_score: isScore ? asNum : null,
        answer_text:  isScore ? null : String(raw).trim(),
        phase: 'post',
      });
    }
  }

  if (responsePayload.length === 0) {
    return { ok: true, questionCount: insertedQs.length, responseCount: 0 };
  }

  const rRes = await supabase.from('survey_responses').insert(responsePayload);
  if (rRes.error) {
    console.error('[survey-import] 응답 INSERT 실패:', rRes.error.message);
    return {
      ok: false,
      questionCount: insertedQs.length,
      responseCount: 0,
      warning: '응답 등록에 실패했어요.',
    };
  }

  return { ok: true, questionCount: insertedQs.length, responseCount: responsePayload.length };
}
