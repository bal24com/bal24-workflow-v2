// bal24 v2 — STEP-CURRICULUM-AI-INLINE 차시 전용 AI 추출 (programAutoFill 분리)

import { callAi, callAiWithFile } from './aiClient';
import { fileToText, classifyFile } from './fileToText';
import type { ExtractedSession } from './programAutoFill';

const SYSTEM_PROMPT = `문서에서 커리큘럼 차시 목록을 JSON 배열로만 반환합니다.
각 항목. title(필수, 차시 제목), day_label("1일차" 같은 표시), start_time(HH:MM), end_time(HH:MM), instructor_name(강사명), content(강의 내용·진행 방식 200자 이내).
없는 항목=null. 추측 금지. JSON 배열만 반환. 최대 100개.`;

const TEXT_LIMIT = 5000;

function trimText(t: string): string {
  if (t.length <= TEXT_LIMIT) return t;
  return `${t.slice(0, 3500)}\n\n... (중략) ...\n\n${t.slice(t.length - 500)}`;
}

function safeParse(raw: string): ExtractedSession[] {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    const r = JSON.parse(cleaned);
    return Array.isArray(r) ? (r as ExtractedSession[]) : [];
  } catch {
    const i = cleaned.indexOf('[');
    if (i < 0) return [];
    try {
      const r = JSON.parse(cleaned.slice(i));
      return Array.isArray(r) ? (r as ExtractedSession[]) : [];
    } catch {
      return [];
    }
  }
}

/** 문서 → 커리큘럼 차시 배열 (PDF/이미지 멀티모달, 그 외 fileToText) */
export async function extractSessionsFromDocument(file: File): Promise<ExtractedSession[]> {
  const kind = classifyFile(file);
  try {
    if (kind !== 'unknown') {
      const doc = await fileToText(file);
      if (!doc?.text) return [];
      const trimmed = trimText(doc.text);
      const res = await callAi({
        preset: 'curriculum-extract',
        systemOverride: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmed }],
        maxTokens: 4096,
      });
      if (!res.ok || !res.text) return [];
      return safeParse(res.text).filter((s) => s.title?.trim()).slice(0, 100);
    }
    const res = await callAiWithFile(
      file,
      '문서에서 커리큘럼 차시 목록을 JSON 배열로 반환해 주세요.',
      'curriculum-extract',
      { systemOverride: SYSTEM_PROMPT, maxTokens: 4096 },
    );
    if (!res.ok || !res.text) return [];
    return safeParse(res.text).filter((s) => s.title?.trim()).slice(0, 100);
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[curriculum-extract] 추출 실패:', raw);
    return [];
  }
}
