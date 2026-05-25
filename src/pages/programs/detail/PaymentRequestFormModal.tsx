// 프로그램 [지급요청] 모달 — 호텔/버스/재료비 등 운영 지출 빠른 입력
// 박경수님 요청: 고객사 또는 전문가 연계 + 저장 시 외주/급여(payroll_expenses) 자동 노출

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { calcTax } from '../../../utils/taxUtils';

type PayeeType = 'client' | 'expert';
type Group = 'outsource' | 'operation';

interface Props {
  open: boolean;
  programId: string;
  /** 부모 프로젝트 id — programs.project_id 에서 자동 prefill */
  projectId: string | null;
  /** 'outsource' = 인건비 / 'operation' = 운영비 */
  group: Group;
  onClose: () => void;
  onSaved: () => void;
}

// 박경수님 요청 — 인건비/운영비 그룹별 카테고리 분기
const CATEGORY_BY_GROUP: Record<Group, string[]> = {
  outsource: ['강사료', '촬영', '통역', '번역', '외주개발', '컨설팅', '기타외주'],
  operation: ['호텔', '버스', '재료비', '식비', '장비', '인쇄', '운영비', '기타'],
};
// expense_type 저장 형식 — outsource 는 카테고리 그대로, operation 은 '운영비-{카테고리}' prefix
function buildExpenseType(group: Group, category: string, custom: string): string {
  const c = category === '기타' ? (custom.trim() || '기타') : category;
  if (group === 'operation') return c === '운영비' ? '운영비' : `운영비-${c}`;
  return c; // outsource: 강사료/촬영/.../기타외주 그대로 (payrollUtils.isOutsourceType prefix 매칭)
}

interface NameOption { id: string; name: string }

export default function PaymentRequestFormModal({ open, programId, projectId, group, onClose, onSaved }: Props) {
  const toast = useToast();
  const categoryOptions = CATEGORY_BY_GROUP[group];
  const [category, setCategory] = useState(categoryOptions[0]);
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
    setCategory(categoryOptions[0]); setCustomCategory(''); setDescription('');
    setPayeeType(group === 'outsource' ? 'expert' : 'client'); setPayeeId('');
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
  const finalExpenseType = buildExpenseType(group, category, customCategory);
  const payeeList = payeeType === 'client' ? clients : experts;
  const payeeName = payeeList.find((p) => p.id === payeeId)?.name ?? '';
  const totalAmount = (Number(unitPrice || 0)) * (Number(quantity || 0));
  // 박경수님 요청 — 운영비는 부가세 10% 포함, 인건비는 원천세 3.3% 기본
  const defaultTaxRate: '3.3' | '10' = group === 'outsource' ? '3.3' : '10';
  const calc = calcTax(totalAmount, defaultTaxRate);
  const supplyAmount = totalAmount - calc.taxAmount; // 공급가액 (운영비 = 합계 - 부가세)

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
        expense_type: finalExpenseType,
        description: description.trim() || finalCategory,
        payee_name: payeeName,
        unit_price: Number(unitPrice || 0),
        quantity: Number(quantity || 1),
        tax_rate_type: defaultTaxRate,
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
    <Modal open={open} onClose={onClose} title={group === 'outsource' ? '인건비 지급요청 추가' : '운영비 지급요청 추가'} size="md"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
        <Button type="submit" form="payment-request-form" variant="primary" loading={submitting}>저장</Button>
      </>}>
      <form id="payment-request-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">카테고리 <span className="text-rose-500">*</span></label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting} className={SELECT_CLASS}>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
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

        <div className="rounded-xl bg-violet-50/60 p-3 text-xs space-y-1">
          {group === 'operation' ? (
            <>
              <div className="flex justify-between text-slate-600">
                <span>합계 (부가세 포함)</span>
                <span className="tabular-nums font-semibold">{totalAmount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-slate-500">
                <span>└ 공급가액</span>
                <span className="tabular-nums">{supplyAmount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>└ 부가세 10%</span>
                <span className="tabular-nums">▲ {calc.taxAmount.toLocaleString()}원</span>
              </div>
              <p className="text-[10px] text-slate-500 pt-1">운영비는 부가세 10% 포함으로 자동 처리됩니다. 영수증 가격(부가세 포함)을 그대로 입력하세요.</p>
            </>
          ) : (
            <>
              <div className="flex justify-between text-slate-600">
                <span>세전 합계</span>
                <span className="tabular-nums font-semibold">{totalAmount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between text-rose-600">
                <span>└ 원천세 3.3%</span>
                <span className="tabular-nums">▲ {calc.taxAmount.toLocaleString()}원</span>
              </div>
              <div className="flex justify-between font-bold text-violet-700 pt-1 border-t border-violet-200">
                <span>실수령</span>
                <span className="tabular-nums">{calc.netAmount.toLocaleString()}원</span>
              </div>
            </>
          )}
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
