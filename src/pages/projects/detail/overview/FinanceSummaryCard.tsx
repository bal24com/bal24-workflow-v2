// bal24 v2 — 프로젝트 개요 · 재무 요약 카드
// 박경수님 + SkyClaw STEP-FINANCE-SUMMARY-REDESIGN (2026-05-28) — 예산·견적 삭제, 계약금액 기준 순지출·잔여·이익율

import { useEffect, useState } from 'react';
import { Wallet, Loader2 } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { formatMoney } from '../../../../lib/utils';
import { fetchProjectFinance, type ProjectFinance } from '../projectDetailUtils';

export default function FinanceSummaryCard({ projectId }: { projectId: string }) {
  const toast = useToast();
  const [data, setData] = useState<ProjectFinance | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const res = await fetchProjectFinance(projectId);
        if (cancelled) return;
        setData(res);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[project-detail] 재무 요약 로드 실패:', raw);
        toast.error('재무 요약을 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [projectId, toast]);

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
      <header className="flex items-center gap-1.5">
        <Wallet size={16} className="text-emerald-500" aria-hidden="true" />
        <h3 className="text-sm font-bold text-[#1E1B4B]">재무 요약</h3>
      </header>

      {loading || !data ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : (
        (() => {
          // STEP-FINANCE-SUMMARY-REDESIGN — 계약금액 기준 사업부가세·잔여·이익율 (인라인 계산)
          const contractTotal = data.contractTotal;
          const businessVat = Math.round(contractTotal * 0.1) - data.vatAmount; // 매출세액 − 매입세액
          const remaining = contractTotal - data.netExpense;
          const profitPct = contractTotal > 0
            ? Math.round((remaining / contractTotal) * 1000) / 10
            : 0;
          return (
        <div className="flex flex-col gap-2.5">
          {/* 전체 사업비 (계약금액 합) — 상단 강조 */}
          <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 -mx-1">
            <div className="flex items-center justify-between">
              <span className="text-xs font-bold text-violet-700">전체 사업비 (계약금액)</span>
              <span className="text-sm font-bold text-violet-700 tabular-nums">{formatMoney(contractTotal)}</span>
            </div>
            <div className="flex items-center justify-between mt-0.5">
              <span className="text-[10px] text-violet-500">└ 입금 완료</span>
              <span className="text-[10px] text-violet-500 tabular-nums">{formatMoney(data.incomeTotal)}</span>
            </div>
          </div>

          <Divider />

          {/* 지출계 (세액 포함) + 운영비·인건비 분리 + 박경수님 + SkyClaw 2026-05-28: [집행 완료] 행 */}
          <div>
            <div className="flex items-center justify-between">
              <div className="flex flex-col">
                <span className="text-xs font-bold text-orange-700">지출계 (예정 포함)</span>
                <span className="text-[10px] text-slate-400">취소 제외 — 대기·완료·후순위 모두 포함</span>
              </div>
              <span className="text-sm font-bold text-orange-700 tabular-nums">{formatMoney(data.expenseTotal)}</span>
            </div>
            {data.operationTotal > 0 && (
              <Row label="└ 운영비" value={formatMoney(data.operationTotal)} accent="orange" small />
            )}
            {data.outsourceTotal > 0 && (
              <Row label="└ 인건비" value={formatMoney(data.outsourceTotal)} accent="orange" small />
            )}
            <div className="flex items-center justify-between mt-1 pt-1 border-t border-orange-100">
              <span className="text-[11px] text-emerald-700">✓ 집행 완료 (지급 완료만)</span>
              <span className="text-xs text-emerald-700 tabular-nums font-semibold">{formatMoney(data.paidExpenseTotal)}</span>
            </div>
          </div>

          {/* 세액 박스 (원천세 + 외주부가세 + 사업부가세) */}
          {(data.withholdingTax > 0 || data.vatAmount > 0 || contractTotal > 0) && (
            <div className="rounded-lg bg-amber-50 border border-amber-100 px-3 py-2 space-y-1 -mx-1">
              {data.withholdingTax > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-orange-700">▲ 원천세 (인건비 원천징수)</span>
                  <span className="text-orange-700 tabular-nums">{formatMoney(data.withholdingTax)}</span>
                </div>
              )}
              {data.vatAmount > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-orange-700">▲ 외주 부가세 (매입세액)</span>
                  <span className="text-orange-700 tabular-nums">{formatMoney(data.vatAmount)}</span>
                </div>
              )}
              {contractTotal > 0 && (
                <div className="flex items-center justify-between text-xs pt-1 border-t border-amber-200">
                  <span className="text-blue-700">└ 사업 부가세 (매출세액 10% − 외주부가세)</span>
                  <span className="text-blue-700 tabular-nums">{formatMoney(businessVat)}</span>
                </div>
              )}
            </div>
          )}

          <Divider />

          {/* 순지출 (세액 제외) */}
          <div>
            <Row label="순지출 (세액 제외)" value={formatMoney(data.netExpense)} accent="slate" />
            <Row label="└ 지출 총액 (세액 포함)" value={formatMoney(data.expenseTotal)} accent="slate" small />
          </div>

          <Divider />

          {/* 잔여 (전체 사업비 − 순지출) + 이익율 */}
          <div>
            <div className="flex items-center justify-between">
              <span className={`text-xs font-bold ${remaining < 0 ? 'text-rose-600' : 'text-violet-700'}`}>
                잔여 (전체 사업비 − 순지출)
              </span>
              <span className={`text-sm font-bold tabular-nums ${remaining < 0 ? 'text-rose-600' : 'text-violet-700'}`}>
                {contractTotal > 0 ? formatMoney(remaining) : '—'}
              </span>
            </div>
            {contractTotal > 0 && (
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-slate-400">└ 예산 대비 (이익율)</span>
                <span className={`text-[10px] tabular-nums font-semibold ${profitPct >= 0 ? 'text-emerald-600' : 'text-rose-600'}`}>
                  {profitPct >= 0 ? '+' : ''}{profitPct}%
                </span>
              </div>
            )}
          </div>
        </div>
          );
        })()
      )}
    </section>
  );
}

type Accent = 'violet' | 'emerald' | 'orange' | 'rose' | 'slate';

const ACCENT_STYLE: Record<Accent, string> = {
  violet: 'text-violet-700',
  emerald: 'text-emerald-600',
  orange: 'text-orange-600',
  rose: 'text-rose-600',
  slate: 'text-slate-700',
};

function Divider() {
  return <div className="border-t border-violet-100 -mx-1" aria-hidden="true" />;
}

function Row({
  label,
  value,
  accent,
  small,
}: {
  label: string;
  value: string;
  accent: Accent;
  small?: boolean;
}) {
  return (
    <div className="flex items-center justify-between">
      <span className={`text-xs ${small ? 'text-slate-400' : 'text-slate-500'}`}>{label}</span>
      <span className={`tabular-nums font-bold ${small ? 'text-xs' : 'text-sm'} ${ACCENT_STYLE[accent]}`}>
        {value}
      </span>
    </div>
  );
}
