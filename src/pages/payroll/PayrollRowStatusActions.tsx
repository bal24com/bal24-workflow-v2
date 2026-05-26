// 외주/급여 행별 상태 액션 (액션 버튼 + 모달 통합) — 박경수님 + SkyClaw STEP-PAYROLL-STATUS-FLOW (2026-05-28)
// PayExpenseActions + PaidConfirmModal + CancelReasonModal 을 행 단위로 묶어 PayrollPage 의 V-1 한도 줄이기.

import { useState } from 'react';
import { useToast } from '../../contexts/ToastContext';
import { useAuth } from '../../contexts/AuthContext';
import PayExpenseActions from './PayExpenseActions';
import PaidConfirmModal from './PaidConfirmModal';
import CancelReasonModal from './CancelReasonModal';
import { transitionPayrollStatus } from './payrollUtils';
import type { PayrollPaymentStatus } from '../../types/database';

interface RowLite {
  id: string;
  payee_name: string;
  net_amount: number | null;
  subtotal: number;
  payment_status: PayrollPaymentStatus;
}

interface Props {
  row: RowLite;
  canAct: boolean;            // admin/finance 만 액션 노출
  onSaved: () => void;        // 성공 후 reload 콜백
}

export default function PayrollRowStatusActions({ row, canAct, onSaved }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [paidOpen, setPaidOpen] = useState(false);
  const [cancelOpen, setCancelOpen] = useState(false);
  const [busy, setBusy] = useState(false);

  async function doTransition(next: PayrollPaymentStatus, extras: { paidAt?: string; cancelReason?: string } = {}) {
    setBusy(true);
    const err = await transitionPayrollStatus(row.id, next, extras, user?.id);
    setBusy(false);
    if (err) { toast.error(`상태 변경 실패: ${err}`); return; }
    toast.success('상태를 변경했어요.');
    onSaved();
  }

  return (
    <>
      <PayExpenseActions status={row.payment_status} busy={busy} canAct={canAct}
        onTransition={(n) => void doTransition(n)}
        onOpenPaidModal={() => setPaidOpen(true)}
        onOpenCancelModal={() => setCancelOpen(true)} />
      <PaidConfirmModal open={paidOpen} payeeName={row.payee_name}
        amount={Number(row.net_amount && row.net_amount > 0 ? row.net_amount : row.subtotal)}
        onClose={() => setPaidOpen(false)}
        onConfirm={async (paidAt) => { setPaidOpen(false); await doTransition('paid', { paidAt }); }} />
      <CancelReasonModal open={cancelOpen} payeeName={row.payee_name}
        onClose={() => setCancelOpen(false)}
        onConfirm={async (reason) => { setCancelOpen(false); await doTransition('cancelled', { cancelReason: reason }); }} />
    </>
  );
}
