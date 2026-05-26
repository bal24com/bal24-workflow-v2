// 지급 취소·반려 사유 입력 모달 — 박경수님 + SkyClaw STEP-PAYROLL-STATUS-FLOW (2026-05-28)
// payment_status 를 'cancelled' 로 전환 + cancel_reason 기록

import { useState } from 'react';
import { Modal, Button } from '../../components/ui';

interface Props {
  open: boolean;
  payeeName: string;
  onClose: () => void;
  onConfirm: (reason: string) => void | Promise<void>;
}

export default function CancelReasonModal({ open, payeeName, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState<string>('');
  const [saving, setSaving] = useState(false);

  async function handleConfirm() {
    if (!reason.trim()) return;
    setSaving(true);
    try {
      await onConfirm(reason.trim());
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal open={open} onClose={() => { setReason(''); onClose(); }} title="반려·취소 처리" size="sm"
      footer={<>
        <Button variant="ghost" onClick={() => { setReason(''); onClose(); }} disabled={saving}>닫기</Button>
        <Button variant="primary" onClick={() => void handleConfirm()} loading={saving} disabled={!reason.trim()}
          className="!bg-rose-600 hover:!bg-rose-700">반려 처리</Button>
      </>}>
      <div className="space-y-3">
        <p className="text-sm text-slate-600">
          <strong className="text-rose-600">{payeeName}</strong> 지급 요청을 반려·취소합니다.
        </p>
        <label className="block">
          <span className="text-xs font-semibold text-slate-700">사유 (필수)</span>
          <textarea value={reason} onChange={(e) => setReason(e.target.value)} rows={4}
            placeholder="예) 영수증 미첨부, 금액 오류, 요청 중복"
            className="mt-1 w-full rounded-xl border border-slate-200 px-3 py-2 text-sm focus:border-rose-400 focus:ring-2 focus:ring-rose-200 outline-none resize-none" />
        </label>
        <p className="text-[11px] text-slate-400">사유는 PM 에게 표시되며 이력으로 기록돼요.</p>
      </div>
    </Modal>
  );
}
