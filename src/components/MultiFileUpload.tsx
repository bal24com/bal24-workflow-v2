// 박경수님 2026-06-02 CLUB-8 — 다중 파일 업로드 공용 컴포넌트.
// 보고서 섹션·동아리 활동 등에서 사진·증빙 여러 개 첨부. Supabase Storage 업로드 후 ActivityFile[] 반환.

import { useRef, useState } from 'react';
import { Loader2, Upload, X, FileText, Image as ImageIcon } from 'lucide-react';
import { supabase } from '../lib/supabase';
import { useToast } from '../contexts/ToastContext';
import type { ActivityFile } from '../types/database';

interface Props {
  bucket: string;
  /** 저장 경로 prefix (예: programId 또는 clubId) */
  pathPrefix: string;
  files: ActivityFile[];
  onChange: (files: ActivityFile[]) => void;
  disabled?: boolean;
  accept?: string;
}

function isImage(name: string): boolean {
  return /\.(png|jpe?g|gif|webp)$/i.test(name);
}

export default function MultiFileUpload({
  bucket, pathPrefix, files, onChange, disabled, accept,
}: Props) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  async function handleFiles(fileList: FileList | null) {
    if (!fileList || fileList.length === 0) return;
    setUploading(true);
    const added: ActivityFile[] = [];
    for (const file of Array.from(fileList)) {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safe = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 50);
      const path = `${pathPrefix}/${Date.now()}_${Math.random().toString(36).slice(2, 7)}_${safe}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage.from(bucket).upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (error) {
        console.error('[MultiFileUpload] 업로드 실패:', error.message);
        const m = error.message.toLowerCase();
        if (m.includes('bucket not found')) toast.error(`저장소(${bucket})가 없어요. 관리자에게 문의해 주세요.`);
        else toast.error(`${file.name} 업로드에 실패했어요.`);
        continue;
      }
      const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
      added.push({ url: pub.publicUrl, name: file.name, size: file.size });
    }
    setUploading(false);
    if (added.length > 0) {
      onChange([...files, ...added]);
      toast.success(`${added.length}개 파일을 첨부했어요.`);
    }
    if (inputRef.current) inputRef.current.value = '';
  }

  function removeFile(idx: number) {
    onChange(files.filter((_, i) => i !== idx));
  }

  return (
    <div className="space-y-2">
      {files.length > 0 && (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {files.map((f, i) => (
            <li key={`${f.url}-${i}`} className="flex items-center gap-2 rounded-lg border border-slate-200 bg-slate-50 px-2.5 py-1.5">
              {isImage(f.name)
                ? <ImageIcon size={13} className="text-violet-500 shrink-0" aria-hidden="true" />
                : <FileText size={13} className="text-slate-400 shrink-0" aria-hidden="true" />}
              <a href={f.url} target="_blank" rel="noreferrer"
                className="flex-1 min-w-0 truncate text-xs text-slate-700 hover:text-violet-700 hover:underline">
                {f.name}
              </a>
              {!disabled && (
                <button type="button" onClick={() => removeFile(i)} aria-label="파일 제거"
                  className="p-0.5 rounded hover:bg-rose-50 text-rose-400"><X size={12} aria-hidden="true" /></button>
              )}
            </li>
          ))}
        </ul>
      )}

      {!disabled && (
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="w-full inline-flex items-center justify-center gap-1.5 h-9 rounded-lg border border-dashed border-violet-300 text-violet-700 text-xs font-bold hover:bg-violet-50 disabled:opacity-50">
          {uploading
            ? <><Loader2 size={13} className="animate-spin" aria-hidden="true" /> 업로드 중…</>
            : <><Upload size={13} aria-hidden="true" /> 파일 첨부 (사진·문서)</>}
        </button>
      )}

      <input ref={inputRef} type="file" multiple accept={accept ?? 'image/*,.pdf,.hwp,.docx,.xlsx,.pptx'}
        className="hidden" onChange={(e) => void handleFiles(e.target.files)} />
    </div>
  );
}
