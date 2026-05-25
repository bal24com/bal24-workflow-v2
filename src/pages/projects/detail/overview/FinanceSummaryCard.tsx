// bal24 v2 — 프로젝트 개요 · 재무 요약 카드 (V7 차용 / V2 표준)
// 예산·수입(입금완료)·지출(전체+대기)·잔여 + 진행률 바.

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
        <div className="flex flex-col gap-2.5">
          {/* 박경수님 + SkyClaw 2026-05-26 — 전체 사업비 (계약금액 합) 상단 강조 */}
          {data.contractTotal > 0 && (
            <div className="rounded-lg bg-violet-50 border border-violet-100 px-3 py-2 -mx-1">
              <div className="flex items-center justify-between">
                <span className="text-xs font-bold text-violet-700">전체 사업비 (계약금액)</span>
                <span className="text-sm font-bold text-violet-700 tabular-nums">{formatMoney(data.contractTotal)}</span>
              </div>
              <div className="flex items-center justify-between mt-0.5">
                <span className="text-[10px] text-violet-500">└ 입금 완료</span>
                <span className="text-[10px] text-violet-500 tabular-nums">{formatMoney(data.incomeTotal)}</span>
              </div>
            </div>
          )}
          <Row label="예산" value={data.budget > 0 ? formatMoney(data.budget) : '미정'} accent="violet" />
          {data.contractTotal === 0 && (
            <Row label="수입 (입금완료)" value={formatMoney(data.incomeTotal)} accent="emerald" />
          )}
          {data.expectedIncomeTotal > 0 && (
            <Row label="└ 예상 수입 (계약중)" value={formatMoney(data.expectedIncomeTotal)} accent="violet" small />
          )}

          {data.budget > 0 && (
            <div className="flex flex-col gap-1">
              <div className="h-2 rounded-full overflow-hidden bg-violet-50" aria-hidden="true">
                <div
                  className="h-full bg-gradient-to-r from-emerald-300 to-emerald-500 transition-all"
                  style={{ width: `${data.settledPct}%` }}
                />
              </div>
              <p className="text-[10px] text-slate-400 text-right tabular-nums">
                예산 대비 수금 {data.settledPct}%
              </p>
            </div>
          )}

          {/* 박경수님 요청 — 견적(제안) 합계 라인 */}
          {data.proposalTotal > 0 && (
            <Row label="제안 견적 (총)" value={formatMoney(data.proposalTotal)} accent="violet" small />
          )}

          <Row label="지출 합계" value={formatMoney(data.expenseTotal)} accent="orange" />
          {/* 박경수님 요청 — 인건비/운영비 분리 */}
          {data.outsourceTotal > 0 && (
            <Row label="└ 인건비 (외주·급여)" value={formatMoney(data.outsourceTotal)} accent="orange" small />
          )}
          {data.operationTotal > 0 && (
            <Row label="└ 운영비 (호텔·버스·재료 등)" value={formatMoney(data.operationTotal)} accent="orange" small />
          )}
          {data.pendingExpenseTotal > 0 && (
            <Row label="└ 미지급" value={formatMoney(data.pendingExpenseTotal)} accent="rose" small />
          )}

          {/* 박경수님 + SkyClaw STEP-FINANCE-LABEL-VAT (2026-05-26) — 매입/매출/납부 부가세 + 원천세 + 순지출 */}
          {(data.vatAmount > 0 || data.withholdingTax > 0 || data.salesVat > 0) && (
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
              {data.salesVat > 0 && (
                <div className="flex items-center justify-between text-xs">
                  <span className="text-blue-700">사업 부가세 (매출세액)</span>
                  <span className="text-blue-700 tabular-nums">{formatMoney(data.salesVat)}</span>
                </div>
              )}
              {(data.salesVat > 0 || data.vatAmount > 0) && (
                <div className="flex items-center justify-between text-xs font-bold pt-1 border-t border-amber-200">
                  <span className="text-slate-700">납부 부가세 (매출 − 매입)</span>
                  <span className={`tabular-nums ${data.vatPayable > 0 ? 'text-rose-700' : 'text-slate-400'}`}>
                    {formatMoney(data.vatPayable)}
                  </span>
                </div>
              )}
              <div className="flex items-center justify-between text-xs font-bold text-slate-700 pt-1 border-t border-amber-200">
                <span>순지출 (세액 제외)</span>
                <span className="tabular-nums">{formatMoney(data.netExpense)}</span>
              </div>
            </div>
          )}

          <div className="pt-2 border-t border-violet-100 flex items-center justify-between">
            <span className="text-xs font-semibold text-slate-500">잔여 (예산 − 지출)</span>
            <span
              className={`text-sm font-bold tabular-nums ${
                data.remaining < 0 ? 'text-rose-600' : 'text-violet-700'
              }`}
            >
              {data.budget > 0 ? formatMoney(data.remaining) : '—'}
            </span>
          </div>
        </div>
      )}
    </section>
  );
}

type Accent = 'violet' | 'emerald' | 'orange' | 'rose';

const ACCENT_STYLE: Record<Accent, string> = {
  violet: 'text-violet-700',
  emerald: 'text-emerald-600',
  orange: 'text-orange-600',
  rose: 'text-rose-600',
};

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
