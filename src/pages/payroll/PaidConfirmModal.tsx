// 지급 완료 확인 모달 — 박경수님 + SkyClaw STEP-PAYROLL-STATUS-FLOW (2026-05-28)
// 지급일 입력 후 payment_status 를 'paid' 로 전환

import { useState } from 'react';
import { Modal, Button } from '../../components/ui';
import { formatMoney } from '../../lib/utils';

interface Props {
  open: boolean;
  payeeName: string;
  amount: number;
  onClose: () => void;
  onConfirm: (paidAt: string) => void | Promise<void>;
}

export default function PaidConfirmModal({ open, payeeName, amount, onClose, onConfirm }: Props) {
  const today = new Date().toISOString().slice(0, 10);
  const [paidAt, setPaidAt] = useState<string>(today);
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!paidAt) return;
    setSaving(true);
    try {
      await onConfirm(`${paidAt}T00:00:00Z`);
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={onClose} title="지급 완료 처리" size="sm"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
        <Button variant="primary" onClick={() => void handleConfirm()} loading={saving}
          className="!bg-emerald-600 hover:!bg-emerald-700">지급 완료</Button>
      </>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          <strong className="text-violet-700">{payeeName}</strong> 에게 지급한 날짜를 입력해 주세요.
        </p>
        <p className="text-xs text-slate-500">실지급액 <strong className="text-slate-700 tabular-nums">{formatMoney(amount)}</strong></p>
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">지급일</span>
          <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} max={today}
            className="mt-1 w-full h-10 rounded-xl border border-slate-200 px-3 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none" />
        </label>
      </div>
    </Modal>
  );
}
