// bal24 v2 — 컨소시엄 독립 홈 순수 유틸 함수 (STEP-CON)

import type { ConsortiumMember, MemberBudget, ConsortiumStatus } from './consortiumTypes';

/** 수행과업 지분율 합계 */
export function sumSharePct(members: ConsortiumMember[]): number {
  return members.reduce((acc, m) => acc + Number(m.task_share_pct ?? 0), 0);
}

// STEP-CONSORTIUM-UPGRADE-FULL (2026-05-28) — 역할 3분류 헬퍼
/** 멤버 표시 이름 — 자사면 '(주)밸런스닷', 외부 협력사면 client.name */
export function memberDisplayName(m: ConsortiumMember): string {
  if (m.is_self) return '(주)밸런스닷';
  return m.clients?.name ?? '(이름 없음)';
}
/** 멤버 역할 라벨 (주관사/참여사) */
export function memberRoleLabel(m: ConsortiumMember): string {
  return m.role === 'lead' ? '주관사' : '참여사';
}
/** 멤버 배지 스타일 — 주관사=보라, 자사 참여사=노랑, 외부 참여사=에메랄드 */
export function memberRoleBadgeClass(m: ConsortiumMember): string {
  if (m.role === 'lead') return 'bg-violet-100 text-violet-700 border-violet-200';
  if (m.is_self) return 'bg-amber-100 text-amber-800 border-amber-200';
  return 'bg-emerald-100 text-emerald-700 border-emerald-200';
}
/** 지분율 합계 100% 검증 */
export function validateRatioSum(members: ConsortiumMember[]): { valid: boolean; total: number } {
  const total = sumSharePct(members);
  return { valid: Math.abs(total - 100) < 0.01, total };
}

/** 참여사별 예산 집행 현황 집계 */
export function buildMemberBudgets(members: ConsortiumMember[]): MemberBudget[] {
  return members.map((m) => {
    const allocated = Number(m.allocated_budget ?? 0);
    const spent = Number(m.spent_amount ?? 0);
    return {
      clientId: m.client_id ?? '',
      clientName: m.is_self ? '(주)밸런스닷' : (m.clients?.name ?? '(이름 없음)'),
      memberType: m.member_type,
      taskSharePct: Number(m.task_share_pct ?? 0),
      allocatedBudget: allocated,
      spentAmount: spent,
      remainingBudget: allocated - spent,
      executionRate: allocated > 0 ? Math.round((spent / allocated) * 100) : 0,
    };
  });
}

/** 컨소시엄 상태 → 배지 클래스 (statusStyles 와 별개로 박경수님 명세 준수) */
export function getStatusBadgeClass(status: ConsortiumStatus): string {
  const map: Record<ConsortiumStatus, string> = {
    구성중: 'bg-slate-100 text-slate-600 border-slate-300',
    진행: 'bg-violet-100 text-violet-700 border-violet-200',
    완료: 'bg-emerald-100 text-emerald-700 border-emerald-200',
    해산: 'bg-rose-100 text-rose-700 border-rose-200',
  };
  return map[status] ?? 'bg-slate-100 text-slate-500 border-slate-200';
}

/** 링크 전체 URL 생성 */
export function buildFullUrl(urlPath: string): string {
  if (typeof window === 'undefined') return urlPath;
  const envBase = (import.meta.env.VITE_APP_URL as string | undefined) ?? '';
  const base = envBase || window.location.origin;
  return `${base}${urlPath}`;
}

/** 숫자 → 원화 포맷 */
export function formatKRW(amount: number): string {
  if (!Number.isFinite(amount)) return '0원';
  return `${Math.round(amount).toLocaleString('ko-KR')}원`;
}

/** 날짜 → 'YYYY.MM.DD' 포맷 */
export function formatConDate(dateStr: string | null): string {
  if (!dateStr) return '-';
  const d = new Date(dateStr);
  if (Number.isNaN(d.getTime())) return '-';
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const dd = String(d.getDate()).padStart(2, '0');
  return `${y}.${m}.${dd}`;
}

/** D-day 계산 */
export function dDayLabel(targetDate: string | null): string {
  if (!targetDate) return '기한 없음';
  const target = new Date(`${targetDate}T00:00:00`);
  const now = new Date();
  now.setHours(0, 0, 0, 0);
  const diff = Math.ceil((target.getTime() - now.getTime()) / 86400000);
  if (diff < 0) return '만료';
  if (diff === 0) return 'D-day';
  return `D-${diff}`;
}

/** 단계 진행 인덱스 (구성중=0, 진행=1, 완료=2, 해산=3) */
export function getStageIndex(status: ConsortiumStatus): number {
  const order: Record<ConsortiumStatus, number> = {
    구성중: 0,
    진행: 1,
    완료: 2,
    해산: 3,
  };
  return order[status] ?? 0;
}
