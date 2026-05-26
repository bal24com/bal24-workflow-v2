// bal24 v2 — STEP-CONSORTIUM-REDESIGN (박경수님 2026-05-27)
// 참여사 표시 헬퍼 — 정산 방향 배지·역할 배지·지분율 합계 등.

import type { ConsortiumMember, ConsortiumSettlementDirection } from '../../types/database';

export function getDirectionBadge(direction: ConsortiumSettlementDirection | string | null | undefined) {
  switch (direction) {
    case 'outbound':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-amber-100 text-amber-700">→ 지급</span>;
    case 'inbound':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-teal-100 text-teal-700">← 수령</span>;
    case 'none':
      return <span className="inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-slate-100 text-slate-500">해당 없음</span>;
    default:
      return <span className="text-[10px] text-slate-400">—</span>;
  }
}

export function getRoleBadge(role: string | null | undefined, isSelf: boolean | null | undefined) {
  return (
    <div className="inline-flex items-center gap-1">
      {isSelf && (
        <span className="text-[10px] font-bold px-1.5 py-0.5 bg-violet-100 text-violet-700 rounded">자사</span>
      )}
      <span className="text-xs text-slate-700">{role ?? '참여사'}</span>
    </div>
  );
}

/** 지분율 합계 (0~100). null 은 0 으로 합산. */
export function calcTotalShareRate(members: ConsortiumMember[]): number {
  return members.reduce((sum, m) => sum + (Number(m.share_rate) || 0), 0);
}

/** 자사 멤버 1명만 허용 — 추가 등록 시 검증. */
export function findSelfMember(members: ConsortiumMember[]): ConsortiumMember | null {
  return members.find((m) => m.is_self === true) ?? null;
}

/** 총사업비 × 지분율 / 100 자동계산. */
export function calcBudgetFromShare(totalBudget: number | null | undefined, shareRate: number): number {
  if (!totalBudget || !shareRate) return 0;
  return Math.floor((Number(totalBudget) * shareRate) / 100);
}

export function formatShareRate(rate: number | null | undefined): string {
  if (rate == null) return '0%';
  return `${Number(rate).toFixed(rate % 1 === 0 ? 0 : 1)}%`;
}

export function formatBudget(amount: number | null | undefined): string {
  if (amount == null) return '-';
  return `${Math.round(Number(amount)).toLocaleString('ko-KR')}원`;
}
