// bal24 v2 — STEP-MENTORING-LOG-UX / 2026-05-26 박경수님
// 멘토링 일지 파일·사진 첨부 컴포넌트.
// 사진 그리드 슬롯 + 문서 리스트 영역 분리 (직관적 다중 업로드).

import { useRef, useState } from 'react';
import { Loader2, Paperclip, Upload, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

const BUCKET = 'mentoring-files';
const MAX_BYTES = 20 * 1024 * 1024;
const ALLOWED_PREFIX = 'image/';
const ALLOWED_EXACT = new Set([
  'application/pdf',
  'application/msword',
  'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
  'application/vnd.ms-excel',
  'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
  'application/vnd.openxmlformats-officedocument.presentationml.presentation',
  'application/vnd.ms-powerpoint',
]);

export interface UploadedFile {
  /** DB row id (있으면 이미 INSERT된 영구 파일, 없으면 신규 작성 중 임시) */
  id?: string;
  file_name: string;
  file_url: string;
  file_type: 'image' | 'document';
  file_size?: number | null;
}

interface Props {
  logId?: string | null;                              // 기존 일지 수정 시 log_id
  userId?: string | null;                             // 작성자 (auth.uid) — anon은 null
  files: UploadedFile[];
  onChange: (next: UploadedFile[]) => void;
  disabled?: boolean;
}

function isAllowed(file: File): boolean {
  if (file.type.startsWith(ALLOWED_PREFIX)) return true;
  if (ALLOWED_EXACT.has(file.type)) return true;
  return false;
}

function classifyType(file: File): 'image' | 'document' {
  return file.type.startsWith(ALLOWED_PREFIX) ? 'image' : 'document';
}

function safeSegment(name: string): string {
  return name.replace(/[^A-Za-z0-9._\-가-힣]+/g, '_').slice(0, 80);
}

export default function MentoringFileUpload({ logId, userId, files, onChange, disabled }: Props) {
  const toast = useToast();
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const imageInputRef = useRef<HTMLInputElement | null>(null);
  const docInputRef = useRef<HTMLInputElement | null>(null);

  async function uploadOne(file: File): Promise<UploadedFile | null> {
    if (file.size > MAX_BYTES) {
      toast.error(`"${file.name}" 파일이 20MB를 초과해요.`);
      return null;
    }
    if (!isAllowed(file)) {
      toast.error(`"${file.name}" 형식은 업로드할 수 없어요. (이미지·PDF·Office 문서만 가능)`);
      return null;
    }
    const folder = (userId && userId.length > 0) ? userId : 'anon';
    const path = `${folder}/${Date.now()}_${Math.random().toString(36).slice(2, 8)}_${safeSegment(file.name)}`;
    const { error: upErr } = await supabase.storage
      .from(BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (upErr) {
      console.error('[mentoring-file] 업로드 실패:', upErr.message);
      toast.error(`"${file.name}" 업로드에 실패했어요.`);
      return null;
    }
    const { data: pub } = supabase.storage.from(BUCKET).getPublicUrl(path);
    const item: UploadedFile = {
      file_name: file.name,
      file_url: pub.publicUrl,
      file_type: classifyType(file),
      file_size: file.size,
    };

    if (logId) {
      const { data, error: insErr } = await supabase.from('mentoring_log_files')
        .insert({
          log_id: logId,
          created_by: userId || null,
          file_name: item.file_name,
          file_url: item.file_url,
          file_type: item.file_type,
          file_size: item.file_size ?? null,
        })
        .select('id').single();
      if (insErr) {
        const m = (insErr.message ?? '').toLowerCase();
        if (m.includes('does not exist') || m.includes('pgrst205')) {
          toast.error('첨부 파일 기능이 아직 활성화되지 않았어요. 관리자에게 마이그레이션 실행을 요청해 주세요.');
        } else {
          console.error('[mentoring-file] DB insert 실패:', insErr.message);
          toast.error('파일 정보 저장에 실패했어요.');
        }
        return null;
      }
      item.id = (data as { id: string }).id;
    }
    return item;
  }

  async function handleFiles(list: FileList | File[]) {
    setUploading(true);
    const arr = Array.from(list);
    const added: UploadedFile[] = [];
    for (const f of arr) {
      const ok = await uploadOne(f);
      if (ok) added.push(ok);
    }
    setUploading(false);
    if (added.length > 0) {
      onChange([...files, ...added]);
      toast.success(`${added.length}개 파일이 첨부됐어요.`);
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const list = e.target.files;
    if (list && list.length > 0) void handleFiles(list);
    if (e.target) e.target.value = '';
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setDragging(false);
    const list = e.dataTransfer.files;
    if (list && list.length > 0) void handleFiles(list);
  }

  async function removeAt(idx: number) {
    const target = files[idx];
    if (target.id) {
      const { error } = await supabase.from('mentoring_log_files').delete().eq('id', target.id);
      if (error) {
        console.error('[mentoring-file] 삭제 실패:', error.message);
        toast.error('파일 삭제에 실패했어요.');
        return;
      }
    }
    onChange(files.filter((_, i) => i !== idx));
    toast.success('파일을 삭제했어요.');
  }

  // 사진 / 문서 영역 분리
  const images = files.map((f, i) => ({ f, i })).filter((x) => x.f.file_type === 'image');
  const docs = files.map((f, i) => ({ f, i })).filter((x) => x.f.file_type !== 'image');

  return (
    <div className="space-y-3">
      <label className="text-xs font-semibold text-slate-700 inline-flex items-center gap-1">
        <Paperclip size={11} aria-hidden="true" /> 사진·파일 첨부
        <span className="text-[10px] text-slate-400 font-normal ml-1">(이미지·PDF·Office 문서, 최대 20MB)</span>
      </label>

      {/* 사진 영역 — 그리드 슬롯 (큰 미리보기 + + 슬롯) */}
      <div>
        <p className="text-[11px] text-slate-500 mb-1.5 inline-flex items-center gap-1">
          <span>📷</span>
          <span className="font-semibold">사진</span>
          <span className="text-slate-400">({images.length}장)</span>
        </p>
        <div
          onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
          onDragLeave={() => setDragging(false)}
          onDrop={handleDrop}
          className={`grid grid-cols-3 sm:grid-cols-4 gap-2 ${dragging ? 'ring-2 ring-violet-400 rounded-xl p-1' : ''}`}>
          {images.map(({ f, i }) => (
            <div key={f.id ?? `${i}-${f.file_url}`}
              className="relative aspect-square rounded-xl overflow-hidden border border-violet-200 bg-violet-50">
              <a href={f.file_url} target="_blank" rel="noopener noreferrer">
                <img src={f.file_url} alt={f.file_name}
                  className="w-full h-full object-cover hover:opacity-90" />
              </a>
              <button type="button" disabled={disabled}
                onClick={() => void removeAt(i)}
                aria-label={`${f.file_name} 삭제`}
                className="absolute top-1 right-1 inline-flex items-center justify-center w-6 h-6 rounded-full bg-white/90 text-rose-500 shadow hover:bg-rose-50 disabled:opacity-50">
                <X size={12} />
              </button>
              <p className="absolute bottom-0 left-0 right-0 px-1.5 py-1 text-[9px] text-white bg-gradient-to-t from-black/70 to-transparent truncate">
                {f.file_name}
              </p>
            </div>
          ))}
          {/* 사진 추가 슬롯 */}
          <button type="button" disabled={disabled || uploading}
            onClick={() => imageInputRef.current?.click()}
            className={`aspect-square rounded-xl border-2 border-dashed flex flex-col items-center justify-center gap-1 transition-colors text-[11px] ${
              disabled ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50 text-slate-400'
              : dragging ? 'border-violet-500 bg-violet-50 text-violet-700 cursor-pointer'
              : 'border-violet-200 bg-violet-50/30 text-violet-600 cursor-pointer hover:border-violet-400 hover:bg-violet-50'
            }`}>
            {uploading
              ? <Loader2 size={18} className="animate-spin text-violet-500" />
              : <>
                  <span className="text-2xl leading-none">＋</span>
                  <span className="font-semibold">사진 추가</span>
                </>}
          </button>
        </div>
        <input ref={imageInputRef} type="file" accept="image/*" multiple
          disabled={disabled} onChange={handleSelect} className="hidden" />
        <p className="mt-1 text-[10px] text-slate-400">여러 장 한 번에 선택 가능 · 드래그해서 놓을 수도 있어요</p>
      </div>

      {/* 문서 영역 — 별도 드롭존 + 리스트 */}
      <div>
        <p className="text-[11px] text-slate-500 mb-1.5 inline-flex items-center gap-1">
          <span>📎</span>
          <span className="font-semibold">문서</span>
          <span className="text-slate-400">({docs.length}건)</span>
        </p>
        <div
          role="button" tabIndex={0}
          onClick={() => !disabled && docInputRef.current?.click()}
          onKeyDown={(e) => { if ((e.key === 'Enter' || e.key === ' ') && !disabled) docInputRef.current?.click(); }}
          className={`border-2 border-dashed rounded-xl p-3 text-center transition-colors ${
            disabled ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
            : 'border-violet-200 bg-violet-50/30 cursor-pointer hover:border-violet-400 hover:bg-violet-50'
          }`}>
          <p className="text-xs text-slate-600">
            <Upload size={13} className="inline-block mr-1 -mt-0.5 text-violet-500" aria-hidden="true" />
            PDF·Word·엑셀 파일 추가
          </p>
        </div>
        <input ref={docInputRef} type="file" multiple
          accept="application/pdf,application/msword,application/vnd.openxmlformats-officedocument.wordprocessingml.document,application/vnd.ms-excel,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet,application/vnd.ms-powerpoint,application/vnd.openxmlformats-officedocument.presentationml.presentation"
          disabled={disabled} onChange={handleSelect} className="hidden" />

        {docs.length > 0 && (
          <ul className="mt-2 space-y-1.5">
            {docs.map(({ f, i }) => (
              <li key={f.id ?? `${i}-${f.file_url}`}
                className="flex items-center gap-2 bg-white border border-violet-100 rounded-lg px-2.5 py-1.5">
                <div className="w-9 h-9 bg-violet-100 rounded-md flex items-center justify-center text-violet-600 text-[10px] font-bold shrink-0">
                  FILE
                </div>
                <a href={f.file_url} target="_blank" rel="noopener noreferrer"
                  className="flex-1 min-w-0 text-xs text-slate-700 hover:text-violet-700 hover:underline truncate">
                  {f.file_name}
                </a>
                {f.file_size != null && (
                  <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                    {Math.round(f.file_size / 1024)}KB
                  </span>
                )}
                <button type="button" disabled={disabled}
                  onClick={() => void removeAt(i)}
                  aria-label={`${f.file_name} 삭제`}
                  className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500 disabled:opacity-50">
                  <X size={11} />
                </button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}
