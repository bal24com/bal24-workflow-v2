// bal24 v2 — 수입 신규 등록 모달

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  INCOME_ACCOUNT_CODES,
  INCOME_STATUS_VALUES,
} from '../../utils/accounting';
import type {
  Client,
  Consortium,
  IncomeStatus,
  LedgerType,
  Project,
} from '../../types/database';

type Props = {
  open: boolean;
  ledgerType: LedgerType;
  onClose: () => void;
  onCreated: () => void;
};

type FormState = {
  accountCode: string;
  description: string;
  amount: string;
  incomeDate: string;
  invoiceNumber: string;
  status: IncomeStatus;
  clientId: string;
  projectId: string;
  consortiumId: string;
  memo: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = (): FormState => ({
  accountCode: INCOME_ACCOUNT_CODES[0].code,
  description: '',
  amount: '',
  incomeDate: today(),
  invoiceNumber: '',
  status: '대기',
  clientId: '',
  projectId: '',
  consortiumId: '',
  memo: '',
});

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('check') && m.includes('amount')) return '금액은 0보다 커야 해요.';
  return '수입 등록 중 오류가 발생했어요.';
}

export default function IncomeFormModal({ open, ledgerType, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY());
  const [clients, setClients] = useState<Pick<Client, 'id' | 'name'>[]>([]);
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([]);
  const [consortiums, setConsortiums] = useState<Pick<Consortium, 'id' | 'name'>[]>([]);
  const [loadingRefs, setLoadingRefs] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    setLoadingRefs(true);
    Promise.all([
      supabase.from('clients').select('id, name').order('name'),
      supabase.from('projects').select('id, name').order('created_at', { ascending: false }),
      supabase.from('consortiums').select('id, name').order('created_at', { ascending: false }),
    ]).then(([cR, pR, conR]) => {
      if (cancelled) return;
      if (cR.error) console.error('[income] clients 조회 실패:', cR.error.message);
      else setClients(cR.data ?? []);
      if (pR.error) console.error('[income] projects 조회 실패:', pR.error.message);
      else setProjects(pR.data ?? []);
      if (conR.error) console.error('[income] consortiums 조회 실패:', conR.error.message);
      else setConsortiums(conR.data ?? []);
      setLoadingRefs(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setForm(EMPTY());
    setErrorMsg(null);
  }, [open]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.description.trim()) { setErrorMsg('적요를 입력해 주세요.'); return; }
    const amt = Number(form.amount.replace(/,/g, ''));
    if (!form.amount || Number.isNaN(amt) || amt <= 0) { setErrorMsg('금액은 0보다 큰 숫자여야 해요.'); return; }
    if (!form.incomeDate) { setErrorMsg('수입일을 선택해 주세요.'); return; }
    if (ledgerType === 'consortium' && !form.consortiumId) { setErrorMsg('컨소시엄 정산은 연결 컨소시엄이 필요해요.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('income').insert({
        ledger_type: ledgerType,
        project_id: form.projectId || null,
        consortium_id: form.consortiumId || null,
        client_id: form.clientId || null,
        account_code: form.accountCode,
        description: form.description.trim(),
        amount: amt,
        income_date: form.incomeDate,
        invoice_number: form.invoiceNumber.trim() || null,
        status: form.status,
        memo: form.memo.trim() || null,
      });
      if (error) throw error;
      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[income] 등록 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`수입 신규 등록 (${ledgerType === 'own' ? '자체' : '컨소시엄'})`}
      description="적요·금액·날짜는 필수예요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="income-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="income-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">계정과목</label>
            <select
              value={form.accountCode}
              onChange={(e) => update('accountCode', e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {INCOME_ACCOUNT_CODES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
            </select>
          </div>
          <Input type="date" label="수입일" required value={form.incomeDate} onChange={(e) => update('incomeDate', e.target.value)} disabled={submitting} />
        </div>

        <Input label="적요" required value={form.description} onChange={(e) => update('description', e.target.value)} disabled={submitting} placeholder="예) 2026 상반기 워크샵 운영비" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="금액 (원)" required inputMode="numeric" value={form.amount} onChange={(e) => update('amount', e.target.value)} disabled={submitting} placeholder="예) 5,000,000" />
          <Input label="세금계산서 번호" value={form.invoiceNumber} onChange={(e) => update('invoiceNumber', e.target.value)} disabled={submitting} />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">상태</label>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value as IncomeStatus)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {INCOME_STATUS_VALUES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">고객사</label>
            <select
              value={form.clientId}
              onChange={(e) => update('clientId', e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
              {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">연결 프로젝트</label>
            <select
              value={form.projectId}
              onChange={(e) => update('projectId', e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
              {projects.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">
              연결 컨소시엄{ledgerType === 'consortium' && <span className="text-danger ml-1">*</span>}
            </label>
            <select
              value={form.consortiumId}
              onChange={(e) => update('consortiumId', e.target.value)}
              disabled={submitting || loadingRefs}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
              {consortiums.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
            </select>
          </div>
        </div>

        <div className="space-y-1.5">
          <label htmlFor="income-memo" className="text-sm font-semibold text-slate-700">메모</label>
          <textarea
            id="income-memo"
            rows={2}
            value={form.memo}
            onChange={(e) => update('memo', e.target.value)}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
