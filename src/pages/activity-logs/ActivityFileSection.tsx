// bal24 v2 — 일지 파일 첨부 영역 (드래그·Ctrl+V·클릭)
// ActivityLogFormModal에서 분리 (400줄 제한 준수)

import { useEffect, useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Plus, Trash2, FileIcon, Upload, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ACTIVITY_FILES_BUCKET } from './activityLogTypes';
import type { ActivityFile } from '../../types/database';
import { sanitizeFileName, translateUploadError } from '../../components/files/sharedFilesUtils';

function fileSizeLabel(bytes?: number): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

type Props = {
  files: ActivityFile[];
  onChange: (next: ActivityFile[]) => void;
  /** 업로드 path prefix용 (선택) */
  pathPrefix?: string;
  disabled?: boolean;
  /** 글로벌 paste 리스너 활성화 */
  enablePaste?: boolean;
};

export default function ActivityFileSection({
  files, onChange, pathPrefix = 'misc', disabled, enablePaste = true,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    setUploading(true);
    setUploadingName(file.name);
    setErrorMsg(null);
    try {
      const safeName = sanitizeFileName(file.name);
      const path = `${pathPrefix || 'misc'}/${Date.now()}_${safeName}`;
      const { error } = await supabase.storage.from(ACTIVITY_FILES_BUCKET).upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(ACTIVITY_FILES_BUCKET).getPublicUrl(path);
      onChange([...files, { url: pub.publicUrl, name: file.name, size: file.size }]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[FILE_UPLOAD_ERROR]', JSON.stringify(err, Object.getOwnPropertyNames(err ?? {})));
      console.error('[activity-log] 파일 업로드 실패:', { bucket: ACTIVITY_FILES_BUCKET, pathPrefix, raw });
      setErrorMsg(translateUploadError(raw, ACTIVITY_FILES_BUCKET));
    } finally {
      setUploading(false);
      setUploadingName(null);
    }
  };

  useEffect(() => {
    if (!enablePaste || disabled) return;
    const handler = (e: globalThis.ClipboardEvent) => {
      const f = e.clipboardData?.files?.[0];
      if (!f) return;
      e.preventDefault();
      void handleFile(f);
    };
    document.addEventListener('paste', handler);
    return () => document.removeEventListener('paste', handler);
  }, [enablePaste, disabled, files, pathPrefix]); // eslint-disable-line react-hooks/exhaustive-deps

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { if (e.currentTarget === e.target) setDragActive(false); };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (uploading || disabled) return;
    const f = e.dataTransfer?.files?.[0];
    if (f) void handleFile(f);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleFile(f);
    e.target.value = '';
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">첨부 파일 ({files.length})</h3>
      </div>
      <div
        onDragOver={onDragOver}
        onDragEnter={onDragOver}
        onDragLeave={onDragLeave}
        onDrop={onDrop}
        className={[
          'rounded-xl border-2 border-dashed p-4 text-center transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/40',
          uploading ? 'opacity-60' : '',
        ].join(' ')}
      >
        <Upload size={20} className="mx-auto text-slate-400 mb-1" />
        <p className="text-xs text-text">
          파일을 끌어다 놓거나 <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">Ctrl</kbd>+<kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-[10px]">V</kbd>로 붙여넣기
        </p>
        <label className="inline-flex mt-2 items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 hover:bg-slate-50 cursor-pointer transition-colors">
          <Plus size={12} />
          파일 선택
          <input type="file" hidden onChange={onPick} disabled={uploading || disabled} />
        </label>
        {uploading && (
          <p className="text-xs text-primary mt-2 inline-flex items-center gap-1">
            <Loader2 size={12} className="animate-spin" />
            업로드 중…{uploadingName ? ` (${uploadingName})` : ''}
          </p>
        )}
      </div>
      {files.length > 0 && (
        <ul className="space-y-1.5">
          {files.map((f, i) => (
            <li key={`${f.url}-${i}`} className="flex items-center gap-2 px-3 py-2 bg-white rounded-lg border border-slate-200">
              <FileIcon size={14} className="text-primary shrink-0" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-text truncate">{f.name}</div>
                {f.size != null && <div className="text-[10px] text-muted">{fileSizeLabel(f.size)}</div>}
              </div>
              <button
                type="button"
                onClick={() => onChange(files.filter((_, idx) => idx !== i))}
                disabled={disabled}
                className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5"
                aria-label={`${f.name} 제거`}
              >
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}
      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">{errorMsg}</div>
      )}
    </section>
  );
}
