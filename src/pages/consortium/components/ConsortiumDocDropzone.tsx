// bal24 v2 — STEP-CONSORTIUM-FORM-AI-AUTOFILL (박경수님 2026-05-27)
// 컨소시엄 폼 — 드래그앤드롭 + Ctrl+V 붙여넣기 + 파일선택 통합 업로드 UI.

import { useCallback, useRef, useState } from 'react';
import type { DragEvent, ClipboardEvent, ChangeEvent } from 'react';
import { Loader2, FileText, Sparkles } from 'lucide-react';

interface Props {
  onFile: (file: File) => void;
  isAnalyzing: boolean;
  disabled?: boolean;
}

const ACCEPT_EXT = '.pdf,.docx,.txt,.md,.csv,.xlsx';

const ALLOWED_EXT = ['pdf', 'docx', 'txt', 'md', 'csv', 'xlsx'];

function hasAllowedExt(file: File): boolean {
  const dot = file.name.lastIndexOf('.');
  if (dot < 0) return false;
  const ext = file.name.slice(dot + 1).toLowerCase();
  return ALLOWED_EXT.includes(ext);
}

export default function ConsortiumDocDropzone({ onFile, isAnalyzing, disabled }: Props) {
  const inputRef = useRef<HTMLInputElement>(null);
  const [isDragging, setIsDragging] = useState(false);

  const handleFile = useCallback(
    (file: File | null | undefined) => {
      if (!file) return;
      if (!hasAllowedExt(file)) {
        // 안내는 모달 자체에서 처리되지만, 명확한 차단을 위해 alert 사용.
        window.alert('PDF · Word(docx) · TXT · CSV · XLSX 파일만 지원해요.');
        return;
      }
      onFile(file);
    },
    [onFile],
  );

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (disabled || isAnalyzing) return;
    setIsDragging(true);
  };
  const onDragLeave = () => setIsDragging(false);
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isAnalyzing) return;
    handleFile(e.dataTransfer.files[0]);
  };
  const onPaste = useCallback(
    (e: ClipboardEvent<HTMLDivElement>) => {
      if (disabled || isAnalyzing) return;
      const file = Array.from(e.clipboardData.files)[0];
      if (file) handleFile(file);
    },
    [handleFile, disabled, isAnalyzing],
  );
  const onChange = (e: ChangeEvent<HTMLInputElement>) => {
    handleFile(e.target.files?.[0]);
    // 같은 파일 다시 선택 가능하도록 reset
    e.target.value = '';
  };

  const handleClick = () => {
    if (disabled || isAnalyzing) return;
    inputRef.current?.click();
  };

  return (
    <div
      role="button"
      tabIndex={0}
      onDragOver={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      onPaste={onPaste}
      onClick={handleClick}
      onKeyDown={(e) => {
        if (e.key === 'Enter' || e.key === ' ') {
          e.preventDefault();
          handleClick();
        }
      }}
      aria-label="컨소시엄 문서 업로드"
      aria-disabled={disabled || isAnalyzing}
      className={`relative flex flex-col items-center justify-center gap-1.5
        border-2 border-dashed rounded-xl p-5 cursor-pointer text-center outline-none transition-colors
        ${isDragging ? 'border-violet-500 bg-violet-50' : 'border-slate-300 bg-slate-50 hover:border-violet-400 hover:bg-violet-50'}
        ${disabled || isAnalyzing ? 'cursor-not-allowed opacity-70' : ''}
      `}
    >
      {isAnalyzing ? (
        <>
          <Loader2 size={24} className="text-violet-500 animate-spin" aria-hidden="true" />
          <p className="text-sm font-semibold text-violet-700">AI 분석 중…</p>
          <p className="text-xs text-slate-400">잠시만 기다려 주세요</p>
        </>
      ) : (
        <>
          <div className="flex items-center gap-1.5">
            <FileText size={18} className="text-violet-500" aria-hidden="true" />
            <Sparkles size={14} className="text-amber-500" aria-hidden="true" />
          </div>
          <p className="text-sm font-semibold text-slate-700">
            문서를 드래그하거나 클릭해서 업로드
          </p>
          <p className="text-[11px] text-slate-400">
            PDF · Word · TXT · CSV · XLSX 지원 · Ctrl+V 붙여넣기 가능
          </p>
          <p className="text-[11px] text-violet-600 font-medium">
            🤖 AI 가 컨소시엄 폼을 자동으로 채워드려요
          </p>
        </>
      )}
      <input
        ref={inputRef}
        type="file"
        accept={ACCEPT_EXT}
        className="hidden"
        onChange={onChange}
        disabled={disabled || isAnalyzing}
      />
    </div>
  );
}
