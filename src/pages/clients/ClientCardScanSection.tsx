// bal24 v2 — STEP-AUTOFILL-CARD-FULL
// 고객사 등록·수정 모달 상단 명함 이미지 인식 섹션 (callAiWithFile + clientCardAutoFill)

import { useRef, useState } from 'react';
import { Loader2, ScanLine, Sparkles } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  extractFromBusinessCard, countFilledCardFields,
  type ClientCardExtracted,
} from '../../lib/clientCardAutoFill';

interface Props {
  onApply: (extracted: ClientCardExtracted) => void;
  disabled?: boolean;
}

export default function ClientCardScanSection({ onApply, disabled }: Props) {
  const toast = useToast();
  const [scanning, setScanning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleScan(file: File) {
    setScanning(true);
    try {
      if (file.size > 5 * 1024 * 1024) {
        toast.error('이미지는 5MB 이하만 업로드할 수 있어요.');
        return;
      }
      const extracted = await extractFromBusinessCard(file);
      const count = countFilledCardFields(extracted);
      if (count === 0) {
        toast.error('명함 인식에 실패했어요. 직접 입력해 주세요.');
        return;
      }
      onApply(extracted);
      toast.success(`명함에서 ${count}개 항목을 채웠어요.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('[client-card-scan]', msg);
      toast.error(`명함 인식 실패: ${msg}`);
    } finally {
      setScanning(false);
    }
  }

  return (
    <section className="rounded-xl bg-violet-50 border border-violet-200 p-4 space-y-2">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-bold text-violet-800 inline-flex items-center gap-1">
            <Sparkles size={14} aria-hidden="true" />
            명함으로 자동채우기 (선택)
          </p>
          <p className="text-[11px] text-violet-700/80 mt-0.5">
            명함 이미지 업로드 → 상호명·부서·담당자·연락처를 AI가 자동 입력해요.
          </p>
        </div>
        <input ref={inputRef} type="file" accept="image/*" hidden
          onChange={(e) => {
            const f = e.target.files?.[0];
            e.target.value = '';
            if (f) void handleScan(f);
          }}
          disabled={disabled || scanning} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || scanning}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40 shrink-0">
          {scanning ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <ScanLine size={12} aria-hidden="true" />}
          {scanning ? '인식 중…' : '명함 이미지 선택'}
        </button>
      </header>
    </section>
  );
}
