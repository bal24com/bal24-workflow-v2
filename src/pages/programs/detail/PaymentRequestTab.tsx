// 프로그램 [지급요청] 탭 — 호텔/버스/재료비 등 운영 지출 목록 + 신규 등록
// 박경수님 요청: 저장 시 외주/급여 페이지(payroll_expenses)에 자동 노출

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, ReceiptText, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import PaymentRequestFormModal from './PaymentRequestFormModal';

interface Row {
  id: string;
  expense_type: string;
  description: string | null;
  payee_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  payment_status: string;
  paid_at: string | null;
  memo: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  대기:   'bg-amber-50 text-amber-700 border-amber-200',
  완료:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  후순위: 'bg-slate-50 text-slate-600 border-slate-200',
  취소:   'bg-rose-50 text-rose-700 border-rose-200',
};

interface Props {
  programId: string;
  projectId: string | null;
}

export default function PaymentRequestTab({ programId, projectId }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_expenses')
      .select('id, expense_type, description, payee_name, unit_price, quantity, subtotal, payment_status, paid_at, memo')
      .eq('program_id', programId)
      .like('expense_type', '운영비%')
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error('[PaymentRequestTab] 조회 실패:', error.message);
      toast.error('지급요청 목록을 불러오지 못했어요.');
      return;
    }
    setRows((data ?? []) as Row[]);
  }, [programId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleDelete(row: Row) {
    if (!window.confirm(`"${row.expense_type}" 지급요청을 휴지통으로 보낼까요?`)) return;
    setActing(row.id);
    const { error } = await supabase.from('payroll_expenses')
      .update({ deleted_at: new Date().toISOString() }).eq('id', row.id);
    setActing(null);
    if (error) { toast.error('삭제 중 오류가 발생했어요.'); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  const total = rows.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);

  return (
    <div className="space-y-4">
      <header className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <ReceiptText size={16} className="text-violet-500" aria-hidden="true" />
            지급요청 ({rows.length}건 · 합계 {formatMoney(total)})
          </h2>
          <p className="text-xs text-slate-500 mt-0.5">
            호텔·버스·재료비 등 운영 지출을 등록하면 재무 → 외주/급여 페이지에 자동으로 나타나요.
          </p>
        </div>
        <Button variant="primary" leftIcon={<Plus size={14} />} onClick={() => setFormOpen(true)}>지급요청 추가</Button>
      </header>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-muted">
          <Loader2 size={18} className="animate-spin mr-2" />불러오는 중…
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title="아직 등록된 지급요청이 없어요."
          description="호텔·버스·재료비 등 운영 지출을 [지급요청 추가] 로 입력하세요."
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold">카테고리</th>
                <th className="text-left px-3 py-2.5 font-semibold">세부 내용</th>
                <th className="text-left px-3 py-2.5 font-semibold">지급처</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">단가×회수</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">금액</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">지급일</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">상태</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-violet-50/40">
                  <td className="px-3 py-2 text-xs font-semibold text-violet-700">{r.expense_type.replace(/^운영비-?/, '') || '운영비'}</td>
                  <td className="px-3 py-2 text-xs text-text truncate max-w-[260px]">{r.description ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-muted">{r.payee_name || '-'}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted tabular-nums whitespace-nowrap">{Number(r.unit_price).toLocaleString()}×{r.quantity}</td>
                  <td className="px-3 py-2 text-right font-bold text-text tabular-nums whitespace-nowrap">{formatMoney(r.subtotal)}</td>
                  <td className="px-3 py-2 text-center text-xs text-muted whitespace-nowrap">{r.paid_at ? formatDateKo(r.paid_at) : '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${STATUS_STYLE[r.payment_status] ?? STATUS_STYLE['대기']}`}>{r.payment_status}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <button type="button" onClick={() => void handleDelete(r)} disabled={acting === r.id}
                      className="inline-flex items-center gap-1 text-xs text-rose-600 hover:underline disabled:opacity-40">
                      <Trash2 size={11} aria-hidden="true" />삭제
                    </button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaymentRequestFormModal
        open={formOpen}
        programId={programId}
        projectId={projectId}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); void reload(); }}
      />
    </div>
  );
}
