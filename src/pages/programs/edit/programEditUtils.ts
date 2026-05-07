// bal24 v2 — 프로그램 수정 풀 페이지 공용 유틸
// 폼 상태 타입 + load / save 헬퍼.

import { supabase } from '../../../lib/supabase';
import type {
  Program, ProgramFile, ProgramStatus, ProgramType,
} from '../../../types/database';

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
  return null;
}

export async function saveProgram(programId: string, f: ProgramEditForm): Promise<void> {
  const capacity = f.capacity.trim() ? Number(f.capacity.replace(/,/g, '')) : null;

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
