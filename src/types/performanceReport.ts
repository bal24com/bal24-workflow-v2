// bal24 v2 — STEP-PERFORMANCE-REPORT-DB 사업실적보고서 타입

export type ReportStatus =
  | 'draft'
  | 'submitted'
  | 'reviewing'
  | 'approved'
  | 'rejected';

export const REPORT_STATUS_LABELS: Record<ReportStatus, string> = {
  draft:      '작성중',
  submitted:  '제출완료',
  reviewing:  '검토중',
  approved:   '승인',
  rejected:   '반려',
};

export const REPORT_STATUS_TONE: Record<ReportStatus, string> = {
  draft:      'secondary',
  submitted:  'primary',
  reviewing:  'accent',
  approved:   'success',
  rejected:   'destructive',
};

export interface PerformanceReport {
  id:                 string;
  project_id:         string | null;
  program_id:         string | null;
  application_id:     string | null;
  company_name:       string | null;
  rep_name:           string | null;
  manager_name:       string | null;
  partner_company:    string | null;
  total_budget:       number | null;
  grant_budget:       number | null;
  self_budget:        number | null;
  total_executed:     number | null;
  grant_executed:     number | null;
  self_executed:      number | null;
  business_summary:   string | null;
  sales_method:       string | null;
  achievement_notes:  string | null;
  photo_urls:         string[] | null;
  status:             ReportStatus;
  submitted_at:       string | null;
  reject_reason:      string | null;
  pm_reviewed_by:     string | null;
  pm_reviewed_at:     string | null;
  pm_comment:         string | null;
  mentor_feedback:    string | null;
  mentor_id:          string | null;
  audit_token:        string | null;
  audit_submitted_at: string | null;
  audit_report_url:   string | null;
  audit_comment:      string | null;
  created_at:         string;
  updated_at:         string;
}

export interface PerformanceTarget {
  id:               string;
  report_id:        string;
  metric_name:      string;
  planned_value:    string | null;
  actual_value:     string | null;
  achievement_rate: number | null;
  sort_order:       number;
  created_at:       string;
}

export interface PerformanceExpenditureItem {
  id:             string;
  report_id:      string;
  category:       string;
  sub_category:   string | null;
  grant_budget:   number | null;
  self_budget:    number | null;
  grant_executed: number | null;
  self_executed:  number | null;
  notes:          string | null;
  sort_order:     number;
  created_at:     string;
}

// 기본 목표성과 행 (신규 보고서 생성 시 초기값)
export const DEFAULT_TARGETS: Omit<PerformanceTarget,
  'id' | 'report_id' | 'created_at'>[] = [
  { metric_name: '매출액',      planned_value: '', actual_value: '', achievement_rate: null, sort_order: 0 },
  { metric_name: '신규고용 창출', planned_value: '', actual_value: '', achievement_rate: null, sort_order: 1 },
  { metric_name: '유료 모객 수', planned_value: '', actual_value: '', achievement_rate: null, sort_order: 2 },
  { metric_name: '홍보 성과',   planned_value: '', actual_value: '', achievement_rate: null, sort_order: 3 },
];

// 기본 비목별 집행내역 행
export const DEFAULT_EXPENDITURE_ITEMS: Omit<PerformanceExpenditureItem,
  'id' | 'report_id' | 'created_at'>[] = [
  { category: '운영비',    sub_category: '재료비',     grant_budget: null, self_budget: null, grant_executed: null, self_executed: null, notes: null, sort_order: 0 },
  { category: '운영비',    sub_category: '외주용역비', grant_budget: null, self_budget: null, grant_executed: null, self_executed: null, notes: null, sort_order: 1 },
  { category: '광고홍보비', sub_category: '온라인홍보비', grant_budget: null, self_budget: null, grant_executed: null, self_executed: null, notes: null, sort_order: 2 },
];
