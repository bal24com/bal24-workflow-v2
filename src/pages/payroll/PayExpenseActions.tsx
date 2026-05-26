// 외주/급여 재무 처리 액션 버튼 그룹 — 박경수님 + SkyClaw STEP-PAYROLL-STATUS-FLOW (2026-05-28)
// 6단계 흐름: submitted → received → processing → paid (어디서든 cancelled).
// 모달 (지급일 입력·반려 사유) 은 호출 측에서 별도 렌더.

import { CheckCircle2, Clock, DollarSign, XCircle } from 'lucide-react';
import { Button } from '../../components/ui';
import type { PayrollPaymentStatus } from '../../types/database';

interface Props {
  status: PayrollPaymentStatus;
  busy?: boolean;
  onTransition: (next: PayrollPaymentStatus) => void;
  onOpenPaidModal: () => void;
  onOpenCancelModal: () => void;
  /** 권한 — admin/finance 만 액션 노출 */
  canAct: boolean;
}

export default function PayExpenseActions({ status, busy, onTransition, onOpenPaidModal, onOpenCancelModal, canAct }: Props) {
  if (!canAct) return null;

  // 종결 상태는 액션 없음
  if (status === 'paid' || status === 'cancelled') return null;

  return (
    <div className="inline-flex items-center gap-1">
      {status === 'submitted' && (
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onTransition('received')}
            leftIcon={<CheckCircle2 size={12} aria-hidden="true" />}
            className="!text-blue-700 !border-blue-200 hover:!bg-blue-50">수신확인</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onOpenCancelModal}
            leftIcon={<XCircle size={12} aria-hidden="true" />}
            className="!text-rose-600 !border-rose-200 hover:!bg-rose-50">반려</Button>
        </>
      )}
      {status === 'received' && (
        <>
          <Button size="sm" variant="outline" disabled={busy} onClick={() => onTransition('processing')}
            leftIcon={<Clock size={12} aria-hidden="true" />}
            className="!text-amber-700 !border-amber-200 hover:!bg-amber-50">처리중</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onOpenCancelModal}
            leftIcon={<XCircle size={12} aria-hidden="true" />}
            className="!text-rose-600 !border-rose-200 hover:!bg-rose-50">반려</Button>
        </>
      )}
      {status === 'processing' && (
        <>
          <Button size="sm" disabled={busy} onClick={onOpenPaidModal}
            leftIcon={<DollarSign size={12} aria-hidden="true" />}
            className="!bg-emerald-600 hover:!bg-emerald-700 !text-white">지급 완료</Button>
          <Button size="sm" variant="outline" disabled={busy} onClick={onOpenCancelModal}
            leftIcon={<XCircle size={12} aria-hidden="true" />}
            className="!text-rose-600 !border-rose-200 hover:!bg-rose-50">반려</Button>
        </>
      )}
      {status === 'draft' && (
        <span className="text-[11px] text-slate-400">PM 작성중</span>
      )}
    </div>
  );
}
