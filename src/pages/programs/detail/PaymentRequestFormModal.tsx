// 프로그램 [지급요청] 모달 — 호텔/버스/재료비 등 운영 지출 빠른 입력
// 박경수님 요청: 고객사 또는 전문가 연계 + 저장 시 외주/급여(payroll_expenses) 자동 노출

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

type PayeeType = 'client' | 'expert';

interface Props {
  open: boolean;
  programId: string;
  /** 부모 프로젝트 id — programs.project_id 에서 자동 prefill */
  projectId: string | null;
  onClose: () => void;
  onSaved: () => void;
}

const CATEGORY_OPTIONS = ['호텔', '버스', '재료비', '식비', '장비', '인쇄', '기타'];

interface NameOption { id: string; name: string }

export default function PaymentRequestFormModal({ open, programId, projectId, onClose, onSaved }: Props) {
  const toast = useToast();
  const [category, setCategory] = useState('호텔');
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [payeeType, setPayeeType] = useState<PayeeType>('client');
  const [payeeId, setPayeeId] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paidAt, setPaidAt] = useState('');
  const [memo, setMemo] = useState('');
  const [clients, setClients] = useState<NameOption[]>([]);
  const [experts, setExperts] = useState<NameOption[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setCategory('호텔'); setCustomCategory(''); setDescription('');
    setPayeeType('client'); setPayeeId('');
    setUnitPrice(''); setQuantity('1'); setPaidAt(''); setMemo('');
    setErrorMsg(null);
    let cancelled = false;
    void (async () => {
      const [cRes, sRes] = await Promise.all([
        supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
        supabase.from('staff_pool').select('id, name').is('deleted_at', null).order('name'),
      ]);
      if (cancelled) return;
      if (cRes.data) setClients(cRes.data as NameOption[]);
      if (sRes.data) setExperts(sRes.data as NameOption[]);
    })();
    return () => { cancelled = true; };
  }, [open]);

  const finalCategory = category === '기타' ? (customCategory.trim() || '기타') : category;
  const payeeList = payeeType === 'client' ? clients : experts;
  const payeeName = payeeList.find((p) => p.id === payeeId)?.name ?? '';
  const totalAmount = (Number(unitPrice || 0)) * (Number(quantity || 0));

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    if (!payeeId) { setErrorMsg(payeeType === 'client' ? '고객사를 선택해 주세요.' : '전문가를 선택해 주세요.'); return; }
    if (totalAmount <= 0) { setErrorMsg('금액을 입력해 주세요.'); return; }
    setSubmitting(true);
    try {
      const payload = {
        project_id: projectId,
        program_id: programId,
        expense_type: `운영비-${finalCategory}`,
        description: description.trim() || finalCategory,
        payee_name: payeeName,
        unit_price: Number(unitPrice || 0),
        quantity: Number(quantity || 1),
        tax_rate_type: '없음',
        payment_status: '대기',
        paid_at: paidAt || null,
        memo: memo.trim() || null,
      };
      const { error } = await supabase.from('payroll_expenses').insert(payload);
      if (error) {
        const raw = error.message.toLowerCase();
        console.error('[PaymentRequest] 저장 실패:', error.message);
        if (raw.includes('row-level security')) setErrorMsg(`저장 권한이 없어요. 관리자에게 문의해 주세요.\n(${error.message})`);
        else if (raw.includes('column') && raw.includes('does not exist')) setErrorMsg(`payroll_expenses 컬럼 누락. 마이그레이션 필요.\n(${error.message})`);
        else setErrorMsg(`저장에 실패했어요: ${error.message}`);
        return;
      }
      toast.success('지급요청을 등록했어요. 외주/급여 페이지에서 확인하세요.');
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  }

  const SELECT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

  return (
    <Modal open={open} onClose={onClose} title="지급요청 추가" size="md"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
        <Button type="submit" form="payment-request-form" variant="primary" loading={submitting}>저장</Button>
      </>}>
      <form id="payment-request-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">카테고리 <span className="text-rose-500">*</span></label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting} className={SELECT_CLASS}>
              {CATEGORY_OPTIONS.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
          </div>
          {category === '기타' ? (
            <Input label="직접 입력" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} disabled={submitting} placeholder="예) 통역료" />
          ) : (
            <Input label="세부 내용" value={description} onChange={(e) => setDescription(e.target.value)} disabled={submitting} placeholder="예) 강사 1박 숙박" />
          )}
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">지급처 <span className="text-rose-500">*</span></label>
          <div className="flex items-center gap-2">
            {(['client', 'expert'] as const).map((t) => (
              <button key={t} type="button" onClick={() => { setPayeeType(t); setPayeeId(''); }} disabled={submitting}
                className={`px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  payeeType === t ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50'
                }`}>{t === 'client' ? '고객사' : '전문가'}</button>
            ))}
          </div>
          <select value={payeeId} onChange={(e) => setPayeeId(e.target.value)} disabled={submitting} className={SELECT_CLASS}>
            <option value="">— 선택 —</option>
            {payeeList.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
          </select>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input type="number" inputMode="numeric" label="단가 (원)" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} disabled={submitting} min={0} step={1000} placeholder="0" />
          <Input type="number" label="회수" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={submitting} min={1} step={1} />
        </div>

        <div className="rounded-xl bg-violet-50/60 p-3 text-sm">
          <div className="flex justify-between font-bold text-violet-700">
            <span>지급요청 금액</span>
            <span className="tabular-nums">{totalAmount.toLocaleString()}원</span>
          </div>
          <p className="text-[11px] text-slate-500 mt-1">운영비는 원천세 없이 전액 지급 처리됩니다.</p>
        </div>

        <Input type="date" label="지급 예정일 (선택)" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} disabled={submitting} />
        <Input label="메모" value={memo} onChange={(e) => setMemo(e.target.value)} disabled={submitting} placeholder="(선택)" />

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-xs text-danger whitespace-pre-wrap">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
