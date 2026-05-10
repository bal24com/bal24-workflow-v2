// bal24 v2 — STEP-GRANT-LEDGER 타입·라벨

export type GrantLedgerType = 'allocated' | 'disbursed' | 'returned' | 'adjusted';
export type GrantFundType   = 'grant' | 'self';
export type GrantExpStatus  = 'submitted' | 'approved' | 'rejected';

export const GRANT_LEDGER_TYPE_LABELS: Record<GrantLedgerType, string> = {
  allocated: '배정',
  disbursed: '집행',
  returned:  '반환',
  adjusted:  '조정',
};

export const GRANT_LEDGER_TYPE_TONE: Record<GrantLedgerType, string> = {
  allocated: 'bg-violet-100 text-violet-700 border-violet-200',
  disbursed: 'bg-cyan-100 text-cyan-700 border-cyan-200',
  returned:  'bg-orange-100 text-orange-700 border-orange-200',
  adjusted:  'bg-slate-100 text-slate-700 border-slate-200',
};

export const GRANT_FUND_TYPE_LABELS: Record<GrantFundType, string> = {
  grant: '지원금',
  self:  '자부담',
};

export const GRANT_FUND_TYPE_TONE: Record<GrantFundType, string> = {
  grant: 'bg-violet-50 text-violet-700 border-violet-200',
  self:  'bg-amber-50 text-amber-700 border-amber-200',
};

export const GRANT_EXP_STATUS_LABELS: Record<GrantExpStatus, string> = {
  submitted: '검토대기',
  approved:  '승인',
  rejected:  '반려',
};

export const GRANT_EXP_STATUS_TONE: Record<GrantExpStatus, string> = {
  submitted: 'bg-amber-50 text-amber-700 border-amber-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-rose-50 text-rose-700 border-rose-200',
};

export interface GrantLedger {
  id:           string;
  project_id:   string;
  program_id:   string | null;
  ledger_type:  GrantLedgerType;
  amount:       number;
  description:  string | null;
  ledger_date:  string;
  created_by:   string | null;
  created_at:   string;
  updated_at:   string;
}

export interface GrantExpenditure {
  id:                 string;
  project_id:         string;
  program_id:         string | null;
  grant_ledger_id:    string | null;
  item_name:          string;
  account_code:       string | null;
  expenditure_date:   string;
  amount:             number;
  fund_type:          GrantFundType;
  vendor_name:        string | null;
  vendor_biz_reg_no:  string | null;
  vendor_rep_name:    string | null;
  vendor_address:     string | null;
  receipt_url:        string | null;
  biz_reg_url:        string | null;
  bank_copy_url:      string | null;
  inspection_url:     string | null;
  contract_url:       string | null;
  quote_url:          string | null;
  docs_submitted:     boolean;
  docs_verified_at:   string | null;
  docs_verified_by:   string | null;
  status:             GrantExpStatus;
  reject_reason:      string | null;
  notes:              string | null;
  created_by:         string | null;
  created_at:         string;
  updated_at:         string;
}

export interface GrantSummary {
  allocated:  number;
  disbursed:  number;
  returned:   number;
  balance:    number;
  selfAmount: number;
}
