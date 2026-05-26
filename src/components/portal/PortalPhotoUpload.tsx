// bal24 v2 — STEP-PORTAL-MULTI-FIX (박경수님 2026-05-26)
// 강사 포털 공용 사진 업로드 — 멘토링 일지·강의 일지 공통.
// 드래그·Ctrl+V 붙여넣기·모바일 카메라 촬영·갤러리 선택·다중 업로드.

import { useEffect, useRef, useState } from 'react';
import { Camera, Loader2, X, Upload } from 'lucide-react';
import { supabase } from '../../lib/supabase';

export interface PortalPhoto {
  url: string;
  path: string;
  filename: string;
  size: number;
  uploaded_at: string;
}

interface Props {
  photos: PortalPhoto[];
  onChange: (next: PortalPhoto[]) => void;
  /** Supabase Storage 버킷 이름 (예: 'curriculum-photos' / 'mentoring-files') */
  bucket: string;
  /** 업로드 경로 prefix (예: `${programId}/${logId}/${staffId}`) */
  pathPrefix: string;
  disabled?: boolean;
  maxPhotos?: number;     // 기본 10장
  maxBytesEach?: number;  // 기본 10MB
}

const DEFAULT_MAX_PHOTOS = 10;
const DEFAULT_MAX_BYTES = 10 * 1024 * 1024;

function safeName(s: string): string {
  return s.replace(/[^\w.\- ]/g, '_').slice(0, 80);
}

export default function PortalPhotoUpload({
  photos, onChange, bucket, pathPrefix, disabled,
  maxPhotos = DEFAULT_MAX_PHOTOS, maxBytesEach = DEFAULT_MAX_BYTES,
}: Props) {
  const galleryRef = useRef<HTMLInputElement | null>(null);
  const cameraRef = useRef<HTMLInputElement | null>(null);
  const [uploading, setUploading] = useState(false);
  const [dragging, setDragging] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  // Ctrl+V 붙여넣기 — window 전역
  useEffect(() => {
    if (disabled) return;
    const handler = (e: ClipboardEvent) => {
      const files = Array.from(e.clipboardData?.files ?? [])
        .filter((f) => f.type.startsWith('image/'));
      if (files.length > 0) void handleFiles(files);
    };
    window.addEventListener('paste', handler);
    return () => window.removeEventListener('paste', handler);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [disabled, photos]);

  async function uploadOne(file: File): Promise<PortalPhoto | null> {
    if (file.size > maxBytesEach) {
      setErrMsg(`"${file.name}" 크기가 ${Math.round(maxBytesEach / 1024 / 1024)}MB 를 초과해요.`);
      return null;
    }
    if (!file.type.startsWith('image/')) {
      setErrMsg(`"${file.name}" 은 이미지 형식이 아니에요.`);
      return null;
    }
    const path = `${pathPrefix}/${Date.now()}_${safeName(file.name)}`;
    const { error } = await supabase.storage.from(bucket)
      .upload(path, file, { upsert: false, contentType: file.type || undefined });
    if (error) {
      console.error('[PortalPhotoUpload] 업로드 실패:', error.message);
      setErrMsg(error.message.toLowerCase().includes('not found')
        ? `${bucket} 버킷이 없어요. PM 에게 생성을 요청해 주세요.`
        : `업로드 실패: ${error.message}`);
      return null;
    }
    const { data: pub } = supabase.storage.from(bucket).getPublicUrl(path);
    return {
      url: pub.publicUrl, path, filename: file.name, size: file.size,
      uploaded_at: new Date().toISOString(),
    };
  }

  async function handleFiles(list: FileList | File[]) {
    const arr = Array.from(list).filter((f) => f.type.startsWith('image/'));
    if (arr.length === 0) return;
    setErrMsg(null);
    setUploading(true);
    const added: PortalPhoto[] = [];
    for (const f of arr) {
      if (photos.length + added.length >= maxPhotos) {
        setErrMsg(`사진은 최대 ${maxPhotos}장까지 첨부할 수 있어요.`);
        break;
      }
      const ok = await uploadOne(f);
      if (ok) added.push(ok);
    }
    setUploading(false);
    if (added.length > 0) onChange([...photos, ...added]);
  }

  async function removePhoto(photo: PortalPhoto) {
    if (!window.confirm(`사진 "${photo.filename}" 삭제할까요?`)) return;
    await supabase.storage.from(bucket).remove([photo.path]);
    onChange(photos.filter((p) => p.path !== photo.path));
  }

  return (
    <div className="space-y-2">
      <div
        onDragOver={(e) => { e.preventDefault(); if (!disabled) setDragging(true); }}
        onDragLeave={() => setDragging(false)}
        onDrop={(e) => {
          e.preventDefault();
          setDragging(false);
          if (!disabled && e.dataTransfer.files.length > 0) void handleFiles(e.dataTransfer.files);
        }}
        className={`rounded-xl border-2 border-dashed p-3 text-center transition-colors ${
          disabled ? 'opacity-50 cursor-not-allowed border-slate-200 bg-slate-50'
          : dragging ? 'border-violet-500 bg-violet-50'
          : 'border-violet-200 bg-violet-50/30'
        }`}
      >
        <p className="text-xs text-slate-600 mb-2">
          📷 PC: 드래그 또는 <kbd className="px-1 py-0.5 rounded bg-slate-200 text-[10px]">Ctrl+V</kbd> 붙여넣기
          <br />
          📱 모바일: 아래 버튼으로 촬영 또는 갤러리 선택
        </p>
        <div className="inline-flex items-center justify-center gap-2 flex-wrap">
          <button type="button" disabled={disabled || uploading}
            onClick={() => cameraRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-violet-300 text-violet-700 text-xs font-semibold hover:bg-violet-50 disabled:opacity-50">
            <Camera size={13} aria-hidden="true" /> 카메라 촬영
          </button>
          <button type="button" disabled={disabled || uploading}
            onClick={() => galleryRef.current?.click()}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md border border-violet-300 text-violet-700 text-xs font-semibold hover:bg-violet-50 disabled:opacity-50">
            <Upload size={13} aria-hidden="true" /> 갤러리/파일
          </button>
          {uploading && <Loader2 size={14} className="animate-spin text-violet-500" aria-hidden="true" />}
        </div>
        <input ref={cameraRef} type="file" accept="image/*" capture="environment" multiple
          className="hidden" disabled={disabled || uploading}
          onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ''; }} />
        <input ref={galleryRef} type="file" accept="image/*" multiple
          className="hidden" disabled={disabled || uploading}
          onChange={(e) => { if (e.target.files) void handleFiles(e.target.files); e.target.value = ''; }} />
      </div>

      {errMsg && (
        <p className="text-[11px] text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-1">{errMsg}</p>
      )}

      {photos.length > 0 && (
        <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative group aspect-square rounded-lg overflow-hidden border border-violet-200">
              <a href={p.url} target="_blank" rel="noopener noreferrer">
                <img src={p.url} alt={p.filename} className="w-full h-full object-cover hover:opacity-90" />
              </a>
              <button type="button" disabled={disabled}
                onClick={() => void removePhoto(p)} aria-label={`${p.filename} 삭제`}
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-white/90 text-rose-500 shadow flex items-center justify-center opacity-0 group-hover:opacity-100 transition-opacity disabled:opacity-50">
                <X size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}
      <p className="text-[10px] text-slate-400 text-right">{photos.length} / {maxPhotos}장</p>
    </div>
  );
}
