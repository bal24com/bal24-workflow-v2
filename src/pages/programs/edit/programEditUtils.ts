// bal24 v2 — 프로그램 수정 풀 페이지 공용 유틸
// 폼 상태 타입 + load / save 헬퍼.

import { supabase } from '../../../lib/supabase';
import type {
  Program, ProgramFile, ProgramStatus, ProgramType,
} from '../../../types/database';

export type ProgramVisibility = 'private' | 'internal' | 'public';
export type ApplicationType = 'open' | 'evaluation';

export interface ProgramEditForm {
  name: string;
  type: ProgramType;
  status: ProgramStatus;
  project_id: string | null;
  start_date: string;
  end_date: string;
  venue: string;
  capacity: string;
  description: string;
  notice: string;
  notice_files: ProgramFile[];
  goal_text: string;
  /** STEP-PROGRAM-EDIT-VISIBILITY — 가시성 (private/internal/public) */
  visibility: ProgramVisibility;
  /** STEP-PROGRAM-CREATION-WIZARD — 신청 방식 (open/evaluation) */
  application_type: ApplicationType;
  /** evaluation 일 때만 의미 있음 */
  application_start_date: string;
  application_end_date: string;
  max_applicants: string; // 문자열 입력 → 저장 시 숫자 변환
  /** 지원금 관리 사용 여부 */
  grant_enabled: boolean;
  /** grant_enabled=true 일 때만 의미 있음. 문자열 입력 → 저장 시 숫자 변환 */
  grant_budget: string;
}

export function emptyForm(): ProgramEditForm {
  return {
    name: '',
    type: '교육',
    status: '준비',
    project_id: null,
    start_date: '',
    end_date: '',
    venue: '',
    capacity: '',
    description: '',
    notice: '',
    notice_files: [],
    goal_text: '',
    visibility: 'internal',
    application_type: 'open',
    application_start_date: '',
    application_end_date: '',
    max_applicants: '',
    grant_enabled: false,
    grant_budget: '',
  };
}

export function programToForm(p: Program): ProgramEditForm {
  return {
    name: p.name ?? '',
    type: p.type,
    status: p.status,
    project_id: p.project_id ?? null,
    start_date: p.start_date ?? '',
    end_date: p.end_date ?? '',
    venue: p.venue ?? '',
    capacity: p.capacity != null ? String(p.capacity) : '',
    description: p.description ?? '',
    notice: p.notice ?? '',
    notice_files: p.notice_files ?? [],
    goal_text: p.goal_text ?? '',
    visibility: (p.visibility ?? 'internal') as ProgramVisibility,
    application_type: (p.application_type ?? 'open') as ApplicationType,
    application_start_date: p.application_start_date ?? '',
    application_end_date: p.application_end_date ?? '',
    max_applicants: p.max_applicants != null ? String(p.max_applicants) : '',
    grant_enabled: !!p.grant_enabled,
    grant_budget: p.grant_budget != null ? String(p.grant_budget) : '',
  };
}

export interface FormError {
  field: keyof ProgramEditForm;
  message: string;
}

export function validateForm(f: ProgramEditForm): FormError | null {
  if (!f.name.trim()) return { field: 'name', message: '프로그램명을 입력해 주세요.' };
  if (f.start_date && f.end_date && f.start_date > f.end_date) {
    return { field: 'end_date', message: '종료일이 시작일보다 빠를 수 없어요.' };
  }
  if (f.capacity.trim()) {
    const n = Number(f.capacity.replace(/,/g, ''));
    if (Number.isNaN(n) || n < 0) return { field: 'capacity', message: '정원은 0 이상의 숫자여야 해요.' };
  }
  // STEP-PROGRAM-CREATION-WIZARD — 평가형 선발: 신청 기간·정원 검증
  if (f.application_type === 'evaluation') {
    if (
      f.application_start_date && f.application_end_date &&
      f.application_start_date > f.application_end_date
    ) {
      return { field: 'application_end_date', message: '신청 종료일이 시작일보다 빠를 수 없어요.' };
    }
    if (f.max_applicants.trim()) {
      const n = Number(f.max_applicants.replace(/,/g, ''));
      if (Number.isNaN(n) || n < 0) {
        return { field: 'max_applicants', message: '선발 인원은 0 이상의 숫자여야 해요.' };
      }
    }
  }
  if (f.grant_enabled && f.grant_budget.trim()) {
    const n = Number(f.grant_budget.replace(/,/g, ''));
    if (Number.isNaN(n) || n < 0) {
      return { field: 'grant_budget', message: '지원금 예산은 0 이상의 숫자여야 해요.' };
    }
  }
  return null;
}

export async function saveProgram(programId: string, f: ProgramEditForm): Promise<void> {
  const capacity = f.capacity.trim() ? Number(f.capacity.replace(/,/g, '')) : null;

  const maxApplicants = f.max_applicants.trim() ? Number(f.max_applicants.replace(/,/g, '')) : null;
  const grantBudget = f.grant_enabled && f.grant_budget.trim()
    ? Number(f.grant_budget.replace(/,/g, ''))
    : 0;

  const { error } = await supabase
    .from('programs')
    .update({
      name: f.name.trim(),
      type: f.type,
      status: f.status,
      project_id: f.project_id || null,
      start_date: f.start_date || null,
      end_date: f.end_date || null,
      venue: f.venue.trim() || null,
      capacity,
      description: f.description.trim() || null,
      notice: f.notice.trim() || null,
      notice_files: f.notice_files.length > 0 ? f.notice_files : null,
      goal_text: f.goal_text.trim() || null,
      visibility: f.visibility,
      // STEP-PROGRAM-CREATION-WIZARD — 신청·지원금 6 필드
      application_type: f.application_type,
      application_start_date: f.application_type === 'evaluation' ? (f.application_start_date || null) : null,
      application_end_date: f.application_type === 'evaluation' ? (f.application_end_date || null) : null,
      max_applicants: f.application_type === 'evaluation' ? maxApplicants : null,
      grant_enabled: f.grant_enabled,
      grant_budget: grantBudget,
      updated_at: new Date().toISOString(),
    })
    .eq('id', programId);

  if (error) {
    console.error('[program-edit] 저장 실패:', error.message);
    throw new Error(error.message);
  }
}

export interface ProjectOption {
  id: string;
  name: string;
}

export async function fetchProjectOptions(): Promise<ProjectOption[]> {
  const { data, error } = await supabase
    .from('projects')
    .select('id, name')
    .order('created_at', { ascending: false });
  if (error) {
    console.error('[program-edit] 프로젝트 목록 조회 실패:', error.message);
    return [];
  }
  return (data as ProjectOption[] | null) ?? [];
}
