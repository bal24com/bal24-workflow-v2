// bal24 v2 — 컨소시엄 등록·수정 폼 타입·초기값 (ConsortiumFormModal V-1 분리)
// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-AI-AUTOFILL — V-1 (400줄) 충족 위해 분리.

import type { ConsortiumRole, ConsortiumStatus } from '../../types/database';

export interface ConsortiumInitialData {
  id: string;
  name: string;
  description: string;
  lead_client_id: string | null;
  project_id: string | null;
  status: ConsortiumStatus;
  start_date: string;
  end_date: string;
  total_budget: number | null;     // 박경수님 요청 — 사업비 입력 칸
}

export interface ConsortiumForm {
  name: string;
  projectId: string;
  status: ConsortiumStatus;
  leadClientId: string;
  leadRole: ConsortiumRole;
  description: string;
  startDate: string;
  endDate: string;
  totalBudget: string;          // 사업비 (콤마 허용 입력값)
}

export const EMPTY_CONSORTIUM_FORM: ConsortiumForm = {
  name: '', projectId: '', status: '구성중',
  leadClientId: '', leadRole: '총괄',
  description: '',
  startDate: '', endDate: '', totalBudget: '',
};

export function fromInitialConsortium(d: ConsortiumInitialData): ConsortiumForm {
  return {
    name: d.name,
    projectId: d.project_id ?? '',
    status: d.status,
    leadClientId: d.lead_client_id ?? '',
    leadRole: '총괄',
    description: d.description,
    startDate: d.start_date,
    endDate: d.end_date,
    totalBudget: d.total_budget != null ? String(d.total_budget) : '',
  };
}
