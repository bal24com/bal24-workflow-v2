// bal24 v2 — STEP-REJECTION-REASON-UI 탈락 사유 입력 모달
// 단건/일괄 탈락 처리 시 reason 입력 → 이메일 본문에 포함.

import { useState, useEffect } from 'react';
import { XCircle } from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui';

interface Props {
  open: boolean;
  /** 단건이면 신청자 이름, 일괄이면 "N명" 형태 */
  targetLabel: string;
  submitting: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
}

export default function RejectionReasonModal({ open, targetLabel, submitting, onClose, onConfirm }: Props) {
  const [reason, setReason] = useState('');

  // 모달 열릴 때마다 입력 초기화
  useEffect(() => {
    if (open) setReason('');
  }, [open]);

  const trimmed = reason.trim();
  const canSubmit = trimmed.length > 0 && !submitting;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="탈락 처리"
      description="입력한 사유는 신청자에게 이메일로 전달돼요."
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button
            variant="primary"
            leftIcon={<XCircle size={14} />}
            onClick={() => onConfirm(trimmed)}
            disabled={!canSubmit}
            loading={submitting}
            className="!bg-rose-600 hover:!bg-rose-700"
          >
            탈락 처리
          </Button>
        </>
      }
    >
      <div className="space-y-3 text-sm">
        <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
          <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">대상</p>
          <p className="text-sm font-bold text-[#1E1B4B] mt-0.5">{targetLabel}</p>
        </div>
        <div className="space-y-1">
          <label className="text-xs font-semibold text-slate-700">
            탈락 사유 <span className="text-rose-500">*</span>
          </label>
          <textarea
            value={reason}
            onChange={(e) => setReason(e.target.value)}
            disabled={submitting}
            rows={4}
            placeholder="탈락 사유를 입력해 주세요. 신청자에게 이메일로 전달됩니다."
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-y leading-relaxed"
          />
        </div>
        {!trimmed && (
          <p className="text-[11px] text-slate-400">사유를 입력해야 처리할 수 있어요.</p>
        )}
      </div>
    </Modal>
  );
}
