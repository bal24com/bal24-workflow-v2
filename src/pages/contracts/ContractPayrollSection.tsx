// 계약 상세 — 이 계약의 외주/급여 목록 + 추가 버튼
// STEP-ACCOUNTING-FOLLOWUP7

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { formatDateKo, formatMoney } from '../../lib/utils';
import { fetchPayrollByContract, type PayrollRow } from '../payroll/payrollUtils';
import PayrollExpenseFormModal from '../payroll/PayrollExpenseFormModal';

interface Props {
  contractId: string;
}

export default function ContractPayrollSection({ contractId }: Props) {
  const [items, setItems] = useState<PayrollRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const rows = await fetchPayrollByContract(contractId);
      setItems(rows);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[ContractPayrollSection] 조회 오류:', msg);
    } finally {
      setLoading(false);
    }
  }, [contractId]);

  useEffect(() => { void reload(); }, [reload]);

  const totalNet = items.reduce((s, r) => s + Number(r.net_amount || 0), 0);
  const totalGross = items.reduce((s, r) => s + Number(r.subtotal || 0), 0);

  return (
    <section>
      <div className="flex items-center justify-between mb-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">이 계약의 외주/급여</h3>
        <Button variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={() => setFormOpen(true)}>
          외주/급여 추가
        </Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-4 text-xs text-muted">
          <Loader2 size={14} className="animate-spin mr-1.5" />
          불러오는 중...
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 italic">이 계약에 연결된 외주/급여가 아직 없어요.</p>
      ) : (
        <>
          <div className="grid grid-cols-2 gap-2 mb-2 text-xs">
            <div className="rounded-lg border border-slate-200 bg-slate-50/40 px-3 py-1.5">
              <div className="text-[10px] text-slate-500">세전 합계</div>
              <div className="font-bold tabular-nums text-text">{formatMoney(totalGross)}</div>
            </div>
            <div className="rounded-lg border border-violet-200 bg-violet-50/40 px-3 py-1.5">
              <div className="text-[10px] text-slate-500">실지급 합계</div>
              <div className="font-bold tabular-nums text-violet-700">{formatMoney(totalNet)}</div>
            </div>
          </div>
          <ul className="space-y-1 max-h-48 overflow-y-auto">
            {items.map((r) => (
              <li key={r.id} className="flex items-center gap-2 px-2.5 py-1.5 rounded-lg border border-slate-200 text-xs">
                <span className="text-[10px] text-slate-500 shrink-0">{r.paid_at ? formatDateKo(r.paid_at) : '미지급'}</span>
                <span className="text-slate-400 shrink-0">·</span>
                <span className="font-medium text-text shrink-0">{r.expense_type}</span>
                <span className="text-slate-700 truncate flex-1">{r.payee_name}{r.description && ` — ${r.description}`}</span>
                <span className="font-bold tabular-nums text-violet-700 shrink-0">{formatMoney(r.net_amount)}</span>
              </li>
            ))}
          </ul>
        </>
      )}

      <PayrollExpenseFormModal
        open={formOpen}
        target={null}
        defaultType="강사료"
        defaultContractId={contractId}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); void reload(); }}
      />
    </section>
  );
}
