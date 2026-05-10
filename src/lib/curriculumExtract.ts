// bal24 v2 — STEP-CURRICULUM-AI-INLINE 차시 전용 AI 추출 (programAutoFill 분리)

import { callAi, callAiWithFile } from './aiClient';
import { fileToText, classifyFile } from './fileToText';
import type { ExtractedSession } from './programAutoFill';

const SYSTEM_PROMPT = `문서에서 커리큘럼 차시 목록을 JSON 배열로만 반환합니다.
각 항목.
- title (필수, 차시 제목)
- day_label ("1일차" 같은 표시)
- start_time (HH:MM)
- end_time (HH:MM)
- instructor_names (해당 차시 강사 이름 배열, 없으면 [])
- mentor_names (해당 차시 멘토 이름 배열, 없으면 []. "전체 강사" 같은 표현은 ["전체"]로 표기)
- content (강의 내용·진행 방식 200자 이내, 없으면 null, 추측 금지)
없는 항목=null 또는 []. JSON 배열만 반환. 최대 100개.`;

const TEXT_LIMIT = 5000;

function trimText(t: string): string {
  if (t.length <= TEXT_LIMIT) return t;
  return `${t.slice(0, 3500)}\n\n... (중략) ...\n\n${t.slice(t.length - 500)}`;
}

function normalizeArr(v: unknown): string[] {
  if (Array.isArray(v)) return v.map((x) => String(x ?? '').trim()).filter(Boolean);
  if (typeof v === 'string' && v.trim()) return [v.trim()];
  return [];
}

function normalizeSession(s: unknown): ExtractedSession {
  const r = (s ?? {}) as Partial<ExtractedSession> & { instructor_name?: string };
  const instructorNames = normalizeArr(r.instructor_names);
  const fromSingle = r.instructor_name?.trim() ? [r.instructor_name.trim()] : [];
  return {
    title: String(r.title ?? '').trim(),
    day_label: r.day_label?.trim() || undefined,
    start_time: r.start_time?.trim() || undefined,
    end_time: r.end_time?.trim() || undefined,
    content: r.content?.trim() || undefined,
    instructor_names: instructorNames.length > 0 ? instructorNames : fromSingle,
    mentor_names: normalizeArr(r.mentor_names),
  };
}

function safeParse(raw: string): ExtractedSession[] {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  const tryJson = (s: string): ExtractedSession[] => {
    try {
      const r = JSON.parse(s);
      return Array.isArray(r) ? r.map(normalizeSession) : [];
    } catch { return []; }
  };
  const direct = tryJson(cleaned);
  if (direct.length > 0) return direct;
  const i = cleaned.indexOf('[');
  return i >= 0 ? tryJson(cleaned.slice(i)) : [];
}

/** 문서 → 커리큘럼 차시 배열 (PDF/이미지 멀티모달, 그 외 fileToText) */
export async function extractSessionsFromDocument(file: File): Promise<ExtractedSession[]> {
  const kind = classifyFile(file);
  // STEP-UX-FIXES — PDF·이미지·unknown 모두 멀티모달 경로(callAiWithFile)로
  const isMultimodal = kind === 'pdf' || kind === 'image' || kind === 'unknown';
  try {
    if (!isMultimodal) {
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
