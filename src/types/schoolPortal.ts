// STEP-SCHOOL-PORTAL 타입 정의 (박경수님 2026-05-28).
// program_portals · program_surveys · survey_questions · survey_responses · project_portals.

export type AccessScope = 'school' | 'team' | 'supervisor';
export type SurveyTargetScope = 'all' | 'school' | 'team';
export type SurveyType = 'satisfaction' | 'schedule' | 'general';
export type QuestionType = 'rating' | 'choice' | 'text';

/** program_portals row */
export interface ProgramPortal {
  id: string;
  program_id: string;
  client_id: string | null;
  portal_token: string;
  access_scope: AccessScope;
  team_label: string | null;
  participant_ids: string[];      // jsonb 배열 → 클라이언트에서 string[]
  is_active: boolean;
  created_at: string;
}

/** project_portals row (교육지원청용) */
export interface ProjectPortal {
  id: string;
  project_id: string;
  portal_token: string;
  access_scope: AccessScope;
  is_active: boolean;
  created_at: string;
}

/** program_surveys row */
export interface Survey {
  id: string;
  project_id: string | null;
  program_id: string | null;
  title: string;
  description: string | null;
  target_scope: SurveyTargetScope;
  survey_type: SurveyType;
  is_active: boolean;
  due_date: string | null;        // YYYY-MM-DD
  created_by: string | null;
  created_at: string;
  // 1차(bdecb92) 호환 필드 — optional
  token?: string;
  survey_key?: string;
  closed_at?: string | null;
}

/** survey_questions row */
export interface SurveyQuestion {
  id: string;
  survey_id: string;
  question_text: string;
  question_type: QuestionType;
  options: string[];              // jsonb 배열
  is_required: boolean;
  order_index: number;
}

/** survey_responses row */
export interface SurveyResponse {
  id: string;
  survey_id: string;
  portal_token: string | null;
  respondent_name: string | null;
  answers: Record<string, unknown>;
  submitted_at: string;
}

/** 학교 포털 진입 시 묶음 (포털 + 프로그램 + 학교) */
export interface SchoolPortalContext {
  portal: ProgramPortal;
  programId: string;
  programTitle: string;
  programStartDate: string | null;
  programEndDate: string | null;
  schoolClientId: string | null;
  schoolName: string | null;
}

/** 교육지원청 포털 진입 시 묶음 (project_portals row + 프로젝트 명) */
export interface SupervisorPortalContext {
  portal: ProjectPortal;
  projectId: string;
  projectTitle: string;
}
