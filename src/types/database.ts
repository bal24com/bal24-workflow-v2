// bal24 WorkFlow v2 — Supabase 데이터베이스 타입 (STEP 2)
// any 타입 사용 금지 — 모든 Supabase 응답은 이 타입 기반

// ─── 공통 ─────────────────────────────────────────────
export type ProjectStatus = '제안' | '진행' | '정산' | '종료';
export type TaskStatus = '인식' | '실행' | '검토' | '완료';
export type SettlementStatus = '미지급' | '부분지급' | '지급완료';
export type EducationStatus = '준비' | '진행' | '완료';
/** STEP-INVITE-APPROVE-PART1 — '제출'(강사 응답 완료, 담당자 승인 대기) + '교체됨' 추가 */
export type InvitationStatus = '대기' | '제출' | '수락' | '거절' | '교체됨';

/** STEP-MEMBER-INVITE — 팀원 이메일 초대 상태 (instructor_invitations 와 별개) */
export type MemberInvitationStatus = 'pending' | 'accepted' | 'expired';
export type ProjectType = '교육' | '컨설팅' | '이벤트';
/** STEP-ROLE-TYPE-AUDIT — DB profiles.role 실측 소문자 통일 (2026-05-09) */
export type Role = 'admin' | 'pm' | 'staff' | 'finance' | 'partner' | 'member';
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
  /** STEP-PROGRAM-ASSIGNMENT — MEMBER 의 소속 참여사 ID (consortium_members FK) */
  consortium_member_id?: string | null;
  /** STEP-STAFF-PORTAL — 내부 직원 강사 겸임용 영구 포털 토큰 */
  staff_portal_token?: string | null;
  /** STEP-MENTORING-P3-APPROVE — 내부 직원 강사 겸임용 도장/사인 */
  signature_url?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 주관기관 ───────────────────────────────────────────
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
  /** STEP-EXPERT-CRUD-FULL — 부서명 (선택) */
  department?: string | null;
  address?: string | null;
  phone?: string | null;
  email?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_holder?: string | null;
  business_license_url?: string | null;
  note?: string | null;
  /** STEP-TAGS-2B — 분류 태그 (주관기관·거래처·협력사 등, 중복 가능) */
  tags?: string[] | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  /** STEP-EXPERT-CRUD-FULL — soft-delete 휴지통 (30일 후 영구 삭제) */
  deleted_at?: string | null;
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
/** STEP-EXPERT-CRUD-FULL — 인력풀 학력·경력·자격 (jsonb 저장) */
export interface EducationItem { school: string; major: string; degree: string; year: string }
export interface CareerItem { company: string; role: string; period: string }
export interface CertItem { name: string; issuer: string; year: string }
export type StaffType = '강사' | '멘토' | 'FT' | 'TA' | '운영진' | '기타';

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
  /** STEP-EXPERT-CRUD-FULL — 주 역할 분류 + 구조화 이력 + 휴지통 */
  staff_type?: StaffType | null;
  education_history?: EducationItem[];
  career_history?: CareerItem[];
  certifications?: CertItem[];
  resume_url?: string | null;
  deleted_at?: string | null;
  /** STEP-STAFF-PORTAL — 외부 강사 영구 포털 토큰 (/staff-portal/:token) */
  staff_portal_token?: string | null;
  /** STEP-MENTORING-P3-APPROVE — 도장/사인 이미지 URL (signatures 버킷) */
  signature_url?: string | null;
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
  /** STEP-DELETE-RESUME-FULL — soft-delete 휴지통 (30일 후 영구 삭제) */
  deleted_at?: string | null;
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
  /** STEP-PROJECT-ROLE-UNIFIED-TS — 자사 수행 역할 (운영사/참여사) */
  our_role?: 'operator' | 'member' | null;
  /** STEP-PROJECT-RESTRUCTURE — 계약 정보 */
  contract_amount?: number | null;
  contract_type?: string | null;
  duration_months?: number | null;
  source_doc_url?: string | null;
  source_doc_type?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  /** STEP-DELETE-RESUME-FULL — soft-delete 휴지통 (30일 후 영구 삭제) */
  deleted_at?: string | null;
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
  consortium_id?: string | null;
  name: string;
  type: ProgramType;
  /**
   * STEP-PROGRAM-TYPE-TS — 14종 영문 enum
   * (DB 마이그레이션: 한글 → 영문 키. 화면 표시는 PROGRAM_TYPE_LABELS 사용)
   */
  program_type?:
    | 'education' | 'support_grant' | 'mentoring' | 'event'
    | 'experience' | 'market' | 'marketing' | 'delivery'
    | 'planning' | 'recruitment' | 'fieldwork' | 'report'
    | 'research' | 'general'
    | null;
  /** STEP-PROGRAM-TYPE-TS — 신청 방식 (open/evaluation) */
  application_type?: 'open' | 'evaluation' | null;
  /** STEP-PROGRAM-TYPE-TS — 보조금·지원형 사용 여부 */
  grant_enabled?: boolean | null;
  /** STEP-PROGRAM-TYPE-TS — 보조금 예산 */
  grant_budget?: number | null;
  /** STEP-PROGRAM-TYPE-TS — 신청 시작일 */
  application_start_date?: string | null;
  /** STEP-PROGRAM-TYPE-TS — 신청 종료일 */
  application_end_date?: string | null;
  /** STEP-PROGRAM-TYPE-TS — 모집 정원 */
  max_applicants?: number | null;
  /** STEP-PROGRAM-TYPE — 표시 순서 (오름차순) */
  display_order?: number | null;
  /** STEP-PROGRAM-TYPE — 활성 모듈 ID 배열 (program_templates.modules 복사) */
  modules?: string[] | null;
  status: ProgramStatus;
  /** STEP-PROGRAM-VISIBILITY — RLS 가시성 (private / internal / public) */
  visibility?: 'private' | 'internal' | 'public';
  start_date?: string | null;
  end_date?: string | null;
  venue?: string | null;
  capacity?: number | null;
  description?: string | null;
  /** STEP-PROGRAM-BUNDLE — 기관/단체명 (legacy 텍스트, host_client_id 도입 후 보존만) */
  client_org?: string | null;
  /** 박경수님 요청 — 기관/단체를 clients FK 로. host_client_id 우선, 없으면 client_org 표시 */
  host_client_id?: string | null;
  /** STEP-PROGRAM-BUNDLE — 부서 */
  department?: string | null;
  /** STEP-PROGRAM-BUNDLE — 교육 대상 */
  target_audience?: string | null;
  /** STEP-PROGRAM-BUNDLE — 정원 (capacity 와 별개. V9 maxParticipants 매핑) */
  max_participants?: number | null;
  /** V7 ③ 공지사항 (집합장소·시간·준비물 등) — 2026-05-08 추가 */
  notice?: string | null;
  /** V7 ③-1 공지 첨부 — 2026-05-08 추가 */
  notice_files?: ProgramFile[] | null;
  /** STEP-CURRICULUM-FULL — 결과보고서에서 어느 커리큘럼 버전을 사용할지 */
  report_curriculum_type?: CurriculumType;
  /** V7 ④ 성과 목표 — 2026-05-08 추가 */
  goal_text?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 프로그램 담당사 배정 (STEP-PROGRAM-ASSIGNMENT / 2026-05-09 신규) ─
export type AssignmentRole = 'lead' | 'support';

export interface ProgramAssignment {
  id: string;
  program_id: string;
  consortium_member_id: string;
  role: AssignmentRole;
  can_manage_participants: boolean;
  can_manage_files: boolean;
  can_view_finance: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 프로그램 템플릿 (STEP-PROGRAM-TYPE / 2026-05-09 신규) ─
export interface ProgramTemplate {
  id: string;
  name: string;
  base_type: string;        // PROGRAM_TYPES 13종 중 하나
  description?: string | null;
  modules: string[];        // jsonb 배열 — MODULE_OPTIONS id 들
  is_system: boolean;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── 프로그램 커리큘럼 (V7 ⑥ 카드 / 2026-05-08 신규) ─────
/** STEP-CURRICULUM-FULL — 제안(최초)/실제 운영(조정) 이중 커리큘럼 */
export type CurriculumType = 'planned' | 'actual';

export interface ProgramCurriculum {
  id: string;
  program_id: string;
  session_no: number;
  title: string;
  content?: string | null;
  /** STEP-CURRICULUM-FULL — 'planned'(제안, 기본값) / 'actual'(실제 운영) */
  curriculum_type?: CurriculumType;
  session_date?: string | null;
  /** 분 단위 — 자동 계산 또는 수동 입력 fallback */
  duration?: number | null;
  /** 시작 시간 HH:MM:SS — V7 스타일 시간 picker (2026-05-08 추가) */
  start_time?: string | null;
  /** 종료 시간 HH:MM:SS — V7 스타일 시간 picker (2026-05-08 추가) */
  end_time?: string | null;
  venue?: string | null;
  /** STEP-PROGRAM-BUNDLE — 일자 라벨 ("1일차" / "5월 7일" 등 자유 입력) */
  day_label?: string | null;
  /** STEP-CURRICULUM-INSTRUCTOR-MATCH — AI 추출 강사명 (인력풀 매칭 실패 원본) */
  instructor_name_raw?: string | null;
  /** STEP-STAFF-ASSIGNMENT-FEE — 실제 강의 완료 체크 */
  is_completed?: boolean | null;
  /** STEP-STAFF-ASSIGNMENT-FEE — 실제 강의자 (배정 강사가 아닌 대체 인력) */
  actual_instructor_id?: string | null;
  /** STEP-CURRICULUM-ATTEND-SURVEY-FULL — 차시별 외부 출석 링크 (구글폼 등) */
  attendance_link?: string | null;
  /** STEP-CURRICULUM-ATTEND-SURVEY-FULL — 차시별 출석부 스캔 파일 URL */
  attendance_file_url?: string | null;
  created_at: string;
}

/** STEP-CURRICULUM-ATTEND-SURVEY-FULL — 만족도 설문 외부 파일 분석 결과 */
export interface SatisfactionSurvey {
  id: string;
  program_id: string;
  file_name?: string | null;
  file_url?: string | null;
  total_count: number;
  avg_overall?: number | null;
  summary_json: Record<string, number>;
  comments: string[];
  uploaded_at: string;
  uploaded_by?: string | null;
  /** STEP-SURVEY-AI — AI 항목별 분석 (Record<문항, 인사이트>) */
  ai_per_question?: Record<string, string>;
  /** STEP-SURVEY-AI — AI 전체 분석 요약 */
  ai_overall?: string | null;
  ai_analyzed_at?: string | null;
  /** STEP-PROGRAM-UX-B — 종합 분석 (5필드 구조) — Edge Function이 자동 채움 */
  ai_analysis?: {
    overall: string;
    strengths: string[];
    improvements: string[];
    keywords: string[];
    recommendation: string;
  } | null;
}

export type CurriculumStaffRole = '강사' | 'FT' | '멘토' | 'TA' | '운영진';
export type CurriculumStaffStatus = '대기' | '수락' | '거절';

export interface CurriculumStaff {
  id: string;
  curriculum_id: string;
  /** 외부 전문가 (정산 연동) — profile_id/instructor_name_raw 셋 중 하나만 값 */
  staff_pool_id?: string | null;
  /** 내부 직원 (급여 별도) — staff_pool_id/instructor_name_raw 셋 중 하나만 값 */
  profile_id?: string | null;
  /** STEP-CURRICULUM-INVITE-UPLOAD-FIX — 미등록 인력 이름만 보관 (staff_pool_id·profile_id 둘 다 null일 때) */
  instructor_name_raw?: string | null;
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
  | 'lecture_certificate'
  // STEP-TAB-RESTRUCTURE-B — progress 단계 보강
  | 'portal_progress'
  | 'mypage';

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
  consortium_id?: string | null;
  consortium_member_id?: string | null;
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
  /** STEP-PARTNER-EXPENSE-FILTER — PARTNER 본인 회사 지출 필터링용 */
  consortium_member_id?: string | null;
  /** STEP-STAFF-FEE-EXPENSES-LINK — 강사료 자동 연동 출처 추적 */
  staff_fee_id?: string | null;
  created_at: string;
  updated_at: string;
}

export interface Receipt {
  id: string;
  expense_id?: string | null;
  income_id?: string | null;
  project_id?: string | null;
  consortium_id?: string | null;
  /** STEP-PARTNER-RECEIPTS-FILTER — PARTNER 본인 회사 증빙 필터링용 */
  consortium_member_id?: string | null;
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

// ─── 출석 (STEP 11-B / Stage 11-① 보강 2026-05-08) ───
export type AttendanceCheckStatus = 'O' | '△' | 'X';

export interface AttendanceSession {
  id: string;
  program_id: string;
  curriculum_id?: string | null;
  title: string;
  /** 차시 번호 (Stage 11-① 추가) */
  session_no?: number | null;
  session_date: string;
  start_time?: string | null;
  end_time?: string | null;
  location?: string | null;
  /** 호환용 (구버전) — 신규는 student_token 사용 */
  session_token?: string | null;
  /** 학생 외부 출석 토큰 */
  student_token: string;
  /** 강사 외부 출석 토큰 */
  instructor_token: string;
  /** TA 외부 출석 토큰 */
  ta_token: string;
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
  /** 출석 상태 (Stage 11-① 추가) — O 출석 / △ 지각 / X 결석 */
  status: AttendanceCheckStatus;
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
  /** 외부 /cert/:token 접근용 토큰 (Stage 11-① 추가) */
  token: string;
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
  invoice_number?: string | null;
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
  consortium_id?: string | null;
  program_id?: string | null;
  /** @deprecated V2 에서는 program_id 사용. 레거시 호환을 위해 필드만 유지. */
  education_id?: string | null;
  uploader_id?: string | null;
  file_name: string;
  /**
   * 신규 행: Storage path (예: "abc-123/1715000000000_파일.pdf").
   * 레거시 행: publicUrl (https://... — STEP-STORAGE 이전 데이터).
   * 다운로드 시 https 로 시작하면 그대로 열고, 아니면 createSignedUrl 로 1시간 임시 URL 생성.
   */
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

// ─── STEP-EVALUATION-SYSTEM 평가위원 + 점수 ───────────────────
export type EvaluatorStatus = 'invited' | 'accepted' | 'completed' | 'declined';
export type EvaluatorFeeType = '3.3' | '8.8' | '면세';

export interface ProgramEvaluator {
  id: string;
  program_id: string;
  staff_pool_id: string;
  eval_token: string;
  fee_amount: number;
  fee_type: EvaluatorFeeType;
  status: EvaluatorStatus;
  invited_at: string;
  accepted_at?: string | null;
  completed_at?: string | null;
  note?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
}

export interface EvaluationScore {
  id: string;
  program_evaluator_id: string;
  application_id: string;
  category: string;
  score: number;
  max_score: number;
  comment?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── STEP-MEMBER-INVITE 팀원 이메일 초대 ──────────────────────
export interface MemberInvitation {
  id: string;
  email: string;
  /** 소문자 role: admin / pm / staff / finance / partner / member */
  role: string;
  department?: string | null;
  position?: string | null;
  token: string;
  status: MemberInvitationStatus;
  invited_by?: string | null;
  accepted_at?: string | null;
  expires_at: string;
  created_at: string;
  deleted_at?: string | null;
}

// ─── STEP-PROJECT-RESTRUCTURE 프로젝트 문서·결과보고서 ────
export type ProjectDocType = 'estimate' | 'operation_plan' | 'deliverable' | 'photo' | 'other';
export type ProjectDocStage = 'sales' | 'active' | 'wrap';

export interface ProjectDocument {
  id: string;
  project_id: string;
  doc_type: ProjectDocType;
  doc_stage: ProjectDocStage;
  file_name: string;
  file_url: string;
  file_size?: number | null;
  description?: string | null;
  category?: string | null;
  created_by?: string | null;
  created_at: string;
  deleted_at?: string | null;
}

export type FinalReportSectionType =
  | 'text' | 'auto_participants' | 'auto_attendance' | 'auto_expenses' | 'photo_gallery';

export interface FinalReportSection {
  id: string;
  project_id: string;
  title: string;
  content?: string | null;
  section_type: FinalReportSectionType;
  display_order: number;
  created_at: string;
  updated_at: string;
}

export interface FinalReportPhoto {
  id: string;
  section_id: string;
  file_url: string;
  caption?: string | null;
  display_order: number;
  created_at: string;
}

// ─── STEP-PARTICIPANT-PORTAL 참여자 통합 토큰 ─────────────
export type ParticipantRole = 'participant' | 'mentor' | 'client' | 'ta' | 'observer';
/** STEP-PROGRAM-ENHANCE-FULL — 'pending'·'dropped' 추가
 *  STEP-PARTICIPANTS-LIST-UPDATE — 'incomplete' (미수료: 교육 완료했으나 조건 미달) 추가 */
export type ParticipantStatus = 'active' | 'inactive' | 'completed' | 'pending' | 'dropped' | 'incomplete';

export interface ProgramParticipant {
  id: string;
  program_id: string;
  profile_id?: string | null;
  name: string;
  email?: string | null;
  phone?: string | null;
  /** STEP-PROGRAM-ENHANCE-FULL — 소속 */
  organization?: string | null;
  /** STEP-PROGRAM-ENHANCE-FULL — 주민번호 (마스킹 표시, 평문 저장은 RLS로 보호) */
  id_number?: string | null;
  role: ParticipantRole;
  access_token: string;
  token_expires_at?: string | null;
  status: ParticipantStatus;
  completed_at?: string | null;
  memo?: string | null;
  created_by?: string | null;
  created_at: string;
  updated_at: string;
  /** STEP-PARTICIPANTS-LIST-UPDATE — 사용자 정의 순서 (drag ▲▼ 정렬) */
  display_order?: number | null;
}

/** STEP-PROGRAM-ENHANCE-FULL — 차시별 출석 (AI 자동 처리 결과 포함) */
export interface ProgramAttendanceRecord {
  id: string;
  program_id: string;
  curriculum_id?: string | null;
  participant_id?: string | null;
  day_label?: string | null;
  is_present: boolean;
  note?: string | null;
  created_at: string;
}

/** STEP-PROGRAM-ENHANCE-FULL — 프로그램 단위 결과보고서 섹션 */
/** STEP-PROGRAM-REPORT-TAB — 'participants' 추가 */
/** STEP-PROGRAM-UX-B — 'goals' | 'budget' | 'improvements' 추가 (결과보고서 표준 항목) */
export type ProgramReportSectionKey =
  | 'overview' | 'goals' | 'curriculum' | 'participants' | 'attendance'
  | 'satisfaction' | 'outcomes' | 'budget' | 'improvements' | 'extra'
  | string; // STEP-PROGRAM-UX-B — custom_ prefix 키 허용

export interface ProgramReportSection {
  id: string;
  program_id: string;
  section_key: ProgramReportSectionKey;
  content?: string | null;
  sort_order: number;
  updated_at: string;
}

// ─── STEP-INSTRUCTOR-INVITE-A 강사 자기 입력 프로필 ───────
export interface InstructorCareerEntry {
  [key: string]: string | undefined;
  org?: string;
  role?: string;
  period?: string;
}

export interface InstructorAwardEntry {
  [key: string]: string | undefined;
  name?: string;
  year?: string;
}

export interface InstructorProfile {
  id: string;
  invitation_id: string;
  profile_id?: string | null;
  real_name: string;
  phone?: string | null;
  email?: string | null;
  id_number?: string | null;
  bio?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
  bank_holder?: string | null;
  career_json: InstructorCareerEntry[];
  awards_json: InstructorAwardEntry[];
  photo_url?: string | null;
  bankbook_url?: string | null;
  id_card_url?: string | null;
  lecture_file_url?: string | null;
  privacy_agreed: boolean;
  privacy_agreed_at?: string | null;
  submitted: boolean;
  submitted_at?: string | null;
  created_at: string;
  updated_at: string;
}

// ─── STEP-SURVEY 만족도 문항·응답 ─────────────────────────
export type SurveyQuestionType = 'star' | 'text';
export type SurveyQuestionPhase = 'pre' | 'post' | 'both';
export type SurveyResponsePhase = 'pre' | 'post';

export interface SurveyQuestion {
  id: string;
  program_id: string;
  order_index: number;
  question_text: string;
  question_type: SurveyQuestionType;
  phase: SurveyQuestionPhase;
  created_at: string;
}

export interface SurveyResponse {
  id: string;
  program_id: string;
  question_id: string;
  respondent_token?: string | null;
  respondent_id?: string | null;
  answer_score?: number | null;
  answer_text?: string | null;
  phase: SurveyResponsePhase;
  created_at: string;
}

export type MemberRequestStatus = 'pending' | 'approved' | 'rejected';

export interface MemberRequest {
  id: string;
  name: string;
  email: string;
  phone?: string | null;
  department?: string | null;
  position?: string | null;
  message?: string | null;
  status: MemberRequestStatus;
  reviewed_by?: string | null;
  reviewed_at?: string | null;
  reject_reason?: string | null;
  created_at: string;
}

// ============================================================
// STEP-ACCOUNTING-ALL — 회계 관리 시스템 타입
// ============================================================

export type VatType = '과세' | '면세' | '영세율';
// STEP-CONTRACT-AUTO — 'draft' 추가 (자동 생성 대기 상태)
export type ContractStatus = 'draft' | '진행중' | '완료' | '취소' | '보류';
export type ContractLifecycleStage = 'proposal' | 'contract' | 'operation' | 'closing';

export interface BillingScheduleItem {
  seq: number;
  amount: number;
  due_date: string;
  status: 'pending' | 'issued' | 'paid';
}

export interface IncomeContract {
  id: string;
  project_id: string | null;
  program_id: string | null; // STEP-ACCOUNTING-FOLLOWUP3
  consortium_id: string | null; // STEP-ACCOUNTING-FOLLOWUP4
  client_id: string | null;
  billing_contact_id: string | null; // STEP-ACCOUNTING-FOLLOWUP6 — 세금계산서 담당자
  // STEP-CONTRACT-AUTO — 라이프사이클 + 자동 생성 플래그 + 주관기관 서류 요청 포털
  lifecycle_stage: ContractLifecycleStage | null;
  auto_created: boolean;
  doc_request_pending: boolean;
  portal_id: string | null;
  contract_name: string;
  contract_amount: number;
  vat_type: VatType;
  contract_date: string | null;
  billing_schedule: BillingScheduleItem[];
  status: ContractStatus;
  tax_invoice_url: string | null;
  contract_file_url: string | null;
  deposited_at: string | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

// STEP-ACCOUNTING-FOLLOWUP2 — expense_type 자유 입력 (5개 기본 + 박경수님 임의 세부항목)
// CHECK 제약 제거된 상태라 타입은 string 으로 유연화. 5개 기본 옵션은 const 로 유지.
export type PayrollExpenseType = string;
export const PAYROLL_BASE_TYPES = ['강사료', '촬영', '운영비', '운영인건비', '기타외주'] as const;
// STEP-ACCOUNTING-FOLLOWUP2 — '10' 부가세 10% (포함) 옵션 추가
export type PayrollTaxRateType = '3.3' | '8.8' | '10' | '면세' | '없음';
export type PayrollPaymentStatus = '대기' | '완료' | '후순위' | '취소';

export interface PayrollExpense {
  id: string;
  project_id: string | null;
  program_id: string | null;
  contract_id: string | null; // STEP-ACCOUNTING-FOLLOWUP7 — 수입/계약 연결
  expense_type: PayrollExpenseType;
  description: string | null;
  payee_name: string;
  payee_id_no: string | null;
  bank_name: string | null;
  bank_account: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  tax_rate_type: PayrollTaxRateType;
  tax_amount: number;
  net_amount: number;
  payment_status: PayrollPaymentStatus;
  paid_at: string | null;
  receipt_urls: string[];
  staff_pool_id: string | null;
  memo: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export type AccountingReviewStatus = 'pending' | 'reviewing' | 'completed';

export interface AccountingReview {
  id: string;
  period_label: string;
  project_ids: string[];
  token: string;
  firm_name: string | null;
  firm_email: string | null;
  status: AccountingReviewStatus;
  sent_at: string | null;
  completed_at: string | null;
  expires_at: string;
  created_by: string | null;
  created_at: string;
}

export type AccountingReviewItemStatus = 'pending' | 'approved' | 'revision';

export interface AccountingReviewItem {
  id: string;
  review_id: string;
  payroll_expense_id: string;
  review_status: AccountingReviewItemStatus;
  revision_note: string | null;
  reviewed_at: string | null;
  created_at: string;
}

// ============================================================
// STEP-TAGS-2B-3B — 고객사·전문가 분류 태그 (관리자 동적 관리)
// ============================================================
export type TagScope = 'client' | 'staff';

export interface TagCategory {
  id: string;
  scope: TagScope;
  name: string;
  order_index: number;
  color: string | null;
  created_by: string | null;
  created_at: string;
}

// ============================================================
// STEP-ACCOUNTING-FOLLOWUP7-Phase2 — 견적서 시스템
// ============================================================

export interface ProjectEstimate {
  id: string;
  project_id: string | null;
  program_id: string | null;
  contract_id: string | null;
  title: string;
  total_amount: number;
  memo: string | null;
  created_by: string | null;
  created_at: string;
  updated_at: string;
  deleted_at: string | null;
}

export interface EstimateItem {
  id: string;
  estimate_id: string;
  program_id: string | null;  // 박경수님 요청 — 항목별 프로그램 연결 (1 프로젝트 : N 프로그램)
  category: string; // '강사료', '운영비', '교통비', ... — 자유 입력
  description: string | null;
  payee_name: string | null;
  unit_price: number;
  quantity: number;
  headcount: number;  // 박경수님 요청 — 수량(인원). subtotal = unit_price × quantity × headcount
  subtotal: number; // GENERATED — DB 가 자동 계산 (3중 곱)
  tax_rate_type: PayrollTaxRateType;
  memo: string | null;
  order_index: number;
  payroll_expense_id: string | null; // 외주/급여 변환 시 참조
  created_at: string;
}
