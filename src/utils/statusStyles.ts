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
  ConsortiumStatus,
  ParticipantStatus,
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

// ─── 강사 초대 상태 (STEP-INVITE-APPROVE-PART1) ────
//   대기: 초대 발송 후 미응답 / 제출: 강사 응답 완료, 담당자 승인 대기
//   수락: 담당자 승인 완료 / 거절: 강사 거절 / 교체됨: 관리자 교체 처리
export const INVITATION_STATUS_STYLE: Record<InvitationStatus, string> = {
  대기:   'bg-amber-50 text-amber-700 border-amber-200',
  제출:   'bg-blue-50 text-blue-700 border-blue-200',
  수락:   'bg-emerald-50 text-emerald-600 border-emerald-200',
  거절:   'bg-red-50 text-red-600 border-red-200',
  교체됨: 'bg-slate-100 text-slate-500 border-slate-300',
};

// ─── 컨소시엄 상태 ──────────────────────────────
export const CONSORTIUM_STATUS_STYLE: Record<ConsortiumStatus, string> = {
  구성중: 'bg-slate-100 text-slate-400 border-slate-300',
  진행: 'bg-violet-50 text-violet-600 border-violet-200',
  완료: 'bg-emerald-50 text-emerald-600 border-emerald-200',
  해산: 'bg-rose-50 text-rose-500 border-rose-200',
};

// ─── 참여자 상태 (STEP-PARTICIPANTS-LIST-UPDATE) ────────────
// DB는 영문 enum (active/pending/completed/incomplete/dropped/inactive). UI 라벨은 한글.
export const PARTICIPANT_STATUS_LABEL: Record<ParticipantStatus, string> = {
  pending:    '대기',
  active:     '진행',
  completed:  '수료',
  incomplete: '미수료',
  dropped:    '탈락',
  inactive:   '비활성',
};

export const PARTICIPANT_STATUS_STYLE: Record<ParticipantStatus, string> = {
  pending:    'bg-slate-100 text-slate-400 border-slate-300',
  active:     'bg-violet-50 text-violet-600 border-violet-200',
  completed:  'bg-emerald-50 text-emerald-600 border-emerald-200',
  incomplete: 'bg-amber-50 text-amber-600 border-amber-200',
  dropped:    'bg-rose-50 text-rose-500 border-rose-200',
  inactive:   'bg-slate-100 text-slate-400 border-slate-300',
};

// ─── 참여자 상태 — 한글 키 (개요 탭 명단 배지용, PART4) ──────────
// DB는 영문 enum → PARTICIPANT_STATUS_LABEL 로 한글 변환 후 이 맵으로 CSS 조회
export const PARTICIPANT_STATUS = ['대기', '진행', '수료', '미수료', '탈락', '비활성'] as const;
export type ParticipantStatusKo = typeof PARTICIPANT_STATUS[number];

export const PARTICIPANT_STATUS_KO_STYLE: Record<string, string> = {
  '대기':   'bg-slate-100 text-slate-400 border-slate-300',
  '진행':   'bg-violet-50 text-violet-600 border-violet-200',
  '수료':   'bg-emerald-50 text-emerald-600 border-emerald-200',
  '미수료': 'bg-amber-50 text-amber-600 border-amber-200',
  '탈락':   'bg-rose-50 text-rose-500 border-rose-200',
  '비활성': 'bg-slate-100 text-slate-400 border-slate-300',
};

// ─── 사업실적보고서 상태 (CLAUDE.md 디자인 시스템 — 회색/바이올렛/주황/민트) ─
import type { ReportStatus as PerformanceReportStatus } from '../types/performanceReport';
export const PERFORMANCE_REPORT_STATUS_CLASS: Record<PerformanceReportStatus, string> = {
  draft:     'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-violet-50 text-violet-700 border-violet-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  approved:  'bg-cyan-50 text-cyan-700 border-cyan-200',
  rejected:  'bg-orange-50 text-orange-700 border-orange-200',
};
