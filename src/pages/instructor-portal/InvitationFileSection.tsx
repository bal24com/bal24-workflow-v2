// bal24 v2 — 강사 자료 업로드 섹션 (드래그앤드롭 + 클릭)
// InstructorInvitePage에서 profile_files / materials 둘 다 사용

import { useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Upload, FileIcon, Trash2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { INSTRUCTOR_FILES_BUCKET, fileSizeLabel } from './invitationUtils';
import type { InvitationFile } from '../../types/database';

type Props = {
  title: string;
  description?: string;
  /** 업로드 path 분류 (profiles / materials) */
  pathPrefix: 'profiles' | 'materials';
  invitationId: string;
  files: InvitationFile[];
  onChange: (next: InvitationFile[]) => void;
  /** 50MB 제한 등 */
  maxSizeMB?: number;
  accept?: string;
  disabled?: boolean;
};

function translateError(raw: string, maxMB: number): string {
  const m = raw.toLowerCase();
  if (m.includes('bucket not found')) return `파일 저장소(${INSTRUCTOR_FILES_BUCKET})가 없어요. 운영자에게 문의해 주세요.`;
  if (m.includes('payload too large') || m.includes('exceeded')) return `파일 용량이 너무 커요. (최대 ${maxMB}MB)`;
  if (m.includes('row-level security')) return '파일을 올릴 권한이 없어요.';
  return '파일 업로드 중 오류가 발생했어요.';
}

export default function InvitationFileSection({
  title, description, pathPrefix, invitationId, files, onChange,
  maxSizeMB = 50, accept, disabled,
}: Props) {
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);

  const handleFile = async (file: File) => {
    if (file.size > maxSizeMB * 1024 * 1024) {
      setErrorMsg(`파일이 너무 커요. ${maxSizeMB}MB 이하만 업로드 가능해요.`);
      return;
    }
    setUploading(true);
    setUploadingName(file.name);
    setErrorMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 60);
      const path = `${pathPrefix}/${invitationId}/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage.from(INSTRUCTOR_FILES_BUCKET).upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(INSTRUCTOR_FILES_BUCKET).getPublicUrl(path);
      onChange([...files, { url: pub.publicUrl, name: file.name, size: file.size, type: file.type }]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invitation-files] 업로드 실패:', raw);
      setErrorMsg(translateError(raw, maxSizeMB));
    } finally {
      setUploading(false);
      setUploadingName(null);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setDragActive(false);
  };
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
      <div>
        <h3 className="text-sm font-bold text-text">{title}</h3>
        {description && <p className="text-xs text-muted">{description}</p>}
      </div>

      <div onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={onDragLeave} onDrop={onDrop}
        className={['rounded-xl border-2 border-dashed p-4 text-center transition-colors',
          dragActive ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/40',
          uploading || disabled ? 'opacity-60' : ''].join(' ')}>
        <Upload size={20} className="mx-auto text-slate-400 mb-1" />
        <p className="text-xs text-text">파일을 끌어다 놓거나 버튼으로 선택해 주세요. (최대 {maxSizeMB}MB)</p>
        <label className="inline-flex mt-2 items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200 cursor-pointer hover:bg-slate-50">
          <FileIcon size={12} />
          파일 선택
          <input type="file" hidden accept={accept} onChange={onPick} disabled={uploading || disabled} />
        </label>
        {uploading && (
          <p className="text-xs text-primary mt-2 inline-flex items-center gap-1">
            <Loader2 size={11} className="animate-spin" />
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
              <button type="button" onClick={() => onChange(files.filter((_, idx) => idx !== i))} disabled={disabled}
                className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5"
                aria-label={`${f.name} 제거`}>
                <Trash2 size={12} />
              </button>
            </li>
          ))}
        </ul>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-lg bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">{errorMsg}</div>
      )}
    </section>
  );
}
