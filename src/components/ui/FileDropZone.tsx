// bal24 v2 — 단일 파일 드롭존
// 드래그앤드롭 + Ctrl+V 붙여넣기 + 클릭 선택
// 업로드는 부모가 담당 (onFileSelected 콜백). URL 표시 모드 분리.

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Upload, FileIcon, ExternalLink, X } from 'lucide-react';
import { cn } from '../../lib/utils';

export type FileDropZoneProps = {
  /** 업로드 완료된 파일 URL이 있으면 미리보기 모드로 전환 */
  fileUrl?: string | null;
  fileName?: string | null;
  /** 파일이 선택/드롭/페이스트 됐을 때 호출 */
  onFileSelected: (file: File) => void;
  /** 미리보기 모드에서 X 버튼 누를 때 */
  onClear?: () => void;
  uploading?: boolean;
  uploadingLabel?: string;
  disabled?: boolean;
  /** 페이스트(Ctrl+V) 글로벌 리스너 활성화 여부 (기본 true) */
  enablePaste?: boolean;
  accept?: string;
  className?: string;
};

export default function FileDropZone({
  fileUrl,
  fileName,
  onFileSelected,
  onClear,
  uploading = false,
  uploadingLabel,
  disabled = false,
  enablePaste = true,
  accept,
  className,
}: FileDropZoneProps) {
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  // 글로벌 paste 리스너 — 모달 안에서 어디 클릭해도 Ctrl+V 동작
  useEffect(() => {
    if (!enablePaste || disabled || uploading) return;

    const handlePaste = (e: globalThis.ClipboardEvent) => {
      if (!e.clipboardData) return;
      const file = e.clipboardData.files[0];
      if (!file) return;
      e.preventDefault();
      onFileSelected(file);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [enablePaste, disabled, uploading, onFileSelected]);

  if (fileUrl) {
    return (
      <div
        className={cn(
          'flex items-center gap-3 rounded-xl border border-slate-200 bg-white px-4 py-3',
          className,
        )}
      >
        <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
          <FileIcon size={18} />
        </span>
        <div className="flex-1 min-w-0">
          <div className="text-sm font-semibold text-text truncate">
            {fileName || '업로드된 파일'}
          </div>
          <div className="text-xs text-muted truncate">{fileUrl}</div>
        </div>
        <a
          href={fileUrl}
          target="_blank"
          rel="noreferrer noopener"
          className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50"
          aria-label="파일 새 탭에서 열기"
        >
          <ExternalLink size={16} />
        </a>
        {onClear && (
          <button
            type="button"
            onClick={onClear}
            disabled={disabled || uploading}
            className="p-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5 disabled:opacity-50"
            aria-label="파일 제거"
          >
            <X size={16} />
          </button>
        )}
      </div>
    );
  }

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    if (!disabled && !uploading) setDragActive(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setDragActive(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (disabled || uploading) return;
    const file = e.dataTransfer?.files?.[0];
    if (file) onFileSelected(file);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) onFileSelected(file);
    e.target.value = '';
  };

  return (
    <div
      onDragOver={onDragOver}
      onDragEnter={onDragOver}
      onDragLeave={onDragLeave}
      onDrop={onDrop}
      className={cn(
        'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-6 text-center transition-colors',
        dragActive ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/40',
        (uploading || disabled) ? 'opacity-60' : '',
        className,
      )}
    >
      <Upload size={24} className="text-slate-400" />
      <p className="text-xs text-text font-semibold">
        파일을 끌어다 놓거나{' '}
        <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Ctrl</kbd>+
        <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">V</kbd>로 붙여넣기
      </p>

      <button
        type="button"
        onClick={() => inputRef.current?.click()}
        disabled={disabled || uploading}
        className="mt-1 inline-flex items-center justify-center px-3 py-1.5 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition-colors"
      >
        파일 선택
      </button>

      <input
        ref={inputRef}
        type="file"
        accept={accept}
        hidden
        onChange={onPick}
      />

      {uploading && (
        <p className="text-xs text-primary mt-1">
          {uploadingLabel ?? '업로드 중…'}
        </p>
      )}
    </div>
  );
}
