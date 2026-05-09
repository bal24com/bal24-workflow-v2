// bal24 v2 — 지출 신규 등록 모달
// 원천징수 실시간 미리보기 카드 + 영수증 동적 첨부 (ExpenseReceiptsSection)
//
// ⚠ DB GENERATED 컬럼 주의:
//   withholding_rate / withholding_amount / net_amount는 DB가 자동 계산.
//   INSERT body에는 type + gross_amount만 보낼 것 (calcWithholding은 미리보기 전용).

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import {
  EXPENSE_ACCOUNT_CODES,
  EXPENSE_STATUS_VALUES,
  WITHHOLDING_OPTIONS,
  calcWithholding,
  findWithholdingOption,
  formatPercent,
} from '../../utils/accounting';
import { formatMoney } from '../../lib/utils';
import type {
  Client,
  Consortium,
  ExpenseStatus,
  LedgerType,
  Project,
  WithholdingType,
} from '../../types/database';
import ExpenseReceiptsSection, { makeReceipt } from './ExpenseReceiptsSection';
import type { ReceiptDraft } from './ExpenseReceiptsSection';
import { usePartnerProfile } from '../../hooks/usePartnerProfile';

type Props = {
  open: boolean;
  ledgerType: LedgerType;
  onClose: () => void;
  onCreated: () => void;
};

type FormState = {
  accountCode: string;
  description: string;
  grossAmount: string;
  expenseDate: string;
  withholdingType: WithholdingType;
  status: ExpenseStatus;
  payeeId: string;
  projectId: string;
  consortiumId: string;
  memo: string;
};

const today = () => new Date().toISOString().slice(0, 10);

const EMPTY = (): FormState => ({
  accountCode: EXPENSE_ACCOUNT_CODES[0].code,
  description: '',
  grossAmount: '',
  expenseDate: today(),
  withholdingType: 'none',
  status: '대기',
  payeeId: '',
  projectId: '',
  consortiumId: '',
  memo: '',
});

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('check') && m.includes('amount')) return '지급액은 0보다 커야 해요.';
  if (m.includes('generated column')) return '내부 오류: GENERATED 컬럼에 값을 보냈어요. 화면을 새로고침 후 다시 시도해 주세요.';
  return '지출 등록 중 오류가 발생했어요.';
}

export default function ExpenseFormModal({ open, ledgerType, onClose, onCreated }: Props) {
  // STEP-PARTNER-EXPENSE-AUTOFILL — PARTNER 면 본인 회사 ID 자동 주입
  const { isPartner, consortiumMemberId } = usePartnerProfile();
  const [form, setForm] = useState<FormState>(EMPTY());
  const [receipts, setReceipts] = useState<ReceiptDraft[]>([makeReceipt()]);
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
      if (cR.error) console.error('[expenses] clients 조회 실패:', cR.error.message);
      else setClients(cR.data ?? []);
      if (pR.error) console.error('[expenses] projects 조회 실패:', pR.error.message);
      else setProjects(pR.data ?? []);
      if (conR.error) console.error('[expenses] consortiums 조회 실패:', conR.error.message);
      else setConsortiums(conR.data ?? []);
      setLoadingRefs(false);
    });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setForm(EMPTY());
    setReceipts([makeReceipt()]);
    setErrorMsg(null);
  }, [open]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const grossNum = useMemo(() => {
    const n = Number(form.grossAmount.replace(/,/g, ''));
    return Number.isFinite(n) && n > 0 ? n : 0;
  }, [form.grossAmount]);

  const preview = useMemo(
    () => calcWithholding(form.withholdingType, grossNum),
    [form.withholdingType, grossNum],
  );

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.description.trim()) { setErrorMsg('적요를 입력해 주세요.'); return; }
    if (grossNum <= 0) { setErrorMsg('지급액은 0보다 큰 숫자여야 해요.'); return; }
    if (!form.expenseDate) { setErrorMsg('지출일을 선택해 주세요.'); return; }
    if (ledgerType === 'consortium' && !form.consortiumId) { setErrorMsg('컨소시엄 정산은 연결 컨소시엄이 필요해요.'); return; }

    setSubmitting(true);
    try {
      // ⚠ withholding_rate/amount/net_amount는 GENERATED — INSERT body에 포함하지 않음
      // STEP-PARTNER-EXPENSE-AUTOFILL — PARTNER 면 consortium_member_id 자동 주입 (UI 비노출)
      const { data: created, error } = await supabase.from('expenses').insert({
        ledger_type: ledgerType,
        project_id: form.projectId || null,
        consortium_id: form.consortiumId || null,
        payee_id: form.payeeId || null,
        account_code: form.accountCode,
        description: form.description.trim(),
        gross_amount: grossNum,
        withholding_type: form.withholdingType,
        expense_date: form.expenseDate,
        status: form.status,
        memo: form.memo.trim() || null,
        ...(isPartner && consortiumMemberId
          ? { consortium_member_id: consortiumMemberId }
          : {}),
      }).select('id').single();
      if (error) throw error;

      const validReceipts = receipts.filter((r) => r.fileUrl);
      if (validReceipts.length > 0 && created) {
        const rows = validReceipts.map((r) => ({
          expense_id: created.id,
          project_id: form.projectId || null,
          consortium_id: form.consortiumId || null,
          file_url: r.fileUrl,
          file_name: r.fileName,
          file_size: r.fileSize,
          receipt_type: r.receiptType,
          description: r.description.trim() || null,
          amount: r.amount.trim() ? Number(r.amount.replace(/,/g, '')) : null,
        }));
        const { error: rErr } = await supabase.from('receipts').insert(rows);
        if (rErr) {
          console.error('[expenses] 영수증 저장 실패:', rErr.message);
          setErrorMsg('지출은 등록됐지만 영수증 저장에 실패했어요. 영수증 페이지에서 추가해 주세요.');
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[expenses] 등록 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  const whOpt = findWithholdingOption(form.withholdingType);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={`지출 신규 등록 (${ledgerType === 'own' ? '자체' : '컨소시엄'})`}
      description="원천징수 금액·실지급액은 DB가 자동 계산해요."
      size="lg"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="expense-form" variant="primary" loading={submitting}>저장하기</Button>
        </>
      }
    >
      <form id="expense-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">계정과목</label>
            <select
              value={form.accountCode}
              onChange={(e) => update('accountCode', e.target.value)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {EXPENSE_ACCOUNT_CODES.map((c) => (<option key={c.code} value={c.code}>{c.label}</option>))}
            </select>
          </div>
          <Input type="date" label="지출일" required value={form.expenseDate} onChange={(e) => update('expenseDate', e.target.value)} disabled={submitting} />
        </div>

        <Input label="적요" required value={form.description} onChange={(e) => update('description', e.target.value)} disabled={submitting} placeholder="예) 김○○ 강사 강사료" />

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input label="지급액 (원)" required inputMode="numeric" value={form.grossAmount} onChange={(e) => update('grossAmount', e.target.value)} disabled={submitting} placeholder="예) 500,000" helperText="세전 총액" />
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">원천징수</label>
            <select
              value={form.withholdingType}
              onChange={(e) => update('withholdingType', e.target.value as WithholdingType)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {WITHHOLDING_OPTIONS.map((o) => (<option key={o.type} value={o.type}>{o.label}</option>))}
            </select>
          </div>
        </div>

        <div className="rounded-xl border border-primary/20 bg-primary/5 p-4 grid grid-cols-3 gap-3 text-sm">
          <div className="space-y-0.5">
            <div className="text-xs text-muted">유형 / 세율</div>
            <div className="font-semibold text-text">{whOpt.label}</div>
            <div className="text-[10px] text-muted">{formatPercent(whOpt.rate)}</div>
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-muted">원천징수액</div>
            <div className="font-semibold text-danger">
              {grossNum > 0 ? `- ${formatMoney(preview.withholding)}` : '–'}
            </div>
          </div>
          <div className="space-y-0.5">
            <div className="text-xs text-muted">실지급액</div>
            <div className="font-bold text-primary">
              {grossNum > 0 ? formatMoney(preview.net) : '–'}
            </div>
          </div>
          <div className="col-span-3 text-[10px] text-muted">
            DB가 같은 룰로 자동 계산해서 저장해요. 위 미리보기는 입력 검토용.
          </div>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">상태</label>
            <select
              value={form.status}
              onChange={(e) => update('status', e.target.value as ExpenseStatus)}
              disabled={submitting}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {EXPENSE_STATUS_VALUES.map((s) => (<option key={s} value={s}>{s}</option>))}
            </select>
          </div>
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">지급처 (고객사)</label>
            <select
              value={form.payeeId}
              onChange={(e) => update('payeeId', e.target.value)}
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
          <label htmlFor="expense-memo" className="text-sm font-semibold text-slate-700">메모</label>
          <textarea
            id="expense-memo"
            rows={2}
            value={form.memo}
            onChange={(e) => update('memo', e.target.value)}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
          />
        </div>

        <ExpenseReceiptsSection receipts={receipts} onChange={setReceipts} disabled={submitting} />

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
