// bal24 v2 — STEP-INSTRUCTOR-INVITE-A 강사 프로필 자동채우기·인력풀 검색·상태 배지

import { callAi, callAiWithFile } from './aiClient';
import { fileToText, classifyFile } from './fileToText';
import { supabase } from './supabase';
import type { InvitationStatus } from '../types/database';

export interface ExtractedInstructorProfile {
  real_name?: string;
  phone?: string;
  email?: string;
  bio?: string;
  bank_name?: string;
  bank_account?: string;
  bank_holder?: string;
}

const SYSTEM_PROMPT = `이력서·명함·프로필 문서에서 강사 정보를 JSON 하나로만 반환합니다.
필드. real_name(이름), phone(연락처), email, bio(약력 3문장 이내), bank_name(은행명), bank_account(계좌번호), bank_holder(예금주).
없는 항목=null. JSON만 반환.`;

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

/** 이력서·명함 → 강사 프로필 자동 추출 (PDF/이미지 멀티모달, 그 외 fileToText) */
export async function extractInstructorFromFile(file: File): Promise<ExtractedInstructorProfile> {
  const kind = classifyFile(file);
  try {
    if (kind !== 'unknown') {
      const doc = await fileToText(file);
      if (!doc?.text) return {};
      const trimmed = trimText(doc.text);
      const res = await callAi({
        preset: 'curriculum-extract',
        systemOverride: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: trimmed }],
        maxTokens: 1024,
      });
      if (!res.ok || !res.text) return {};
      return safeParse<ExtractedInstructorProfile>(res.text, {});
    }
    const res = await callAiWithFile(
      file,
      '이 문서에서 강사 정보를 추출해 JSON 하나만 반환해 주세요.',
      'curriculum-extract',
      { systemOverride: SYSTEM_PROMPT, maxTokens: 1024 },
    );
    if (!res.ok || !res.text) return {};
    return safeParse<ExtractedInstructorProfile>(res.text, {});
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[instructor-profile] 자동채우기 실패:', raw);
    return {};
  }
}

/** 추출된 프로필을 폼 setter에 매핑 (채워진 항목 수 반환) */
export interface InstructorProfileSetters {
  setRealName: (v: string) => void;
  setPhone: (v: string) => void;
  setEmail: (v: string) => void;
  setBio: (v: string) => void;
  setBankName: (v: string) => void;
  setBankAccount: (v: string) => void;
  setBankHolder: (v: string) => void;
}

export function applyExtractedInstructor(
  prof: ExtractedInstructorProfile,
  s: InstructorProfileSetters,
): number {
  let count = 0;
  if (prof.real_name)    { s.setRealName(prof.real_name);       count += 1; }
  if (prof.phone)        { s.setPhone(prof.phone);              count += 1; }
  if (prof.email)        { s.setEmail(prof.email);              count += 1; }
  if (prof.bio)          { s.setBio(prof.bio);                  count += 1; }
  if (prof.bank_name)    { s.setBankName(prof.bank_name);       count += 1; }
  if (prof.bank_account) { s.setBankAccount(prof.bank_account); count += 1; }
  if (prof.bank_holder)  { s.setBankHolder(prof.bank_holder);   count += 1; }
  return count;
}

/** 인력풀(profiles) 검색 — 이름·이메일 포함 매칭 (최대 8건) */
export interface InstructorPoolEntry {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
}

export async function searchInstructorPool(query: string): Promise<InstructorPoolEntry[]> {
  const q = query.trim();
  if (q.length < 1) return [];
  try {
    const pattern = `%${q}%`;
    const { data, error } = await supabase
      .from('profiles')
      .select('id, name, email, phone')
      .or(`name.ilike.${pattern},email.ilike.${pattern}`)
      .limit(8);
    if (error) {
      console.error('[instructor-profile] 인력풀 검색 실패:', error.message);
      return [];
    }
    return (data ?? []) as InstructorPoolEntry[];
  } catch (err) {
    const raw = err instanceof Error ? err.message : '';
    console.error('[instructor-profile] 인력풀 검색 예외:', raw);
    return [];
  }
}

/** 초대 상태 → 배지 라벨·className */
export function getInviteStatusBadge(status: InvitationStatus): { label: string; className: string } {
  switch (status) {
    case '대기': return { label: '대기 중', className: 'bg-amber-100 text-amber-800' };
    case '수락': return { label: '수락',    className: 'bg-emerald-100 text-emerald-800' };
    case '거절': return { label: '거절',    className: 'bg-red-100 text-red-700' };
    case '완료': return { label: '완료',    className: 'bg-blue-100 text-blue-700' };
    default:     return { label: '대기 중', className: 'bg-gray-100 text-gray-600' };
  }
}
