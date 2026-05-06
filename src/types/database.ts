// bal24 WorkFlow v2 — Supabase 데이터베이스 타입 (STEP 2)
// any 타입 사용 금지 — 모든 Supabase 응답은 이 타입 기반

// ─── 공통 ─────────────────────────────────────────────
export type ProjectStatus = '제안' | '진행' | '정산' | '종료';
export type TaskStatus = '인식' | '실행' | '검토' | '완료';
export type SettlementStatus = '미지급' | '부분지급' | '지급완료';
export type EducationStatus = '준비' | '진행' | '완료';
export type InvitationStatus = '대기' | '수락' | '거절' | '완료';
export type ProjectType = '교육' | '컨설팅' | '이벤트';
export type Role = 'ADMIN' | 'PM' | 'MEMBER';
export type Priority = '낮음' | '보통' | '높음' | '긴급';
export type SurveyType = '사전' | '사후';
export type ProgramType = '교육' | '캠프' | '행사' | '기타';
export type ProgramStatus = '준비' | '진행' | '완료' | '취소';
export type ConsortiumStatus = '구성중' | '진행' | '완료' | '해산';
export type ConsortiumRole = '주관' | '공동' | '위탁';

// ─── 사용자 ───────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  slogan?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── 거래처 ───────────────────────────────────────────
export interface Client {
  id: string;
  name: string;
  business_number?: string | null;
  representative?: string | null;
  business_type?: string | null;
  business_item?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_holder?: string | null;
  business_license_url?: string | null;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ClientContact {
  id: string;
  client_id: string;
  name: string;
  position?: string | null;
  main_duties?: string | null;
  phone_mobile?: string | null;
  phone_office?: string | null;
  email?: string | null;
  linked_profile_id?: string | null;
  created_at: string;
}

// ─── 인력풀 ───────────────────────────────────────────
export interface StaffPool {
  id: string;
  name: string;
  organization?: string | null;
  position?: string | null;
  phone?: string | null;
  phone_mobile?: string | null;
  phone_office?: string | null;
  main_duties?: string | null;
  email?: string | null;
  specialty?: string[] | null;
  career_summary?: string | null;
  portfolio_url?: string | null;
  profile_image_url?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_holder?: string | null;
  id_number?: string | null;
  note?: string | null;
  tags?: string[] | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 컨소시엄 ─────────────────────────────────────────
export interface Consortium {
  id: string;
  name: string;
  description?: string | null;
  lead_org?: string | null;
  lead_client_id?: string | null;
  project_id?: string | null;
  start_date?: string | null;
  end_date?: string | null;
  total_budget?: number | null;
  status: ConsortiumStatus;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ConsortiumMember {
  id: string;
  consortium_id: string;
  org_name: string;
  client_id?: string | null;
  role?: ConsortiumRole | null;
  responsibilities?: string | null;
  budget_ratio?: number | null;     // 지분율 (%)
  budget_amount?: number | null;
  contact_name?: string | null;
  contact_phone?: string | null;
  contact_email?: string | null;
  access_token: string;
  created_at: string;
}

// ─── 프로젝트 ─────────────────────────────────────────
export interface Project {
  id: string;
  consortium_id?: string | null;
  client_id?: string | null;
  name: string;
  type: ProjectType[];
  status: ProjectStatus;
  start_date?: string | null;
  end_date?: string | null;
  budget?: number | null;
  description?: string | null;
  pm_id?: string | null;
  client_access_token: string;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectMember {
  id: string;
  project_id: string;
  profile_id: string;
  role?: string | null;
  created_at: string;
}

// ─── 프로그램 ─────────────────────────────────────────
export interface Program {
  id: string;
  project_id?: string | null;
  name: string;
  type: ProgramType;
  status: ProgramStatus;
  start_date?: string | null;
  end_date?: string | null;
  venue?: string | null;
  capacity?: number | null;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 태스크 ───────────────────────────────────────────
export interface Task {
  id: string;
  project_id: string;
  title: string;
  description?: string | null;
  status: TaskStatus;
  priority: Priority;
  assignee_id?: string | null;
  start_date?: string | null;
  due_date?: string | null;
  seq_num: number;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 교육 ─────────────────────────────────────────────
export interface CompletionCriteria {
  attendance_rate: number;
  assignment: boolean;
  survey: boolean;
}

export interface Education {
  id: string;
  project_id: string;
  name: string;
  venue?: string | null;
  target_audience?: string | null;
  max_participants?: number | null;
  start_date?: string | null;
  end_date?: string | null;
  status: EducationStatus;
  completion_criteria: CompletionCriteria;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Curriculum {
  id: string;
  education_id: string;
  day_num: number;
  session_num: number;
  title: string;
  content?: string | null;
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
  sort_order?: number | null;
  created_at: string;
}

// ─── 강사 초빙 ────────────────────────────────────────
export interface InstructorInvitation {
  id: string;
  education_id: string;
  curriculum_id?: string | null;
  staff_pool_id?: string | null;
  profile_id?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  status: InvitationStatus;
  access_token: string;
  invited_at: string;
  responded_at?: string | null;
  lecture_fee?: number | null;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 교육생·출석·설문·과제 ────────────────────────────
export interface Student {
  id: string;
  education_id: string;
  name: string;
  phone?: string | null;
  email?: string | null;
  organization?: string | null;
  department?: string | null;
  position?: string | null;
  access_token: string;
  is_completed: boolean;
  completion_date?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Attendance {
  id: string;
  student_id: string;
  curriculum_id?: string | null;
  is_present: boolean;
  checked_at?: string | null;
  note?: string | null;
}

export interface SurveyAnswer {
  question_id: string;
  rating?: number;
  text_answer?: string;
}

export interface Survey {
  id: string;
  education_id: string;
  student_id: string;
  type: SurveyType;
  answers: SurveyAnswer[];
  submitted_at: string;
}

export interface Assignment {
  id: string;
  education_id: string;
  student_id: string;
  title?: string | null;
  file_url?: string | null;
  submitted_at: string;
  feedback?: string | null;
}

// ─── 정산 ─────────────────────────────────────────────
export interface Settlement {
  id: string;
  project_id: string;
  category: string;
  item_name: string;
  amount: number;
  status: SettlementStatus;
  paid_amount: number;
  payment_date?: string | null;
  recipient_name?: string | null;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 파일 ─────────────────────────────────────────────
export interface FileRecord {
  id: string;
  project_id?: string | null;
  education_id?: string | null;
  uploader_id?: string | null;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  file_type?: string | null;
  category?: string | null;
  created_at: string;
}

// ─── 알림 ─────────────────────────────────────────────
export interface Notification {
  id: string;
  recipient_id: string;
  type: string;
  title: string;
  body?: string | null;
  link?: string | null;
  is_read: boolean;
  created_at: string;
}

// ─── 활동 로그 ────────────────────────────────────────
export interface ActivityLog {
  id: string;
  actor_id?: string | null;
  actor_name?: string | null;
  action: string;
  target_type?: string | null;
  target_id?: string | null;
  target_name?: string | null;
  detail?: Record<string, unknown> | null;
  created_at: string;
}
