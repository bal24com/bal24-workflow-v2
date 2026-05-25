// 견적 항목 → 지급요청 선택·수정 후 전송 모달 (박경수님 요청)
// 견적과 실제 지출이 일치하지 않을 수 있으니 일괄 변환이 아닌 박경수님이 선택·수정·전송.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Loader2 } from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatMoney } from '../../../lib/utils';
import { calcTax } from '../../../utils/taxUtils';

type Group = 'outsource' | 'operation';

interface Item {
  id: string;
  category: string;
  description: string | null;
  payee_name: string | null;
  unit_price: number;
  quantity: number;
  headcount: number;
  tax_rate_type: string;
  // 박경수님 수정 가능한 필드들 (기본은 견적 값)
  _selected: boolean;
  _expenseType: string;
  _unitPrice: number;
  _quantity: number;
}

interface Props {
  open: boolean;
  programId: string;
  projectId: string | null;
  group: Group;
  onClose: () => void;
  onSaved: () => void;
}

export default function EstimateImportModal({ open, programId, projectId, group, onClose, onSaved }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<Item[]>([]);
  const [loading, setLoading] = useState(true);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null); setLoading(true);
    void (async () => {
      // 미연결(payroll_expense_id IS NULL) + 현재 프로그램(programId) 매칭 견적 항목만
      const { data, error } = await supabase.from('estimate_items')
        .select('id, category, description, payee_name, unit_price, quantity, headcount, tax_rate_type')
        .eq('program_id', programId).is('payroll_expense_id', null);
      setLoading(false);
      if (error) { toast.error('견적 항목을 불러오지 못했어요.'); return; }
      // group 별 기본 expense_type 추론: 견적 category 가 인건비 그룹이면 '강사료', 운영비 그룹이면 '운영비-{description|category}'
      const rows = ((data ?? []) as Array<{ id: string; category: string; description: string | null; payee_name: string | null; unit_price: number; quantity: number; headcount: number | null; tax_rate_type: string | null }>);
      setItems(rows.map((r) => {
        const baseType = group === 'outsource'
          ? (r.category && /강사|촬영|기타외주/.test(r.category) ? r.category : '강사료')
          : `운영비-${(r.description || r.category || '').slice(0, 20) || '기타'}`;
        return {
          id: r.id, category: r.category, description: r.description, payee_name: r.payee_name,
          unit_price: Number(r.unit_price ?? 0), quantity: Number(r.quantity ?? 1), headcount: Number(r.headcount ?? 1),
          tax_rate_type: r.tax_rate_type ?? '없음',
          _selected: false, _expenseType: baseType,
          _unitPrice: Number(r.unit_price ?? 0), _quantity: Number(r.quantity ?? 1) * Number(r.headcount ?? 1),
        };
      }));
    })();
  }, [open, programId, group, toast]);

  const selected = items.filter((it) => it._selected);
  const selectedTotal = selected.reduce((s, it) => s + (it._unitPrice * it._quantity), 0);
  const allChecked = items.length > 0 && selected.length === items.length;
  function toggleAll() {
    const next = !allChecked;
    setItems((prev) => prev.map((it) => ({ ...it, _selected: next })));
  }
  function updateItem(id: string, patch: Partial<Item>) {
    setItems((prev) => prev.map((it) => it.id === id ? { ...it, ...patch } : it));
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (selected.length === 0) { setErrorMsg('가져올 항목을 1개 이상 선택해 주세요.'); return; }
    setSubmitting(true);
    // 그룹별 기본 세율: 인건비 3.3 / 운영비 10
    const defaultTax = group === 'outsource' ? '3.3' : '10';
    const payloads = selected.map((it) => {
      const subtotal = it._unitPrice * it._quantity;
      const { taxAmount, netAmount } = calcTax(subtotal, defaultTax as '3.3' | '10');
      return {
        project_id: projectId, program_id: programId,
        expense_type: it._expenseType || (group === 'outsource' ? '강사료' : '운영비'),
        description: it.description ?? it.category, payee_name: it.payee_name ?? '미정',
        unit_price: it._unitPrice, quantity: it._quantity,
        tax_rate_type: defaultTax, tax_amount: taxAmount, net_amount: netAmount,
        payment_status: '대기',
      };
    });
    const { data: inserted, error } = await supabase.from('payroll_expenses').insert(payloads).select('id');
    if (error) {
      setSubmitting(false);
      const raw = error.message.toLowerCase();
      setErrorMsg(raw.includes('row-level security') ? `저장 권한이 없어요. (${error.message})` : `저장 실패: ${error.message}`);
      return;
    }
    // 매핑 — 견적 항목과 1:1 매칭 (선택 순서대로)
    const insertedRows = (inserted ?? []) as Array<{ id: string }>;
    for (let i = 0; i < selected.length && i < insertedRows.length; i += 1) {
      await supabase.from('estimate_items').update({ payroll_expense_id: insertedRows[i].id }).eq('id', selected[i].id);
    }
    setSubmitting(false);
    toast.success(`${selected.length}건을 ${group === 'outsource' ? '인건비' : '운영비'} 로 가져왔어요.`);
    onSaved(); onClose();
  }

  return (
    <Modal open={open} onClose={onClose} title={`견적에서 가져오기 (${group === 'outsource' ? '인건비' : '운영비'})`} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
        <Button type="submit" form="est-import-form" variant="primary" loading={submitting} disabled={selected.length === 0}>
          선택 {selected.length}건 가져오기
        </Button>
      </>}>
      <form id="est-import-form" onSubmit={handleSubmit} className="space-y-3" noValidate>
        <p className="text-xs text-slate-500">
          견적과 실제 지출 항목이 다를 수 있어요. 가져올 항목을 체크하고 분류/단가/회수를 조정한 뒤 등록하세요.
        </p>
        {loading ? (
          <div className="flex items-center justify-center py-8 text-sm text-muted">
            <Loader2 size={16} className="animate-spin mr-2" />불러오는 중…
          </div>
        ) : items.length === 0 ? (
          <p className="text-center text-sm text-slate-400 italic py-8">이 프로그램에 가져올 미연결 견적 항목이 없어요.</p>
        ) : (
          <div className="rounded-xl border border-slate-200 overflow-x-auto">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 text-slate-500">
                <tr>
                  <th className="px-2 py-1.5 text-center"><input type="checkbox" checked={allChecked} onChange={toggleAll} /></th>
                  <th className="px-2 py-1.5 text-left">견적 카테고리</th>
                  <th className="px-2 py-1.5 text-left">세부 내용</th>
                  <th className="px-2 py-1.5 text-left">분류 (수정)</th>
                  <th className="px-2 py-1.5 text-right">단가 (수정)</th>
                  <th className="px-2 py-1.5 text-right">수량 (수정)</th>
                  <th className="px-2 py-1.5 text-right">금액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {items.map((it) => (
                  <tr key={it.id} className={it._selected ? 'bg-violet-50/40' : 'hover:bg-slate-50/40'}>
                    <td className="px-2 py-1 text-center"><input type="checkbox" checked={it._selected} onChange={() => updateItem(it.id, { _selected: !it._selected })} /></td>
                    <td className="px-2 py-1 text-slate-700">{it.category}</td>
                    <td className="px-2 py-1 text-slate-600 truncate max-w-[160px]">{it.description ?? '-'}</td>
                    <td className="px-2 py-1 w-32"><Input value={it._expenseType} onChange={(e) => updateItem(it.id, { _expenseType: e.target.value })} /></td>
                    <td className="px-2 py-1 w-24"><Input type="number" value={String(it._unitPrice)} onChange={(e) => updateItem(it.id, { _unitPrice: Number(e.target.value) || 0 })} className="text-right" /></td>
                    <td className="px-2 py-1 w-20"><Input type="number" value={String(it._quantity)} onChange={(e) => updateItem(it.id, { _quantity: Number(e.target.value) || 1 })} className="text-right" /></td>
                    <td className="px-2 py-1 text-right font-bold text-violet-700 tabular-nums whitespace-nowrap">{formatMoney(it._unitPrice * it._quantity)}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        {selected.length > 0 && (
          <div className="rounded-lg bg-violet-50 px-3 py-2 text-xs flex justify-between font-semibold text-violet-700">
            <span>선택 {selected.length}건</span>
            <span className="tabular-nums">{formatMoney(selectedTotal)}원</span>
          </div>
        )}
        {errorMsg && <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger whitespace-pre-wrap">{errorMsg}</div>}
      </form>
    </Modal>
  );
}
