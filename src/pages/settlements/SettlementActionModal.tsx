// bal24 v2 — 정산 단계별 액션 모달
// step 2(승인) / 3(세금계산서) / 4(입금확인) / 5(출금처리)

import { useEffect, useMemo, useState } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import type { ProjectSettlementRow, SettlementStep } from '../../types/database';

type Props = {
  open: boolean;
  settlement: ProjectSettlementRow;
  projectId: string;
  projectName: string;
  /** 단계 변환 시 추가 로직(income insert 등) 호출용 */
  onClose: () => void;
  onSaved: () => void;
};

type ClientCheckResult = {
  hasBusinessNumber: boolean;
  message?: string;
};

const today = () => new Date().toISOString().slice(0, 10);

function nextStep(s: SettlementStep): SettlementStep {
  return Math.min(5, s + 1) as SettlementStep;
}

const TITLES: Record<2 | 3 | 4 | 5, string> = {
  2: '고객사 승인 처리',
  3: '세금계산서 발행',
  4: '입금 확인',
  5: '출금 처리',
};

const SUMMARIES: Record<2 | 3 | 4 | 5, string> = {
  2: '고객사 승인이 완료되었으면 처리해 주세요.',
  3: '세금계산서 번호와 발행일을 입력해 주세요.',
  4: '입금액과 입금일을 입력하면 수입 내역에도 자동 등록돼요.',
  5: '출금이 완료되었으면 처리해 주세요.',
};

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('column') && m.includes('does not exist')) {
    return '관련 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  return '처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function SettlementActionModal({
  open, settlement, projectId, projectName, onClose, onSaved,
}: Props) {
  const target = useMemo<2 | 3 | 4 | 5 | null>(() => {
    const cur = settlement.current_step;
    if (cur >= 5) return null;
    const n = nextStep(cur);
    if (n < 2 || n > 5) return null;
    return n as 2 | 3 | 4 | 5;
  }, [settlement.current_step]);

  const [note, setNote] = useState('');
  const [actionDate, setActionDate] = useState(today());
  const [invoiceNumber, setInvoiceNumber] = useState('');
  const [amount, setAmount] = useState('');
  const [payoutAmount, setPayoutAmount] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [clientCheck, setClientCheck] = useState<ClientCheckResult | null>(null);
  const [checkingClient, setCheckingClient] = useState(false);

  // step 3 진입 시 클라이언트 사업자번호 사전 체크
  useEffect(() => {
    if (!open || target !== 3) { setClientCheck(null); return; }
    let cancelled = false;
    setCheckingClient(true);
    (async () => {
      try {
        const { data: proj, error: pErr } = await supabase
          .from('projects')
          .select('client_id')
          .eq('id', projectId)
          .maybeSingle();
        if (pErr) throw pErr;
        if (!proj?.client_id) {
          if (!cancelled) setClientCheck({ hasBusinessNumber: false, message: '프로젝트에 연결된 고객사가 없어요. 프로젝트 정보를 먼저 등록해 주세요.' });
          return;
        }
        const { data: cli, error: cErr } = await supabase
          .from('clients')
          .select('business_number')
          .eq('id', proj.client_id)
          .maybeSingle();
        if (cErr) throw cErr;
        if (cancelled) return;
        const has = Boolean(cli?.business_number?.trim());
        setClientCheck({
          hasBusinessNumber: has,
          message: has ? undefined : '고객사 사업자등록번호가 등록되지 않았습니다. 고객사 상세에서 먼저 입력해 주세요.',
        });
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[settlement] 고객사 사업자번호 체크 실패:', raw);
        setClientCheck({ hasBusinessNumber: false, message: '고객사 정보 확인 중 오류가 발생했어요.' });
      } finally {
        if (!cancelled) setCheckingClient(false);
      }
    })();
    return () => { cancelled = true; };
  }, [open, target, projectId]);

  useEffect(() => {
    if (open) return;
    setNote(''); setActionDate(today()); setInvoiceNumber(''); setAmount(''); setPayoutAmount('');
    setErrorMsg(null); setClientCheck(null);
  }, [open]);

  if (!target) return null;

  const handleSubmit = async () => {
    setErrorMsg(null);
    if (target === 3 && clientCheck && !clientCheck.hasBusinessNumber) {
      setErrorMsg(clientCheck.message ?? '고객사 사업자번호를 먼저 등록해 주세요.');
      return;
    }
    if (target === 3 && !invoiceNumber.trim()) { setErrorMsg('세금계산서 번호를 입력해 주세요.'); return; }
    if (target === 4) {
      const n = Number(amount.replace(/,/g, ''));
      if (!amount.trim() || Number.isNaN(n) || n <= 0) { setErrorMsg('입금액은 0보다 큰 숫자여야 해요.'); return; }
    }
    if (target === 5) {
      const n = Number(payoutAmount.replace(/,/g, ''));
      if (!payoutAmount.trim() || Number.isNaN(n) || n <= 0) { setErrorMsg('출금액은 0보다 큰 숫자여야 해요.'); return; }
    }

    setSubmitting(true);
    try {
      const dateIso = new Date(actionDate || today()).toISOString();
      const fieldUpdates: Partial<ProjectSettlementRow> = { current_step: target };

      if (target === 2) fieldUpdates.approved_at = dateIso;
      if (target === 3) {
        fieldUpdates.invoice_at = dateIso;
        fieldUpdates.invoice_number = invoiceNumber.trim();
      }
      if (target === 4) fieldUpdates.received_at = dateIso;
      if (target === 5) fieldUpdates.paid_out_at = dateIso;

      // 메모는 step 2·3·4·5 모두 동일 패턴으로 누적
      if (note.trim()) {
        const prefix = target === 2 ? '승인' : target === 3 ? '세금계산서' : target === 4 ? '입금' : '출금';
        const baseNote = settlement.note ? `${settlement.note} | ` : '';
        fieldUpdates.note = `${baseNote}[${prefix}] ${note.trim()}`;
      }

      const { error } = await supabase
        .from('project_settlements')
        .update(fieldUpdates)
        .eq('id', settlement.id);
      if (error) throw error;

      // step 4 → income 자동 insert
      if (target === 4) {
        const amtNum = Number(amount.replace(/,/g, ''));
        const { error: incErr } = await supabase.from('income').insert({
          ledger_type: 'own',
          project_id: projectId,
          account_code: 'INCOME_CONTRACT',
          description: `${projectName} 입금`,
          amount: amtNum,
          income_date: actionDate || today(),
          status: '입금완료',
          received_at: dateIso,
        });
        if (incErr) {
          console.error('[settlement] income 자동 insert 실패:', incErr.message);
          setErrorMsg('단계는 변경됐지만 수입 내역 자동 등록에 실패했어요. 수입 페이지에서 수동으로 추가해 주세요.');
        }
      }

      // step 5 → expenses 자동 insert (step 4 income 대칭)
      if (target === 5) {
        const amtNum = Number(payoutAmount.replace(/,/g, ''));
        const { error: expErr } = await supabase.from('expenses').insert({
          ledger_type: 'own',
          project_id: projectId,
          account_code: 'EXPENSE_SETTLEMENT',
          description: `${projectName} 정산 출금`,
          gross_amount: amtNum,
          withholding_type: 'none',
          expense_date: actionDate || today(),
          status: '출금완료',
          paid_at: dateIso,
        });
        if (expErr) {
          console.error('[settlement] expense 자동 insert 실패:', expErr.message);
          setErrorMsg('단계는 변경됐지만 지출 내역 자동 등록에 실패했어요. 지출 페이지에서 수동으로 추가해 주세요.');
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[settlement] 단계 처리 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={TITLES[target]}
      description={SUMMARIES[target]}
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button variant="primary" onClick={() => void handleSubmit()} loading={submitting}
            disabled={target === 3 && (checkingClient || !clientCheck?.hasBusinessNumber)}>
            {target === 5 ? '정산 완료 처리' : '진행'}
          </Button>
        </>
      }
    >
      <div className="space-y-4">
        {target === 3 && checkingClient && (
          <div className="rounded-xl bg-slate-50 px-4 py-2.5 text-xs text-muted">
            고객사 사업자번호 확인 중…
          </div>
        )}
        {target === 3 && clientCheck && !clientCheck.hasBusinessNumber && (
          <div role="alert" className="rounded-xl bg-warning/10 border border-warning/30 px-4 py-3 text-sm text-warning">
            ⚠ {clientCheck.message}
          </div>
        )}

        <Input
          type="date"
          label={target === 2 ? '승인일' : target === 3 ? '세금계산서 발행일' : target === 4 ? '입금일' : '출금일'}
          value={actionDate}
          onChange={(e) => setActionDate(e.target.value)}
          disabled={submitting}
        />

        {target === 3 && (
          <Input
            label="세금계산서 번호"
            required
            value={invoiceNumber}
            onChange={(e) => setInvoiceNumber(e.target.value)}
            disabled={submitting}
            placeholder="예) 20260507-001"
          />
        )}

        {target === 4 && (
          <Input
            label="입금액 (원)"
            required
            inputMode="numeric"
            value={amount}
            onChange={(e) => setAmount(e.target.value)}
            disabled={submitting}
            placeholder="예) 5,000,000"
            helperText={amount.trim() && !Number.isNaN(Number(amount.replace(/,/g, '')))
              ? `수입에 ${formatMoney(Number(amount.replace(/,/g, '')))}이 자동 등록돼요.`
              : '수입 내역에 자동 등록돼요.'}
          />
        )}

        {target === 5 && (
          <Input
            label="출금액 (원)"
            required
            inputMode="numeric"
            value={payoutAmount}
            onChange={(e) => setPayoutAmount(e.target.value)}
            disabled={submitting}
            placeholder="예) 4,500,000"
            helperText={payoutAmount.trim() && !Number.isNaN(Number(payoutAmount.replace(/,/g, '')))
              ? `지출에 ${formatMoney(Number(payoutAmount.replace(/,/g, '')))}이 자동 등록돼요.`
              : '지출 내역에 자동 등록돼요.'}
          />
        )}

        <div className="space-y-1.5">
          <label htmlFor="settlement-note" className="text-sm font-semibold text-slate-700">메모</label>
          <textarea
            id="settlement-note"
            rows={2}
            value={note}
            onChange={(e) => setNote(e.target.value)}
            disabled={submitting}
            placeholder="특이사항을 적어 주세요. (선택)"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
          />
        </div>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </div>
    </Modal>
  );
}
