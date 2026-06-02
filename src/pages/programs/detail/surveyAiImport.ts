// 박경수님 2026-06-02 STEP-SURVEY-AI-IMPORT — 양식 파일(PDF·이미지) → AI → 설문 정의 자동 추출.
// V2 aiClient (Edge Function ai-chat) 사용. 명시 클릭 시만 호출 (자동 실행 금지).

import { callAiWithFile } from '../../../lib/aiClient';
import type { SurveyFormKind, SurveyFormQuestion, SurveyFormQuestionType } from '../../../types/database';

export interface ParsedSurvey {
  title: string;
  kind: SurveyFormKind;
  questions: SurveyFormQuestion[];
}

const AI_EXTRACT_SYSTEM = `당신은 한국어 설문 양식 분석가입니다.
첨부된 PDF·이미지 안의 설문 양식을 분석해서 JSON 으로만 반환합니다.
다른 텍스트(인사·설명·주석)는 절대 출력하지 않습니다.`;

const AI_EXTRACT_PROMPT = `이 문서의 설문 양식을 분석해서 다음 JSON 형태로만 반환하세요.

{
  "title": "설문 제목 (문서 상단의 큰 제목 그대로)",
  "kind": "pre-demand" | "mid" | "satisfaction" | "custom",
  "questions": [
    {
      "label": "문항 제목 (한국어 원문 그대로)",
      "type": "text" | "textarea" | "select" | "checkbox" | "number" | "date",
      "options": ["옵션1", "옵션2"],
      "required": true | false
    }
  ]
}

유형 매핑 규칙:
- 1줄 짧은 입력칸 → "text"
- 여러 줄 입력 / 의견·서술·건의사항 → "textarea"
- 드롭다운 / 라디오버튼 / 둘 중 하나 → "select"
- 체크박스 (복수 선택) → "checkbox"
- 숫자만 입력 → "number"
- 날짜 입력 → "date"
- 시간 입력 → "select" 로 변환 (예: options=["09:00","10:00","11:00","13:00","14:00","15:00"])

종류(kind) 매핑 규칙:
- 제목에 "사전" / "수요조사" / "신청" 포함 → "pre-demand"
- 제목에 "중간" 포함 → "mid"
- 제목에 "만족도" 포함 → "satisfaction"
- 그 외 → "custom"

세부 규칙:
- options 는 select / checkbox 일 때만 채우고, 그 외엔 생략하거나 빈 배열.
- 자동완성·계산 필드도 일단 "text" 로 처리.
- 1순위·2순위 같은 반복 그룹은 label 에 "6월 1순위 희망 날짜" 처럼 식별자 포함.
- * 표시·"필수" 라벨 → required: true.
- 제목·종류 모르겠으면 title="설문", kind="custom".

JSON 외 텍스트 금지. 마크다운 코드 블록 표시(\`\`\`) 도 금지. 순수 JSON 만 출력.`;

const ALLOWED_TYPES: SurveyFormQuestionType[] = ['text', 'textarea', 'select', 'checkbox', 'number', 'date'];
const ALLOWED_KINDS: SurveyFormKind[] = ['pre-demand', 'mid', 'satisfaction', 'custom'];

function genId(): string {
  return `q_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
}

/** 모델이 ``` 으로 감싸서 보내거나 prefix 가 붙는 경우 정리. */
function extractJsonString(raw: string): string {
  let t = raw.trim();
  // ```json ... ``` 또는 ``` ... ```
  const fence = t.match(/```(?:json)?\s*([\s\S]*?)\s*```/i);
  if (fence) t = fence[1].trim();
  // 첫 { 부터 마지막 } 까지
  const first = t.indexOf('{');
  const last = t.lastIndexOf('}');
  if (first >= 0 && last > first) return t.slice(first, last + 1);
  return t;
}

interface RawQuestion {
  label?: unknown;
  type?: unknown;
  options?: unknown;
  required?: unknown;
}

interface RawSurvey {
  title?: unknown;
  kind?: unknown;
  questions?: unknown;
}

function normalizeKind(v: unknown): SurveyFormKind {
  if (typeof v === 'string' && (ALLOWED_KINDS as string[]).includes(v)) return v as SurveyFormKind;
  return 'custom';
}

function normalizeType(v: unknown): SurveyFormQuestionType {
  if (typeof v === 'string' && (ALLOWED_TYPES as string[]).includes(v)) return v as SurveyFormQuestionType;
  return 'text';
}

function normalizeQuestion(raw: RawQuestion): SurveyFormQuestion | null {
  if (typeof raw.label !== 'string' || !raw.label.trim()) return null;
  const type = normalizeType(raw.type);
  const options = (type === 'select' || type === 'checkbox') && Array.isArray(raw.options)
    ? raw.options.filter((o): o is string => typeof o === 'string').map((s) => s.trim()).filter(Boolean)
    : undefined;
  return {
    id: genId(),
    label: raw.label.trim(),
    type,
    options,
    required: Boolean(raw.required),
  };
}

/** 양식 파일 1개 → AI → 설문 정의. 실패 시 throw. */
export async function importSurveyFromFile(file: File): Promise<ParsedSurvey> {
  const res = await callAiWithFile(file, AI_EXTRACT_PROMPT, 'curriculum-extract', {
    maxTokens: 4096,
    systemOverride: AI_EXTRACT_SYSTEM,
  });
  if (!res.ok || !res.text) {
    throw new Error(res.errorMessage ?? 'AI 응답이 비어 있어요.');
  }

  let parsed: RawSurvey;
  try {
    parsed = JSON.parse(extractJsonString(res.text)) as RawSurvey;
  } catch (err) {
    console.error('[surveyAiImport] JSON 파싱 실패:', err, 'raw:', res.text.slice(0, 300));
    throw new Error('AI 응답을 설문 형식으로 해석하지 못했어요. 양식을 더 명확한 파일로 다시 시도해 주세요.');
  }

  const title = typeof parsed.title === 'string' && parsed.title.trim() ? parsed.title.trim() : '설문';
  const kind = normalizeKind(parsed.kind);
  const rawQs = Array.isArray(parsed.questions) ? parsed.questions : [];
  const questions = rawQs
    .map((q) => normalizeQuestion(q as RawQuestion))
    .filter((q): q is SurveyFormQuestion => q !== null);

  if (questions.length === 0) {
    throw new Error('AI 가 문항을 1개도 추출하지 못했어요. 양식 이미지·PDF 가 흐리지 않은지 확인해 주세요.');
  }

  return { title, kind, questions };
}
