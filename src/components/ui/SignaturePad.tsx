// bal24 v2 — STEP-MENTORING-P3-APPROVE
// 서명 입력 캔버스 (react-signature-canvas) — 모달 안에서 사용.

import { useRef, useState } from 'react';
import SignatureCanvas from 'react-signature-canvas';
import { Eraser, Check, X } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  onConfirm: (dataUrl: string) => void;   // PNG dataURL 반환
  onCancel: () => void;
  /** 확인 버튼 라벨. 기본 "이 서명으로 사용" */
  confirmLabel?: string;
}

export default function SignaturePad({ onConfirm, onCancel, confirmLabel = '이 서명으로 사용' }: Props) {
  const toast = useToast();
  const padRef = useRef<SignatureCanvas | null>(null);
  const [empty, setEmpty] = useState(true);

  function handleClear() {
    padRef.current?.clear();
    setEmpty(true);
  }

  function handleConfirm() {
    if (!padRef.current || padRef.current.isEmpty()) {
      toast.error('서명을 먼저 그려 주세요.');
      return;
    }
    // getTrimmedCanvas로 빈 여백 제거 후 PNG dataURL 추출
    const canvas = padRef.current.getCanvas();
    // react-signature-canvas getTrimmedCanvas는 일부 환경에서 미지원 → getCanvas 사용
    const dataUrl = canvas.toDataURL('image/png');
    onConfirm(dataUrl);
  }

  function handleEnd() {
    setEmpty(padRef.current?.isEmpty() ?? true);
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-slate-500 text-center">
        아래 영역에 서명해 주세요 (마우스 또는 터치).
      </p>
      <div className="rounded-[10px] border-2 border-violet-200 bg-white overflow-hidden">
        <SignatureCanvas
          ref={(r) => { padRef.current = r; }}
          canvasProps={{ width: 400, height: 180, className: 'w-full h-[180px] bg-white' }}
          penColor="#1E1B4B"
          onEnd={handleEnd}
        />
      </div>
      <div className="flex items-center justify-between gap-2">
        <button type="button" onClick={handleClear}
          className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 border border-slate-200 rounded-[10px] hover:bg-slate-50">
          <Eraser size={12} aria-hidden="true" /> 지우기
        </button>
        <div className="flex items-center gap-2">
          <button type="button" onClick={onCancel}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-[10px]">
            <X size={12} /> 취소
          </button>
          <button type="button" onClick={handleConfirm} disabled={empty}
            className="inline-flex items-center gap-1 px-4 py-1.5 text-xs font-bold text-white bg-violet-600 rounded-[10px] hover:bg-violet-700 disabled:opacity-50">
            <Check size={12} aria-hidden="true" /> {confirmLabel}
          </button>
        </div>
      </div>
    </div>
  );
}
