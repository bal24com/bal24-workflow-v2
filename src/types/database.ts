// bal24 WorkFlow v2 — Supabase 데이터베이스 타입 (STEP 2)
// any 타입 사용 금지 — 모든 Supabase 응답은 이 타입 기반

// ─── 공통 ─────────────────────────────────────────────
export type ProjectStatus = '제안' | '진행' | '정산' | '종료';
export type TaskStatus = '인식' | '실행' | '검토' | '완료';
export type SettlementStatus = '미지급' | '부분지급' | '지급완료';
export type EducationStatus = '준비' | '진행' | '완료';
export type InvitationStatus = '대기' | '수락' | '거절' | '완료';
export type ProjectType = '교육' | '컨설팅' | '이벤트';
export type Role = 'ADMIN' | 'PM' | 'STAFF' | 'FINANCE' | 'PARTNER' | 'MEMBER';
export type Priority = '낮음' | '보통' | '높음' | '긴급';
export type SurveyType = '사전' | '사후';
export type ProgramType = '교육' | '캠프' | '행사' | '기타';
export type ProgramStatus = '준비' | '진행' | '완료' | '취소';
export type ConsortiumStatus = '구성중' | '진행' | '완료' | '해산';
export type ConsortiumRole = '주관' | '공동' | '위탁';
export type LedgerType = 'own' | 'consortium';
export type IncomeStatus = '대기' | '입금완료' | '반려';
export type ExpenseStatus = '대기' | '출금완료' | '반려';
export type WithholdingType = 'none' | 'business_3_3' | 'other_8_8';
export type ReceiptType = '영수증' | '세금계산서' | '간이영수증' | '계좌이체' | '카드전표' | '기타';
export type AttendeeRole = 'student' | 'instructor' | 'ta';
export type CheckInMethod = 'qr' | 'link' | 'manual';
export type ApplicationStatus = '검토중' | '승인' | '대기' | '취소';
export type FormType = 'application' | 'survey' | 'feedback';
export type FormFieldType = 'text' | 'number' | 'select' | 'textarea' | 'date';
export type ActivityLogType = 'mentoring' | 'lecture' | 'business_trip' | 'ta' | 'operation' | 'dispatch';
export type CertificateType = 'completion' | 'lecture';
export type CertificateRecipientType = 'student' | 'instructor';
export type ReportType = 'interim' | 'final';
export type ReportStatus = 'draft' | 'submitted' | 'approved' | 'rejected';
export type SettlementStep = 1 | 2 | 3 | 4 | 5;
export type ClientType = 'client' | 'vendor' | 'both';
export type PortalItemType = 'file_download' | 'file_upload' | 'feedback' | 'approval' | 'auto_data' | 'tax_invoice';
export type PortalAutoDataKey = 'applications' | 'attendance' | 'curriculum' | 'report';
export type PortalStageTag = 'proposal' | 'contract' | 'operation' | 'closing';
export type PortalResponseType = 'feedback' | 'file' | 'approval';
export type InvitationRole = 'instructor' | 'ta' | 'mentor' | 'facilitator';

// ─── 사용자 ───────────────────────────────────────────
export interface Profile {
  id: string;
  email: string;
  name: string;
  role: Role;
  department?: string | null;
  position?: string | null;
  phone?: string | null;
  avatar_url?: string | null;
  slogan?: string | null;
  joined_at?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
}

// ─── 거래처 ───────────────────────────────────────────
export interface Client {
  id: string;
  name: string;
  business_number?: string | null;
  business_name?: string | null;
  ceo_name?: string | null;
  client_type?: ClientType | null;
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
export interface ProgramFile {
  url: string;
  name: string;
  size?: number;
}

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
  /** V7 ③ 공지사항 (집합장소·시간·준비물 등) — 2026-05-08 추가 */
  notice?: string | null;
  /** V7 ③-1 공지 첨부 — 2026-05-08 추가 */
  notice_files?: ProgramFile[] | null;
  /** V7 ④ 성과 목표 — 2026-05-08 추가 */
  goal_text?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 프로그램 커리큘럼 (V7 ⑥ 카드 / 2026-05-08 신규) ─────
export interface ProgramCurriculum {
  id: string;
  program_id: string;
  session_no: number;
  title: string;
  content?: string | null;
  session_date?: string | null;
  /** 분 단위 — 자동 계산 또는 수동 입력 fallback */
  duration?: number | null;
  /** 시작 시간 HH:MM:SS — V7 스타일 시간 picker (2026-05-08 추가) */
  start_time?: string | null;
  /** 종료 시간 HH:MM:SS — V7 스타일 시간 picker (2026-05-08 추가) */
  end_time?: string | null;
  venue?: string | null;
  created_at: string;
}

export type CurriculumStaffRole = '강사' | 'FT' | '멘토' | 'TA' | '운영진';
export type CurriculumStaffStatus = 'pending' | 'accepted' | 'rejected';

export interface CurriculumStaff {
  id: string;
  curriculum_id: string;
  /** 외부 전문가 (정산 연동) — profile_id와 둘 중 하나만 값 */
  staff_pool_id?: string | null;
  /** 내부 직원 (급여 별도) — staff_pool_id와 둘 중 하나만 값 */
  profile_id?: string | null;
  role: CurriculumStaffRole;
  fee?: number | null;
  note?: string | null;
  token: string;
  status: CurriculumStaffStatus;
  responded_at?: string | null;
  created_at: string;
}

// ─── 프로그램 외부공유 4단계×3대상 (Stage 3-B / 2026-05-08 신규) ─

export type ShareAudience = 'client' | 'student' | 'expert';

export type ShareStage = 'before' | 'pre' | 'ready' | 'progress' | 'result';

export type ShareItem =
  | 'basic_info'
  | 'curriculum'
  | 'instructors'
  | 'materials'
  | 'survey_view'
  | 'edit_request'
  | 'feedback_comments'
  | 'checkin'
  | 'survey_submit'
  | 'outcome_upload'
  | 'invite_response'
  | 'activity_log'
  | 'lecture_certificate';

/** 노출 항목 toggle 상태 — audience × item × boolean */
export type ShareVisibility = Partial<Record<ShareAudience, Partial<Record<ShareItem, boolean>>>>;

export interface ProgramShare {
  program_id: string;
  pre_date?: string | null;
  ready_date?: string | null;
  progress_date?: string | null;
  result_date?: string | null;
  /** 학생 만족도 노출 시점 PM이 직접 설정 (Stage 3-B-2 / 2026-05-08 추가) */
  survey_open_at?: string | null;
  client_token: string;
  student_token: string;
  expert_token: string;
  visibility: ShareVisibility;
  created_at: string;
  updated_at: string;
}

// ─── 외부공유 응답 (Stage 3-B-2 / 2026-05-08 신규) ────────

export type EditRequestStatus = 'pending' | 'reviewing' | 'resolved' | 'rejected';

export interface ProgramEditRequest {
  id: string;
  program_id: string;
  requester_name: string;
  requester_phone?: string | null;
  content: string;
  status: EditRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  created_at: string;
}

export type ShareCommentRole = 'client' | 'staff';

export interface ProgramShareComment {
  id: string;
  program_id: string;
  parent_id?: string | null;
  author_role: ShareCommentRole;
  author_name: string;
  content: string;
  is_deleted: boolean;
  created_at: string;
}

// ─── 커리큘럼 템플릿 (Stage 3-C — 재활용 모음 / 2026-05-08 신규) ─

export interface CurriculumTemplate {
  id: string;
  name: string;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface CurriculumTemplateItem {
  id: string;
  template_id: string;
  session_no: number;
  title: string;
  content?: string | null;
  /** 분 단위 */
  duration?: number | null;
  start_time?: string | null;
  end_time?: string | null;
  venue?: string | null;
  created_at: string;
}

// ─── 결과보고서 빌더 (Stage 2에서 사용 / 2026-05-08 신규) ─
export type ReportSectionType = 'auto' | 'custom';

export interface ReportSection {
  id: string;
  program_id: string;
  section_key: string;
  title: string;
  content?: string | null;
  is_visible: boolean;
  sort_order: number;
  section_type: ReportSectionType;
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
  /** V2 program 단위 운영용 — `/programs/:id` 상세에서 직접 join (2026-05-08 추가) */
  program_id?: string | null;
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
export interface InvitationFile {
  url: string;
  name: string;
  size?: number;
  type?: string;
}

export interface InstructorInvitation {
  id: string;
  education_id?: string | null;
  program_id?: string | null;
  curriculum_id?: string | null;
  staff_pool_id?: string | null;
  expert_id?: string | null;
  profile_id?: string | null;
  name: string;
  phone?: string | null;
  email?: string | null;
  role?: InvitationRole | null;
  status: InvitationStatus;
  access_token?: string;
  portal_token?: string | null;
  invited_at: string;
  responded_at?: string | null;
  rejected_reason?: string | null;
  replacement_for?: string | null;
  invited_by?: string | null;
  notes?: string | null;
  materials?: InvitationFile[] | null;
  profile_files?: InvitationFile[] | null;
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
  /** V2 program 단위 운영용 — `/programs/:id` 상세에서 직접 join (2026-05-08 추가) */
  program_id?: string | null;
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

// ─── 수입 / 지출 / 영수증 (STEP 12) ─────────────────────
export interface Income {
  id: string;
  ledger_type: LedgerType;
  project_id?: string | null;
  consortium_id?: string | null;
  client_id?: string | null;
  account_code: string;
  description: string;
  amount: number;
  income_date: string;
  invoice_number?: string | null;
  status: IncomeStatus;
  received_at?: string | null;
  received_by?: string | null;
  memo?: string | null;
  deleted_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Expense {
  id: string;
  ledger_type: LedgerType;
  project_id?: string | null;
  consortium_id?: string | null;
  payee_id?: string | null;
  staff_id?: string | null;
  account_code: string;
  description: string;
  gross_amount: number;
  withholding_type: WithholdingType;
  /** GENERATED — 앱에서 INSERT 금지 */
  withholding_rate: number;
  /** GENERATED — 앱에서 INSERT 금지 */
  withholding_amount: number;
  /** GENERATED — 앱에서 INSERT 금지 */
  net_amount: number;
  expense_date: string;
  paid_at?: string | null;
  paid_by?: string | null;
  status: ExpenseStatus;
  memo?: string | null;
  deleted_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  expense_id?: string | null;
  income_id?: string | null;
  project_id?: string | null;
  consortium_id?: string | null;
  file_url: string;
  file_name: string;
  file_size?: number | null;
  receipt_type: ReceiptType;
  description?: string | null;
  memo?: string | null;
  amount?: number | null;
  deleted_at?: string | null;
  created_by?: string | null;
  created_at: string;
}

// ─── 출석 (STEP 11-B) ───────────────────────────────
export interface AttendanceSession {
  id: string;
  program_id: string;
  curriculum_id?: string | null;
  title: string;
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  session_token: string;
  token_expires_at?: string | null;
  check_in_open: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface AttendanceRecord {
  id: string;
  session_id: string;
  attendee_role: AttendeeRole;
  form_application_id?: string | null;
  expert_id?: string | null;
  attendee_name: string;
  attendee_phone?: string | null;
  check_in_at: string;
  check_in_method: CheckInMethod;
  ip_address?: string | null;
  note?: string | null;
  created_at: string;
}

// ─── 외부 폼 (STEP 11-E) ────────────────────────────
export interface FormFieldSpec {
  key: string;
  label: string;
  type: FormFieldType;
  required?: boolean;
  options?: string[];
  placeholder?: string;
}

export interface PublicForm {
  id: string;
  program_id: string;
  form_token: string;
  title: string;
  description?: string | null;
  form_type: FormType;
  max_applicants?: number | null;
  open_at?: string | null;
  close_at?: string | null;
  is_active: boolean;
  fields: FormFieldSpec[];
  auto_reply_email: boolean;
  auto_reply_subject?: string | null;
  auto_reply_body?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface FormApplication {
  id: string;
  form_id: string;
  program_id?: string | null;
  data: Record<string, string | number | boolean | null>;
  applicant_name?: string | null;
  applicant_phone?: string | null;
  applicant_email?: string | null;
  status: ApplicationStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  review_note?: string | null;
  submitted_at: string;
  created_at: string;
  updated_at: string;
}

// ─── 통합 일지 (STEP 11-D) ──────────────────────────
export interface ActivityFile {
  url: string;
  name: string;
  size?: number;
}

export interface ActivityLog {
  id: string;
  program_id?: string | null;
  project_id?: string | null;
  expert_id?: string | null;
  log_type: ActivityLogType;
  title: string;
  activity_date: string;
  start_time?: string | null;
  end_time?: string | null;
  duration_hours?: number | null;
  location?: string | null;
  attendee_count?: number | null;
  content?: string | null;
  outcome?: string | null;
  issues?: string | null;
  next_plan?: string | null;
  file_urls?: ActivityFile[] | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  deleted_at?: string | null;
}

// ─── 수료증 (STEP 11-C) ─────────────────────────────
export interface CertificateTemplate {
  id: string;
  program_id: string;
  cert_type: CertificateType;
  title: string;
  institution_name: string;
  seal_file_url?: string | null;
  signature_name?: string | null;
  template_html?: string | null;
  valid_hours?: number | null;
  is_default: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface IssuedCertificate {
  id: string;
  template_id: string;
  program_id: string;
  cert_type: CertificateType;
  recipient_type: CertificateRecipientType;
  form_application_id?: string | null;
  expert_id?: string | null;
  recipient_name: string;
  issue_date: string;
  cert_number?: string | null;
  pdf_url?: string | null;
  issued_by?: string | null;
  created_at: string;
}

// ─── 고객 문서 포털 (STEP 15) ──────────────────────
export interface PortalTemplate {
  id: string;
  name: string;
  description?: string | null;
  stage_hint?: PortalStageTag | null;
  is_shared: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalTemplateItem {
  id: string;
  template_id: string;
  item_type: PortalItemType;
  label: string;
  description?: string | null;
  auto_data_key?: PortalAutoDataKey | null;
  approval_text?: string | null;
  required: boolean;
  sort_order: number;
  created_at: string;
}

export interface ProjectPortal {
  id: string;
  project_id: string;
  template_id?: string | null;
  portal_token: string;
  title: string;
  message?: string | null;
  stage_tag?: PortalStageTag | null;
  is_active: boolean;
  expires_at?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface PortalItem {
  id: string;
  portal_id: string;
  item_type: PortalItemType;
  label: string;
  description?: string | null;
  auto_data_key?: PortalAutoDataKey | null;
  file_url?: string | null;
  file_name?: string | null;
  approval_text?: string | null;
  required: boolean;
  sort_order: number;
  completed: boolean;
  completed_at?: string | null;
  created_at: string;
}

export interface PortalResponse {
  id: string;
  item_id: string;
  response_type: PortalResponseType;
  content?: string | null;
  file_url?: string | null;
  file_name?: string | null;
  file_size?: number | null;
  submitted_at: string;
  submitter_ip?: string | null;
}

// ─── 결과보고서 (STEP 13) ────────────────────────────
export interface ReportContent {
  overview?: {
    period?: string;
    clientName?: string;
    totalBudget?: number | null;
    description?: string;
  };
  performance?: {
    programs?: { name: string; sessionCount?: number; completionCount?: number; attendanceRate?: number | null }[];
    summary?: string;
  };
  staff?: {
    experts?: { name: string; logHours: number; certCount?: number }[];
    summary?: string;
  };
  budget?: {
    plannedTotal?: number | null;
    incomeTotal?: number;
    expenseGross?: number;
    expenseNet?: number;
    balance?: number;
    summary?: string;
  };
  notes?: string;
}

export interface ProjectReport {
  id: string;
  project_id: string;
  title: string;
  report_type: ReportType;
  status: ReportStatus;
  content: ReportContent;
  settlement_id?: string | null;
  submitted_at?: string | null;
  submitted_by?: string | null;
  approved_at?: string | null;
  approved_by?: string | null;
  reject_reason?: string | null;
  pdf_url?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface ProjectSettlementRow {
  id: string;
  project_id: string;
  current_step: SettlementStep;
  report_id?: string | null;
  approved_at?: string | null;
  invoice_at?: string | null;
  received_at?: string | null;
  paid_out_at?: string | null;
  note?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 정산 (기존 항목별 settlements) ─────────────────
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

// ─── 감사 로그 (audit) ────────────────────────────────
// STEP 11-D의 ActivityLog(활동 일지)와 구분.
// 초기 스키마 activity_log(단수) 테이블용 — 시스템 감사용.
export interface AuditLog {
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

// ─── 일정·캘린더 (STEP 17) ─────────────────────────────
export type ScheduleCategory = 'meeting' | 'deadline' | 'external' | 'personal' | 'etc';

export interface ScheduleEvent {
  id: string;
  title: string;
  event_date: string;
  start_time?: string | null;
  end_time?: string | null;
  all_day: boolean;
  category: ScheduleCategory;
  color?: string | null;
  project_id?: string | null;
  program_id?: string | null;
  description?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}
