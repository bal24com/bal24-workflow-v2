// bal24 v2 — STEP-APPLICATION-FORM 신청 폼 검증·제출 헬퍼
// 신청 기간·중복·INSERT 를 한 곳에 모음. ApplyPage 의 V-1 (400줄) 여유 확보.

import { supabase } from '../../lib/supabase';
import type { Program } from '../../types/database';

export type ApplicationGate =
  | { kind: 'ok' }
  | { kind: 'closed';   message: string }
  | { kind: 'too_early'; message: string }
  | { kind: 'expired';  message: string }
  | { kind: 'unavailable'; message: string };

/**
 * 프로그램이 현재 신청 가능한 상태인지 검증.
 * V2 status 는 한글 enum ('준비'|'진행'|'종료'|'취소' 등) — '진행' / '준비' 만 접수 허용.
 */
export function checkApplicationGate(program: Program | null): ApplicationGate {
  if (!program) return { kind: 'unavailable', message: '프로그램 정보를 찾을 수 없어요.' };

  // 외부 페이지에서 보지 말아야 할 비공개 프로그램
  if (program.visibility === 'private') {
    return { kind: 'unavailable', message: '비공개 프로그램이라 외부 신청을 받지 않아요.' };
  }

  // 완료·취소 상태 차단 (V2 한글 status: '준비'|'진행'|'완료'|'취소')
  if (program.status === '완료' || program.status === '취소') {
    return { kind: 'closed', message: '현재 접수 중인 프로그램이 아니에요.' };
  }

  // 평가형 신청 기간 검증
  const today = new Date().toISOString().slice(0, 10);
  const start = program.application_start_date ?? null;
  const end = program.application_end_date ?? null;
  if (start && today < start) {
    return { kind: 'too_early', message: `신청은 ${start} 부터 시작돼요.` };
  }
  if (end && today > end) {
    return { kind: 'expired', message: '신청 기간이 종료됐어요.' };
  }
  return { kind: 'ok' };
}

/**
 * 동일 프로그램에 같은 이메일로 이미 신청했는지 확인.
 * email NULL 이면 중복 검사 skip (전화번호 기반 검사는 향후 별도 STEP).
 */
export async function checkDuplicateApplication(
  programId: string,
  email: string,
): Promise<{ duplicate: boolean; error?: string }> {
  const trimmedEmail = email.trim().toLowerCase();
  if (!trimmedEmail) return { duplicate: false };
  const { data, error } = await supabase
    .from('participant_applications')
    .select('id')
    .eq('program_id', programId)
    .eq('email', trimmedEmail)
    .limit(1);
  if (error) {
    console.error('[apply] 중복 확인 실패:', error.message);
    return { duplicate: false, error: '중복 확인 중 오류가 발생했어요.' };
  }
  return { duplicate: (data ?? []).length > 0 };
}

export interface ApplicationPayload {
  programId: string;
  name: string;
  phone: string;
  email: string;
  birthYear: string;
  gender: '' | 'male' | 'female' | 'other';
  address: string;
  organization: string;
  motivation: string;
  experience: string;
  // 박경수님 2026-06-02 STEP-RECRUIT-CUSTOM-QUESTIONS — 추가 질문 응답
  extraAnswers?: Record<string, string>;
}

export interface SubmitResult {
  success: boolean;
  error?: string;
}

/** 신청 INSERT — 호출 전 checkApplicationGate / checkDuplicateApplication 으로 사전 차단 권장. */
export async function submitApplication(p: ApplicationPayload): Promise<SubmitResult> {
  const { error } = await supabase.from('participant_applications').insert({
    program_id: p.programId,
    name: p.name.trim(),
    phone: p.phone.trim(),
    email: p.email.trim() || null,
    birth_year: p.birthYear || null,
    gender: p.gender || null,
    address: p.address.trim() || null,
    organization: p.organization.trim() || null,
    motivation: p.motivation.trim() || null,
    experience: p.experience.trim() || null,
    privacy_agreed: true,
    privacy_agreed_at: new Date().toISOString(),
    // V2 실측 CHECK: 'applied' | 'reviewing' | 'accepted' | 'rejected' | 'withdrawn' | 'completed'
    status: 'applied',
    // 박경수님 2026-06-02 STEP-RECRUIT-CUSTOM-QUESTIONS — 추가 질문 응답
    extra_answers: p.extraAnswers ?? {},
  });
  if (error) {
    const m = error.message.toLowerCase();
    console.error('[apply] 신청 INSERT 실패:', error.message);
    if (m.includes('row-level security') || m.includes('permission')) {
      return { success: false, error: '신청 권한이 없어요. 관리자에게 문의해 주세요.' };
    }
    if (m.includes('duplicate') || m.includes('unique')) {
      return { success: false, error: '이미 신청하셨어요.' };
    }
    return { success: false, error: '신청 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.' };
  }
  return { success: true };
}
