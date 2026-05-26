// 지출결의서 작성·수정 모달 — 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28)
// claim + items 한 번에 저장. [저장(초안)] / [제출] 두 버튼.

import { useEffect, useState } from 'react';
import { Plus, X } from 'lucide-react';
import { Button, Modal, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import { buildClaimNumber } from './payrollMgmtUtils';

interface ItemDraft { description: string; quantity: string; unit_price: string; note: string }
interface Props { open: boolean; claimId?: string | null; onClose: () => void; onSaved: () => void }

const EMPTY_ITEM: ItemDraft = { description: '', quantity: '1', unit_price: '0', note: '' };

export default function ExpenseClaimFormModal({ open, claimId, onClose, onSaved }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [claimDate, setClaimDate] = useState(new Date().toISOString().slice(0, 10));
  const [expenseDate, setExpenseDate] = useState('');
  const [purpose, setPurpose] = useState('');
  const [accountCode, setAccountCode] = useState('');
  const [memo, setMemo] = useState('');
  const [items, setItems] = useState<ItemDraft[]>([{ ...EMPTY_ITEM }]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    if (claimId) {
      // 수정 모드 prefill
      void (async () => {
        const { data: c } = await supabase.from('expense_claims').select('*').eq('id', claimId).maybeSingle();
        if (c) {
          const r = c as { claim_date: string; expense_date: string | null; purpose: string; account_code: string | null; memo: string | null };
          setClaimDate(r.claim_date); setExpenseDate(r.expense_date ?? ''); setPurpose(r.purpose); setAccountCode(r.account_code ?? ''); setMemo(r.memo ?? '');
        }
        const { data: its } = await supabase.from('expense_claim_items').select('*').eq('claim_id', claimId).order('item_no');
        const itList = ((its ?? []) as Array<{ description: string; quantity: number; unit_price: number; note: string | null }>);
        setItems(itList.length > 0 ? itList.map((i) => ({ description: i.description, quantity: String(i.quantity), unit_price: String(i.unit_price), note: i.note ?? '' })) : [{ ...EMPTY_ITEM }]);
      })();
    } else {
      setClaimDate(new Date().toISOString().slice(0, 10)); setExpenseDate(''); setPurpose(''); setAccountCode(''); setMemo(''); setItems([{ ...EMPTY_ITEM }]);
    }
  }, [open, claimId]);

  function addItemRow() { setItems((p) => [...p, { ...EMPTY_ITEM }]); }
  function removeItemRow(idx: number) { setItems((p) => p.filter((_, i) => i !== idx)); }
  function updateItem(idx: number, key: keyof ItemDraft, val: string) { setItems((p) => p.map((it, i) => i === idx ? { ...it, [key]: val } : it)); }

  const totalAmount = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0);

  async function handleSave(submit: boolean) {
    if (!user) { toast.error('로그인이 필요합니다.'); return; }
    if (!purpose.trim()) { toast.error('지출 목적을 입력해 주세요.'); return; }
    if (items.length === 0 || items.every((i) => !i.description.trim())) { toast.error('지출 항목을 1건 이상 입력해 주세요.'); return; }
    setSaving(true);
    try {
      // 1) 시퀀스: 같은 달 결의서 수 + 1
      const { count } = await supabase.from('expense_claims').select('id', { count: 'exact', head: true })
        .gte('claim_date', `${claimDate.slice(0, 7)}-01`).lte('claim_date', `${claimDate.slice(0, 7)}-31`);
      const claimNumber = claimId ? null : buildClaimNumber(new Date(claimDate), (count ?? 0) + 1);
      const payload = { claim_date: claimDate, expense_date: expenseDate || null, purpose: purpose.trim(), account_code: accountCode || null, total_amount: totalAmount, memo: memo || null, status: submit ? 'submitted' : 'draft', submitted_at: submit ? new Date().toISOString() : null, ...(claimId ? {} : { claim_number: claimNumber, requester_id: user.id }) };
      const claimRes = claimId
        ? await supabase.from('expense_claims').update(payload).eq('id', claimId).select('id').single()
        : await supabase.from('expense_claims').insert(payload).select('id').single();
      if (claimRes.error) throw claimRes.error;
      const finalId = (claimRes.data as { id: string }).id;
      // 2) items 전체 교체 (간단화 — 기존 삭제 후 재삽입)
      if (claimId) await supabase.from('expense_claim_items').delete().eq('claim_id', claimId);
      const itemPayload = items.filter((i) => i.description.trim()).map((it, idx) => ({ claim_id: finalId, item_no: idx + 1, description: it.description.trim(), quantity: Number(it.quantity) || 1, unit_price: Number(it.unit_price) || 0, note: it.note || null }));
      if (itemPayload.length > 0) {
        const { error: itErr } = await supabase.from('expense_claim_items').insert(itemPayload);
        if (itErr) throw itErr;
      }
      toast.success(submit ? '결의서를 제출했어요.' : '결의서를 초안으로 저장했어요.');
      onSaved(); onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[ExpenseClaimFormModal] 저장 실패:', msg);
      toast.error(`저장 실패: ${msg}`);
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title={claimId ? '지출결의서 수정' : '지출결의서 작성'} size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
        <Button variant="outline" onClick={() => void handleSave(false)} loading={saving}>저장 (초안)</Button>
        <Button variant="primary" onClick={() => void handleSave(true)} loading={saving} className="!bg-emerald-600 hover:!bg-emerald-700">제출</Button>
      </>}>
      <div className="space-y-3">
        <div className="grid grid-cols-3 gap-3">
          <Input label="발의일자" type="date" value={claimDate} onChange={(e) => setClaimDate(e.target.value)} />
          <Input label="지출일자" type="date" value={expenseDate} onChange={(e) => setExpenseDate(e.target.value)} />
          <Input label="계정과목" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} placeholder="예: 사무용품비" />
        </div>
        <Input label="지출 목적" required value={purpose} onChange={(e) => setPurpose(e.target.value)} placeholder="예: 스튜디오 비용" />

        <div className="border border-slate-200 rounded-xl overflow-hidden">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-center px-2 py-2 w-10">NO</th>
                <th className="text-left px-2 py-2">지출내역</th>
                <th className="text-right px-2 py-2 w-16">수량</th>
                <th className="text-right px-2 py-2 w-24">단가</th>
                <th className="text-right px-2 py-2 w-24">금액</th>
                <th className="text-left px-2 py-2 w-24">비고</th>
                <th className="w-8"></th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {items.map((it, idx) => (
                <tr key={idx}>
                  <td className="px-2 py-1 text-center text-xs">{idx + 1}</td>
                  <td className="px-2 py-1"><input value={it.description} onChange={(e) => updateItem(idx, 'description', e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1" /></td>
                  <td className="px-2 py-1"><input type="number" value={it.quantity} onChange={(e) => updateItem(idx, 'quantity', e.target.value)} className="w-full text-right text-xs border border-slate-200 rounded px-2 py-1 tabular-nums" /></td>
                  <td className="px-2 py-1"><input type="number" value={it.unit_price} onChange={(e) => updateItem(idx, 'unit_price', e.target.value)} className="w-full text-right text-xs border border-slate-200 rounded px-2 py-1 tabular-nums" /></td>
                  <td className="px-2 py-1 text-right tabular-nums text-xs">{formatMoney((Number(it.unit_price) || 0) * (Number(it.quantity) || 0))}</td>
                  <td className="px-2 py-1"><input value={it.note} onChange={(e) => updateItem(idx, 'note', e.target.value)} className="w-full text-xs border border-slate-200 rounded px-2 py-1" /></td>
                  <td className="px-2 py-1 text-center"><button type="button" onClick={() => removeItemRow(idx)} className="text-rose-500 hover:text-rose-700" aria-label="행 삭제"><X size={12} /></button></td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td colSpan={4} className="px-2 py-2 text-right text-xs">금액합계</td>
                <td className="px-2 py-2 text-right tabular-nums text-violet-700">{formatMoney(totalAmount)}</td>
                <td colSpan={2}></td>
              </tr>
            </tbody>
          </table>
          <div className="px-2 py-2 border-t border-slate-200">
            <button type="button" onClick={addItemRow} className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline"><Plus size={12} aria-hidden="true" /> 행 추가</button>
          </div>
        </div>

        <Input label="메모" value={memo} onChange={(e) => setMemo(e.target.value)} placeholder="(선택)" />
      </div>
    </Modal>
  );
}
