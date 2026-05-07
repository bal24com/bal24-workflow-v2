// bal24 v2 — 상태 배지 스타일 공통 헬퍼
// 박경수님 디자인 시스템 통일 패턴 (단계 1: 헬퍼 신규 / 단계 2: 페이지 적용).
//
// 사용 예:
//   <span className={`${BADGE_BASE} ${PROJECT_STATUS_STYLE[p.status]}`}>{p.status}</span>

import type {
  ProjectStatus,
  TaskStatus,
  ProgramStatus,
  ProgramType,
  IncomeStatus,
  ExpenseStatus,
  InvitationStatus,
} from '../types/database';

export const BADGE_BASE =
  'inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border';

// ─── 프로젝트 상태 ──────────────────────────────
export const PROJECT_STATUS_STYLE: Record<ProjectStatus, string> = {
  제안: 'bg-slate-100 text-slate-400 border-slate-300',
  진행: 'bg-violet-50 text-violet-600 border-violet-200',
  정산: 'bg-orange-50 text-orange-500 border-orange-200',
  종료: 'bg-cyan-50 text-cyan-500 border-cyan-200',
};

// ─── 태스크 상태 ────────────────────────────────
export const TASK_STATUS_STYLE: Record<TaskStatus, string> = {
  인식: 'bg-slate-100 text-slate-400 border-slate-300',
  실행: 'bg-violet-50 text-violet-600 border-violet-200',
  검토: 'bg-orange-50 text-orange-500 border-orange-200',
  완료: 'bg-emerald-50 text-emerald-600 border-emerald-200',
};

// ─── 프로그램 상태 ──────────────────────────────
export const PROGRAM_STATUS_STYLE: Record<ProgramStatus, string> = {
  준비: 'bg-slate-100 text-slate-400 border-slate-300',
  진행: 'bg-violet-50 text-violet-600 border-violet-200',
  완료: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  취소: 'bg-rose-50 text-rose-500 border-rose-200',
};

// ─── 프로그램 유형 ──────────────────────────────
export const PROGRAM_TYPE_STYLE: Record<ProgramType, string> = {
  교육: 'bg-violet-50 text-violet-600 border-violet-200',
  캠프: 'bg-orange-50 text-orange-500 border-orange-200',
  행사: 'bg-cyan-50 text-cyan-500 border-cyan-200',
  기타: 'bg-slate-100 text-slate-500 border-slate-300',
};

// ─── 수입 상태 ──────────────────────────────────
export const INCOME_STATUS_STYLE: Record<IncomeStatus, string> = {
  대기: 'bg-slate-100 text-slate-400 border-slate-300',
  입금완료: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  반려: 'bg-rose-50 text-rose-500 border-rose-200',
};

// ─── 지출 상태 ──────────────────────────────────
export const EXPENSE_STATUS_STYLE: Record<ExpenseStatus, string> = {
  대기: 'bg-slate-100 text-slate-400 border-slate-300',
  출금완료: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  반려: 'bg-rose-50 text-rose-500 border-rose-200',
};

// ─── 강사 초대 상태 ────────────────────────────
export const INVITATION_STATUS_STYLE: Record<InvitationStatus, string> = {
  대기: 'bg-slate-100 text-slate-400 border-slate-300',
  수락: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  거절: 'bg-rose-50 text-rose-500 border-rose-200',
  완료: 'bg-violet-50 text-violet-600 border-violet-200',
};
