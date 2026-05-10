// bal24 v2 — STEP-AUTOFILL 프로그램 등록 폼 상단 자동채우기 섹션

import { useRef, useState } from 'react';
import { Sparkles, Paperclip, Loader2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { extractProgramFromFile, type ExtractedProgram } from '../../lib/programAutoFill';

interface Props {
  onApply: (prog: ExtractedProgram) => number;
  disabled?: boolean;
}

const ACCEPT = '.pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp';

export default function ProgramAutofillSection({ onApply, disabled }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const [extractedSessions, setExtractedSessions] = useState(0);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleRun() {
    if (!file) return;
    setRunning(true);
    try {
      const prog = await extractProgramFromFile(file);
      const count = onApply(prog);
      const sessionCount = prog.sessions?.length ?? 0;
      setExtractedSessions(sessionCount);
      if (count === 0) {
        toast.error('자동채우기에 실패했어요. 직접 입력해 주세요.');
      } else if (sessionCount > 0) {
        toast.success(`${count - sessionCount}개 항목과 차시 ${sessionCount}개를 채웠어요. 저장 시 함께 등록돼요.`);
      } else {
        toast.success(`${count}개 항목을 자동으로 채웠어요.`);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[program-autofill-section] 실행 실패:', raw);
      toast.error('자동채우기에 실패했어요. 직접 입력해 주세요.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <section className="rounded-xl bg-violet-50 border border-violet-200 p-4 space-y-2">
      <header>
        <p className="text-sm font-bold text-violet-800 inline-flex items-center gap-1">
          <Sparkles size={14} aria-hidden="true" />
          문서로 자동채우기 (선택사항)
        </p>
        <p className="text-[11px] text-violet-700/80 mt-0.5">
          운영안·제안서·과업지시서 업로드 → AI가 폼을 자동 입력해요.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input
          ref={inputRef}
          type="file"
          accept={ACCEPT}
          hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)}
          disabled={disabled || running}
        />
        <button
          type="button"
          onClick={() => inputRef.current?.click()}
          disabled={disabled || running}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          <Paperclip size={12} aria-hidden="true" />
          파일 선택
        </button>
        {file && (
          <span className="text-[11px] text-violet-700 truncate max-w-[260px]" title={file.name}>
            {file.name}
          </span>
        )}
        <button
          type="button"
          onClick={() => void handleRun()}
          disabled={!file || disabled || running}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-300 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors disabled:opacity-40 disabled:cursor-not-allowed"
        >
          {running ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
          {running ? '문서 분석 중…' : 'AI 자동채우기'}
        </button>
      </div>

      {extractedSessions > 0 && (
        <div className="flex items-center gap-1.5 pt-1">
          <span className="text-xs bg-violet-100 text-violet-700 px-2 py-0.5 rounded-full font-semibold">
            📋 차시 {extractedSessions}개 자동 추출됨
          </span>
          <span className="text-xs text-slate-500">저장 시 함께 등록돼요</span>
        </div>
      )}
    </section>
  );
}
