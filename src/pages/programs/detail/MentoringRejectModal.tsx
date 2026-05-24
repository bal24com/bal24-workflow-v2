// bal24 v2 — STEP-MENTORING-P3-APPROVE
// 멘토링 일지 반려 사유 입력 모달.

import { useEffect, useState } from 'react';
import { Loader2, XCircle, X } from 'lucide-react';

interface Props {
  isOpen: boolean;
  onClose: () => void;
  onConfirm: (reason: string) => void;
  isLoading: boolean;
}

const MAX_LEN = 500;

export default function MentoringRejectModal({ isOpen, onClose, onConfirm, isLoading }: Props) {
  const [reason, setReason] = useState('');
  const [err, setErr] = useState<string | null>(null);

  useEffect(() => {
    if (!isOpen) { setReason(''); setErr(null); }
  }, [isOpen]);

  if (!isOpen) return null;

  function handleConfirm() {
    const trimmed = reason.trim();
    if (!trimmed) { setErr('반려 사유를 입력해 주세요.'); return; }
    setErr(null);
    onConfirm(trimmed);
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      onClick={onClose} role="dialog" aria-modal="true">
      <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between mb-4">
          <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <XCircle size={18} className="text-rose-500" aria-hidden="true" />
            일지 반려
          </h2>
          <button type="button" onClick={onClose} disabled={isLoading} aria-label="닫기"
            className="p-1.5 rounded-md text-slate-400 hover:bg-slate-100 disabled:opacity-50">
            <X size={16} />
          </button>
        </header>

        <p className="text-xs text-slate-600 mb-3">
          반려 사유는 강사에게 표시돼요. 어떤 부분을 수정해야 하는지 명확히 적어 주세요.
        </p>

        <textarea
          value={reason}
          onChange={(e) => { setReason(e.target.value.slice(0, MAX_LEN)); setErr(null); }}
          rows={5}
          disabled={isLoading}
          placeholder="예) 멘토링 내용에 진행 방식이 빠져 있어요. 보완 후 다시 제출해 주세요."
          className="w-full border border-slate-200 rounded-[10px] px-3 py-2.5 text-sm resize-y
                     focus:outline-none focus:border-rose-400 focus:ring-2 focus:ring-rose-500/10 disabled:bg-slate-50" />

        <div className="flex items-center justify-between mt-1.5 text-[11px]">
          <span className={err ? 'text-rose-600 font-semibold' : 'text-slate-400'}>
            {err ?? '반려 사유는 필수입니다.'}
          </span>
          <span className="text-slate-400 tabular-nums">{reason.length}/{MAX_LEN}</span>
        </div>

        <footer className="flex items-center justify-end gap-2 mt-5">
          <button type="button" onClick={onClose} disabled={isLoading}
            className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-[10px] transition-colors disabled:opacity-50">
            취소
          </button>
          <button type="button" onClick={handleConfirm} disabled={isLoading}
            className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-rose-500 rounded-[10px] hover:bg-rose-600 transition-colors disabled:opacity-50">
            {isLoading ? <Loader2 size={14} className="animate-spin" /> : <XCircle size={14} />}
            반려 처리
          </button>
        </footer>
      </div>
    </div>
  );
}
