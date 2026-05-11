// bal24 v2 — STEP-AUTOFILL 프로그램 자동채우기 + 일괄 추출
// fileText (또는 File) 입력 → AI(JSON) → ExtractedProgram(s)

import { callAi, callAiWithFile } from './aiClient';
import { fileToText, classifyFile } from './fileToText';
import { supabase } from './supabase';

export type ExtractedProgramType = 'education' | 'mentoring' | 'event' | 'report';

export interface ExtractedSession {
  day_label?: string;
  start_time?: string;
  end_time?: string;
  title: string;
  /** @deprecated 단일 강사 (역호환). 신규는 instructor_names 사용. */
  instructor_name?: string;
  /** STEP-CURRICULUM-MULTI-INSTRUCTOR — 강사 다중 (역할 '강사') */
  instructor_names?: string[];
  /** STEP-CURRICULUM-MULTI-INSTRUCTOR — 멘토 다중 (역할 '멘토') */
  mentor_names?: string[];
  /** STEP-CURRICULUM-INSTRUCTOR-MATCH — 강의 내용·진행 방식 */
  content?: string;
}

export interface ExtractedProgram {
  name?: string;
  description?: string;
  start_date?: string;
  end_date?: string;
  location?: string;
  max_participants?: number;
  target_audience?: string;
  client_org?: string;
  department?: string;
  outcomes?: string;
  program_type?: ExtractedProgramType;
  sessions?: ExtractedSession[];
  // STEP-AUTOFILL-PHASE-DATES — 외부공유 4단계 시작일 (program_share 테이블에 저장)
  pre_date?: string;       // 모집·홍보 시작일 (공고일·접수 시작일 등)
  ready_date?: string;     // 교육 전 안내 시작일 (OT일·오리엔테이션일·사전교육일 등)
  progress_date?: string;  // 교육 시작일 (1일차·운영 시작일)
  result_date?: string;    // 결과 단계 시작일 (종료일 다음날·수료식일·결과보고일 등)
}

const SINGLE_SYSTEM_PROMPT = `문서에서 교육/사업 프로그램 정보를 JSON 하나로만 반환합니다.
필드. name(제목), description(목표 3문장 이내), start_date(YYYY-MM-DD), end_date, location(장소), max_participants(숫자), target_audience, client_org(기관명), department(부서), outcomes(성과목표), program_type(education|mentoring|event|report), sessions[](day_label, start_time HH:MM, end_time HH:MM, title 필수, instructor_name).
외부공유 4단계 시작일(YYYY-MM-DD).
- pre_date: 모집·홍보 시작일 (공고일, 모집 시작일, 접수 시작일)
- ready_date: 교육 전 안내 시작일 (OT일, 오리엔테이션일, 사전교육일)
- progress_date: 교육 시작일 (프로그램 시작일, 운영 시작일, 1일차)
- result_date: 교육 종료 후 시작일 (종료일 다음날, 수료식일, 결과보고일)
없는 항목=null. JSON만 반환.`;

const BULK_SYSTEM_PROMPT = `문서에서 독립적인 프로그램/행사 목록을 JSON 배열로 반환합니다.
각 항목. name(필수), start_date, end_date, program_type(education|mentoring|event|report), description.
최대 20개. JSON 배열만 반환.`;

const TEXT_LIMIT = 5000;

function trimText(t: string): string {
  if (t.length <= TEXT_LIMIT) return t;
  return `${t.slice(0, 3500)}\n\n... (중략) ...\n\n${t.slice(t.length - 500)}`;
}

function safeParse<T>(raw: string, fallback: T): T {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try {
    return JSON.parse(cleaned) as T;
  } catch {
    const first = cleaned.search(/[{[]/);
    if (first >= 0) {
      try {
        return JSON.parse(cleaned.slice(first)) as T;
      } catch {
        return fallback;
      }
    }
    return fallback;
  }
}

/** 단일 프로그램 추출 (텍스트 입력) */
export async function extractProgramFromDocument(fileText: string): Promise<ExtractedProgram> {
  if (!fileText.trim()) return {};
  const trimmed = trimText(fileText);
  try {
    const res = await callAi({
      preset: 'curriculum-extract',
      systemOverride: SINGLE_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: trimmed }],
      maxTokens: 2048,
    });
    if (!res.ok || !res.text) return {};
    return safeParse<ExtractedProgram>(res.text, {});
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[program-autofill] 단일 추출 실패:', raw);
    return {};
  }
}

/** 다중 프로그램 추출 (텍스트 입력) */
export async function extractBulkPrograms(fileText: string): Promise<ExtractedProgram[]> {
  if (!fileText.trim()) return [];
  const trimmed = trimText(fileText);
  try {
    const res = await callAi({
      preset: 'curriculum-extract',
      systemOverride: BULK_SYSTEM_PROMPT,
      messages: [{ role: 'user', content: trimmed }],
      maxTokens: 4096,
    });
    if (!res.ok || !res.text) return [];
    const parsed = safeParse<unknown>(res.text, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 20) as ExtractedProgram[];
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[program-autofill] 다중 추출 실패:', raw);
    return [];
  }
}

/** File → 자동 분기 (DOCX/CSV/XLSX/TEXT = fileToText, PDF/이미지 = 멀티모달) */
export async function extractProgramFromFile(file: File): Promise<ExtractedProgram> {
  // STEP-UX-FIXES — PDF·이미지는 멀티모달 경로(callAiWithFile)로
  const kind = classifyFile(file);
  if (kind !== 'unknown' && kind !== 'pdf' && kind !== 'image') {
    const doc = await fileToText(file);
    return doc?.text ? extractProgramFromDocument(doc.text) : {};
  }
  try {
    const res = await callAiWithFile(
      file,
      '문서에서 프로그램 정보를 추출해 JSON 하나만 반환해 주세요.',
      'curriculum-extract',
      { systemOverride: SINGLE_SYSTEM_PROMPT, maxTokens: 2048 },
    );
    if (!res.ok || !res.text) return {};
    return safeParse<ExtractedProgram>(res.text, {});
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[program-autofill] 파일 단일 추출 실패:', raw);
    return {};
  }
}

/** File → 다중 추출 자동 분기 */
export async function extractBulkProgramsFromFile(file: File): Promise<ExtractedProgram[]> {
  // STEP-UX-FIXES — PDF·이미지는 멀티모달 경로(callAiWithFile)로
  const kind = classifyFile(file);
  if (kind !== 'unknown' && kind !== 'pdf' && kind !== 'image') {
    const doc = await fileToText(file);
    return doc?.text ? extractBulkPrograms(doc.text) : [];
  }
  try {
    const res = await callAiWithFile(
      file,
      '문서에서 프로그램·행사 목록을 추출해 JSON 배열만 반환해 주세요.',
      'curriculum-extract',
      { systemOverride: BULK_SYSTEM_PROMPT, maxTokens: 4096 },
    );
    if (!res.ok || !res.text) return [];
    const parsed = safeParse<unknown>(res.text, []);
    if (!Array.isArray(parsed)) return [];
    return parsed.slice(0, 20) as ExtractedProgram[];
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[program-autofill] 파일 다중 추출 실패:', raw);
    return [];
  }
}

/** ExtractedProgram → 폼 state setter 매핑 (채워진 항목 수 반환) */
export interface PhaseDatesPatch {
  pre_date?: string;
  ready_date?: string;
  progress_date?: string;
  result_date?: string;
}

export interface ProgramAutoFillTarget {
  setName: (v: string) => void;
  setDescription: (v: string) => void;
  setStartDate: (v: string) => void;
  setEndDate: (v: string) => void;
  setVenue: (v: string) => void;
  setProgramType: (v: ExtractedProgramType) => void;
  setOrg: (patch: { client_org?: string; department?: string; target_audience?: string; max_participants?: number }) => void;
  /** STEP-PROGRAM-DASHBOARD — AI 추출 차시 보관 (저장 시 program_curriculum bulk INSERT) */
  setPendingSessions?: (sessions: ExtractedSession[]) => void;
  /** STEP-AUTOFILL-PHASE-DATES — 외부공유 4단계 시작일 (저장 시 program_share upsert) */
  setPhaseDates?: (patch: PhaseDatesPatch) => void;
}

export function applyExtractedProgram(prog: ExtractedProgram, target: ProgramAutoFillTarget): number {
  let count = 0;
  if (prog.name)         { target.setName(prog.name);                 count += 1; }
  if (prog.description)  { target.setDescription(prog.description);   count += 1; }
  if (prog.start_date)   { target.setStartDate(prog.start_date);      count += 1; }
  if (prog.end_date)     { target.setEndDate(prog.end_date);          count += 1; }
  if (prog.location)     { target.setVenue(prog.location);            count += 1; }
  if (prog.program_type) { target.setProgramType(prog.program_type);  count += 1; }
  const orgPatch: { client_org?: string; department?: string; target_audience?: string; max_participants?: number } = {};
  if (prog.client_org)         { orgPatch.client_org = prog.client_org;             count += 1; }
  if (prog.department)         { orgPatch.department = prog.department;             count += 1; }
  if (prog.target_audience)    { orgPatch.target_audience = prog.target_audience;   count += 1; }
  if (prog.max_participants != null) { orgPatch.max_participants = prog.max_participants; count += 1; }
  if (Object.keys(orgPatch).length > 0) target.setOrg(orgPatch);
  if (prog.sessions && prog.sessions.length > 0) {
    target.setPendingSessions?.(prog.sessions);
    count += prog.sessions.length;
  }
  // STEP-AUTOFILL-PHASE-DATES — 4 단계 시작일 매핑
  const phasePatch: PhaseDatesPatch = {};
  if (prog.pre_date)      { phasePatch.pre_date = prog.pre_date;           count += 1; }
  if (prog.ready_date)    { phasePatch.ready_date = prog.ready_date;       count += 1; }
  if (prog.progress_date) { phasePatch.progress_date = prog.progress_date; count += 1; }
  if (prog.result_date)   { phasePatch.result_date = prog.result_date;     count += 1; }
  // STEP-SHARE-DATE-FIX — AI가 progress_date를 못 뽑았으면 start_date로 보완
  // (pre_date / ready_date / result_date는 직접 매칭 가능한 단서 없음 → null 유지)
  if (!phasePatch.progress_date && prog.start_date) {
    phasePatch.progress_date = prog.start_date;
  }
  if (Object.keys(phasePatch).length > 0) target.setPhaseDates?.(phasePatch);
  return count;
}

/** STEP-AUTOFILL-PHASE-DATES + STEP-SHARE-DATE-FIX
 *  AI 추출 4단계 시작일을 program_share에 안전 저장.
 *  1단계: row가 없으면 seed 생성 (program_id만으로 upsert + ignoreDuplicates)
 *  2단계: 날짜만 UPDATE (NOT NULL 컬럼 미터치 — token·visibility 등 영향 없음)
 */
export async function upsertProgramSharePhaseDates(
  programId: string, phaseDates: PhaseDatesPatch,
): Promise<void> {
  if (Object.keys(phaseDates).length === 0) return;

  // 1단계 — seed (row 없으면 INSERT, 있으면 ignore)
  const seedRes = await supabase
    .from('program_share')
    .upsert({ program_id: programId }, { onConflict: 'program_id', ignoreDuplicates: true });
  if (seedRes.error) {
    console.warn('[program-share] seed 생성 실패:', seedRes.error.message);
    return;
  }

  // 2단계 — 날짜만 UPDATE
  const payload: Record<string, string | null> = {};
  for (const k of ['pre_date', 'ready_date', 'progress_date', 'result_date'] as const) {
    const v = phaseDates[k];
    payload[k] = (v && v.trim()) ? v : null;
  }
  const { error } = await supabase
    .from('program_share')
    .update({ ...payload, updated_at: new Date().toISOString() })
    .eq('program_id', programId);
  if (error) console.warn('[program-share] AI 단계 날짜 저장 실패:', error.message);
}

/** STEP-PROGRAM-DASHBOARD — AI 추출 차시를 program_curriculum 에 bulk INSERT */
export async function insertPendingSessions(
  programId: string, sessions: ExtractedSession[],
): Promise<{ ok: boolean; error?: string }> {
  if (sessions.length === 0) return { ok: true };
  const rows = sessions.map((s, idx) => {
    const row: Record<string, unknown> = {
      program_id: programId,
      session_no: idx + 1,
      title: s.title?.trim() || `${idx + 1}차시`,
    };
    if (s.day_label?.trim())  row.day_label  = s.day_label.trim();
    if (s.start_time?.trim()) row.start_time = s.start_time.trim();
    if (s.end_time?.trim())   row.end_time   = s.end_time.trim();
    return row;
  });
  const { error } = await supabase.from('program_curriculum').insert(rows);
  if (error) {
    console.error('[program-autofill] 차시 bulk INSERT 실패:', error.message, '| rows:', rows);
    return { ok: false, error: error.message };
  }
  return { ok: true };
}
