// 프로그램 [지급요청] 탭 — 메인(견적 vs 집행) + [인건비][운영비] 하위탭
// 박경수님 요청 — 강사료(payroll 변환분 포함)도 인건비 탭에 통합 노출

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2 } from 'lucide-react';
import { Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import SubToggle from './SubToggle';
import PaymentRequestFormModal from './PaymentRequestFormModal';
import PaymentSummaryCards from './PaymentSummaryCards';
import { isOutsourceType, isOperationType } from '../../payroll/payrollUtils';

type Group = 'outsource' | 'operation';

interface Row {
  id: string;
  expense_type: string;
  description: string | null;
  payee_name: string;
  unit_price: number;
  quantity: number;
  subtotal: number;
  tax_amount: number | null;
  net_amount: number | null;
  payment_status: string;
  paid_at: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  대기:   'bg-amber-50 text-amber-700 border-amber-200',
  완료:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  후순위: 'bg-slate-50 text-slate-600 border-slate-200',
  취소:   'bg-rose-50 text-rose-700 border-rose-200',
};

interface Props { programId: string; projectId: string | null }

export default function PaymentRequestTab({ programId, projectId }: Props) {
  const toast = useToast();
  const [group, setGroup] = useState<Group>('outsource');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [acting, setActing] = useState<string | null>(null);
  const [counts, setCounts] = useState({ outsource: 0, operation: 0 });

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_expenses')
      .select('id, expense_type, description, payee_name, unit_price, quantity, subtotal, tax_amount, net_amount, payment_status, paid_at')
      .eq('program_id', programId)
      .is('deleted_at', null)
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error('[PaymentRequestTab] 조회 실패:', error.message);
      toast.error('지급요청 목록을 불러오지 못했어요.');
      return;
    }
    const all = (data ?? []) as Row[];
    setRows(all);
    setCounts({
      outsource: all.filter((r) => isOutsourceType(r.expense_type)).length,
      operation: all.filter((r) => isOperationType(r.expense_type)).length,
    });
  }, [programId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  const visible = rows.filter((r) =>
    group === 'outsource' ? isOutsourceType(r.expense_type) : isOperationType(r.expense_type));
  const groupTotal = visible.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);

  async function handleDelete(row: Row) {
    if (!window.confirm(`"${row.expense_type} · ${row.payee_name}" 항목을 휴지통으로 보낼까요?`)) return;
    setActing(row.id);
    const { error } = await supabase.from('payroll_expenses')
      .update({ deleted_at: new Date().toISOString() }).eq('id', row.id);
    setActing(null);
    if (error) { toast.error('삭제 중 오류가 발생했어요.'); return; }
    toast.success('삭제했어요. 외주/급여 페이지에서도 사라집니다.');
    void reload();
  }

  return (
    <div className="space-y-4">
      {/* 메인 — 제안 견적 vs 실제 집행 */}
      <PaymentSummaryCards programId={programId} projectId={projectId} />

      {/* SubToggle [인건비][운영비] */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SubToggle
          items={[
            { key: 'outsource', label: `💼 인건비 (${counts.outsource})` },
            { key: 'operation', label: `🧾 운영비 (${counts.operation})` },
          ]}
          active={group}
          onChange={(k) => setGroup(k as Group)}
        />
        <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} onClick={() => setFormOpen(true)}>
          {group === 'outsource' ? '인건비 추가' : '운영비 추가'}
        </Button>
      </div>

      <p className="text-[11px] text-slate-500">
        {group === 'outsource'
          ? '강사료·촬영·통역 등 인건비. 강사 탭에서 [외주/급여로 변환] 한 항목도 여기에 표시됩니다. 합계 '
          : '호텔·버스·재료비 등 운영 지출. 합계 '}
        <span className="font-bold text-violet-700 tabular-nums">{formatMoney(groupTotal)}</span>
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted">
          <Loader2 size={16} className="animate-spin mr-2" />불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title={group === 'outsource' ? '아직 등록된 인건비가 없어요.' : '아직 등록된 운영비가 없어요.'}
          description={group === 'outsource'
            ? '강사 탭의 [강사료] 에서 등록 후 [외주/급여로 변환] 하거나, [인건비 추가] 로 직접 입력하세요.'
            : '[운영비 추가] 로 호텔·버스·재료비 등을 입력하세요.'}
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
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">원천세</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">실지급</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">지급일</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">상태</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => (
                <tr key={r.id} className="hover:bg-violet-50/40">
                  <td className="px-3 py-2 text-xs font-semibold text-violet-700">{r.expense_type}</td>
                  <td className="px-3 py-2 text-xs text-text truncate max-w-[260px]">{r.description ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-muted">{r.payee_name || '-'}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted tabular-nums whitespace-nowrap">{Number(r.unit_price).toLocaleString()}×{r.quantity}</td>
                  <td className="px-3 py-2 text-right text-xs text-rose-600 tabular-nums whitespace-nowrap">{Number(r.tax_amount ?? 0) > 0 ? `-${formatMoney(Number(r.tax_amount ?? 0))}` : '-'}</td>
                  <td className="px-3 py-2 text-right font-bold text-violet-700 tabular-nums whitespace-nowrap">{formatMoney(Number(r.net_amount ?? r.subtotal ?? 0))}</td>
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
        group={group}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); void reload(); }}
      />
    </div>
  );
}
