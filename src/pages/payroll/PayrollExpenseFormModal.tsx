// 외주/급여 등록·수정 모달 — STEP-ACCOUNTING-ALL P3
// 단가·회수·세액 자동계산 + 영수증 첨부 (Storage 통합은 후속)

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import { calcTax, TAX_RATE_LABEL, TAX_RATE_VALUES } from '../../utils/taxUtils';
import type {
  PayrollExpenseType, PayrollPaymentStatus, PayrollTaxRateType,
} from '../../types/database';
import {
  PAYROLL_TYPE_VALUES, PAYROLL_STATUS_VALUES,
  type PayrollRow,
} from './payrollUtils';

interface RefOption { id: string; name: string }

interface Props {
  open: boolean;
  target: PayrollRow | null;
  defaultType: PayrollExpenseType;
  onClose: () => void;
  onSaved: () => void;
}

const BANK_OPTIONS = [
  '국민은행', '신한은행', '우리은행', '하나은행', '농협은행',
  '기업은행', '카카오뱅크', '토스뱅크', '새마을금고', '우체국', '기타',
];

function emptyForm(defaultType: PayrollExpenseType) {
  return {
    expense_type: defaultType,
    description: '',
    payee_name: '',
    payee_id_no: '',
    bank_name: '',
    bank_account: '',
    unit_price: '',
    quantity: '1',
    tax_rate_type: '3.3' as PayrollTaxRateType,
    payment_status: '대기' as PayrollPaymentStatus,
    paid_at: '',
    project_id: '',
    memo: '',
  };
}

export default function PayrollExpenseFormModal({
  open, target, defaultType, onClose, onSaved,
}: Props) {
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForm(defaultType));
  const [projects, setProjects] = useState<RefOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('projects').select('id, name')
        .is('deleted_at', null).order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) { console.error('[PayrollExpenseFormModal] projects 조회 실패:', error.message); return; }
      setProjects((data as RefOption[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({
        expense_type: target.expense_type,
        description: target.description ?? '',
        payee_name: target.payee_name,
        payee_id_no: target.payee_id_no ?? '',
        bank_name: target.bank_name ?? '',
        bank_account: target.bank_account ?? '',
        unit_price: String(target.unit_price ?? ''),
        quantity: String(target.quantity ?? '1'),
        tax_rate_type: target.tax_rate_type,
        payment_status: target.payment_status,
        paid_at: target.paid_at ? target.paid_at.slice(0, 10) : '',
        project_id: target.project_id ?? '',
        memo: target.memo ?? '',
      });
    } else {
      setForm(emptyForm(defaultType));
    }
  }, [open, target, defaultType]);

  const subtotal = useMemo(
    () => (Number(form.unit_price) || 0) * (Number(form.quantity) || 0),
    [form.unit_price, form.quantity],
  );
  const { taxAmount, netAmount } = useMemo(
    () => calcTax(subtotal, form.tax_rate_type),
    [subtotal, form.tax_rate_type],
  );

  async function handleSave() {
    if (!form.payee_name.trim()) { toast.error('성명을 입력해 주세요.'); return; }
    if (!form.unit_price || Number.isNaN(Number(form.unit_price))) {
      toast.error('단가를 숫자로 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        expense_type: form.expense_type,
        description: form.description.trim() || null,
        payee_name: form.payee_name.trim(),
        payee_id_no: form.payee_id_no.trim() || null,
        bank_name: form.bank_name || null,
        bank_account: form.bank_account.trim() || null,
        unit_price: Number(form.unit_price) || 0,
        quantity: Number(form.quantity) || 1,
        tax_rate_type: form.tax_rate_type,
        tax_amount: taxAmount,
        net_amount: netAmount,
        payment_status: form.payment_status,
        paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
        project_id: form.project_id || null,
        memo: form.memo.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (target) {
        const { error } = await supabase.from('payroll_expenses').update(payload).eq('id', target.id);
        if (error) throw error;
        toast.success('수정했어요.');
      } else {
        const { error } = await supabase.from('payroll_expenses').insert(payload);
        if (error) throw error;
        toast.success('등록했어요.');
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[PayrollExpenseFormModal] 저장 오류:', msg);
      toast.error('저장 중 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? '외주/급여 수정' : '신규 등록'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
          <Button variant="primary" onClick={() => void handleSave()} loading={saving}>저장하기</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="grid grid-cols-2 gap-3">
          <Field label="구분" required>
            <select
              value={form.expense_type}
              onChange={(e) => setForm({ ...form, expense_type: e.target.value as PayrollExpenseType })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {PAYROLL_TYPE_VALUES.map((t) => <option key={t} value={t}>{t}</option>)}
            </select>
          </Field>
          <Field label="연결 프로젝트">
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">선택 안함</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <Field label="내용">
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="예: OT 9/11, KME 강의"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="성명" required>
            <Input value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value })} placeholder="홍길동" />
          </Field>
          <Field label="주민번호 (선택)">
            <Input value={form.payee_id_no} onChange={(e) => setForm({ ...form, payee_id_no: e.target.value })} placeholder="앞 6자리만 노출됩니다" />
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="은행명">
            <select
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">선택 안함</option>
              {BANK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="계좌번호">
            <Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="123-456789-01-234" />
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="단가" required>
            <Input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </Field>
          <Field label="회수" required>
            <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="합계 (자동)">
            <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm flex items-center font-bold tabular-nums">
              {formatMoney(subtotal)}
            </div>
          </Field>
          <Field label="세액구분">
            <select
              value={form.tax_rate_type}
              onChange={(e) => setForm({ ...form, tax_rate_type: e.target.value as PayrollTaxRateType })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {TAX_RATE_VALUES.map((t) => <option key={t} value={t}>{TAX_RATE_LABEL[t]}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="원천세 (자동)">
            <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm flex items-center text-rose-600 font-semibold tabular-nums">
              {formatMoney(taxAmount)}
            </div>
          </Field>
          <Field label="실지급액 (자동)">
            <div className="h-10 rounded-xl border border-violet-200 bg-violet-50/40 px-3 text-sm flex items-center text-violet-700 font-bold tabular-nums">
              {formatMoney(netAmount)}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="지급일">
            <Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
          </Field>
          <Field label="지급상태">
            <select
              value={form.payment_status}
              onChange={(e) => setForm({ ...form, payment_status: e.target.value as PayrollPaymentStatus })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {PAYROLL_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="비고">
          <textarea
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="추가 메모"
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
