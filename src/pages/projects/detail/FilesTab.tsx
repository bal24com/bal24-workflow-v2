// bal24 v2 — 프로젝트 상세 · 파일 탭
// 드래그앤드롭 + Ctrl+V 붙여넣기 + Supabase Storage 업로드

import { useCallback, useEffect, useRef, useState } from 'react';
import type { ChangeEvent, ClipboardEvent, DragEvent } from 'react';
import { Loader2, Upload, FileIcon, ExternalLink, Trash2 } from 'lucide-react';
import { Button, Card, CardContent, CardHeader, CardTitle } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import type { FileRecord } from '../../../types/database';

const STORAGE_BUCKET = 'project-files';

type Props = {
  projectId: string;
  uploaderId?: string;
};

function fileSizeLabel(bytes?: number | null): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function translateUploadError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('bucket not found')) {
    return `파일 저장소(${STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`;
  }
  if (m.includes('exceeded') || m.includes('payload too large')) {
    return '파일 용량이 너무 커요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return '파일을 올릴 권한이 없어요. 관리자에게 문의해 주세요.';
  }
  return '파일 업로드 중 오류가 발생했어요.';
}

export default function FilesTab({ projectId, uploaderId }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const [dragActive, setDragActive] = useState(false);
  const dropRef = useRef<HTMLDivElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('project_id', projectId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFiles((data ?? []) as FileRecord[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[files] 조회 실패:', raw);
      setErrorMsg('파일 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => {
    void loadFiles();
  }, [loadFiles]);

  const uploadOne = useCallback(
    async (file: File) => {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 60);
      const path = `${projectId}/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;

      const upload = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
        cacheControl: '3600',
        upsert: false,
        contentType: file.type || undefined,
      });
      if (upload.error) throw upload.error;

      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);

      const insert = await supabase.from('files').insert({
        project_id: projectId,
        uploader_id: uploaderId ?? null,
        file_name: file.name,
        file_url: pub.publicUrl,
        file_size: file.size,
        file_type: file.type || null,
      });
      if (insert.error) throw insert.error;
    },
    [projectId, uploaderId],
  );

  const handleFiles = useCallback(
    async (list: FileList | File[]) => {
      const arr = Array.from(list);
      if (arr.length === 0) return;

      setUploading(true);
      setErrorMsg(null);
      try {
        for (const f of arr) {
          setUploadingName(f.name);
          await uploadOne(f);
        }
        await loadFiles();
      } catch (err) {
        const raw = err instanceof Error ? err.message : '';
        console.error('[files] 업로드 실패:', raw);
        setErrorMsg(translateUploadError(raw));
      } finally {
        setUploading(false);
        setUploadingName(null);
      }
    },
    [uploadOne, loadFiles],
  );

  // Ctrl+V 클립보드 붙여넣기
  useEffect(() => {
    const handlePaste = (e: globalThis.ClipboardEvent) => {
      if (!e.clipboardData) return;
      const items = Array.from(e.clipboardData.files);
      if (items.length === 0) return;
      e.preventDefault();
      void handleFiles(items);
    };
    document.addEventListener('paste', handlePaste);
    return () => document.removeEventListener('paste', handlePaste);
  }, [handleFiles]);

  const onDragOver = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(true);
  };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => {
    if (e.currentTarget === e.target) setDragActive(false);
  };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault();
    setDragActive(false);
    if (e.dataTransfer?.files?.length) void handleFiles(e.dataTransfer.files);
  };
  const onPickFile = (e: ChangeEvent<HTMLInputElement>) => {
    if (e.target.files?.length) void handleFiles(e.target.files);
    e.target.value = '';
  };
  const onPasteOnDrop = (e: ClipboardEvent<HTMLDivElement>) => {
    if (!e.clipboardData?.files?.length) return;
    e.preventDefault();
    void handleFiles(e.clipboardData.files);
  };

  const handleDelete = async (record: FileRecord) => {
    if (!confirm(`"${record.file_name}" 파일을 삭제할까요?`)) return;
    try {
      // file_url에서 storage path 추출 (publicUrl 패턴 기반)
      const marker = `/${STORAGE_BUCKET}/`;
      const idx = record.file_url.indexOf(marker);
      if (idx >= 0) {
        const path = record.file_url.slice(idx + marker.length);
        const { error: storageErr } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
        if (storageErr) console.error('[files] storage 삭제 실패:', storageErr.message);
      }
      const { error } = await supabase.from('files').delete().eq('id', record.id);
      if (error) throw error;
      await loadFiles();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[files] 삭제 실패:', raw);
      setErrorMsg('파일 삭제 중 오류가 발생했어요.');
    }
  };

  return (
    <div className="space-y-4">
      <Card>
        <CardHeader>
          <CardTitle>파일 업로드</CardTitle>
        </CardHeader>
        <CardContent>
          <div
            ref={dropRef}
            tabIndex={0}
            onDragOver={onDragOver}
            onDragEnter={onDragOver}
            onDragLeave={onDragLeave}
            onDrop={onDrop}
            onPaste={onPasteOnDrop}
            className={[
              'flex flex-col items-center justify-center gap-2 rounded-xl border-2 border-dashed p-8 text-center transition-colors',
              dragActive ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/40',
              uploading ? 'opacity-60' : '',
            ].join(' ')}
            aria-label="파일 드래그앤드롭 영역. 클릭 또는 Ctrl+V로 붙여넣기 가능."
          >
            <Upload size={28} className="text-slate-400" />
            <p className="text-sm text-text font-semibold">
              여기로 파일을 끌어다 놓거나 <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs">Ctrl</kbd> + <kbd className="px-1.5 py-0.5 bg-white border border-slate-200 rounded text-xs">V</kbd>로 붙여넣기 해주세요.
            </p>
            <p className="text-xs text-muted">또는 버튼으로 직접 선택할 수 있어요.</p>

            <Button
              variant="outline"
              size="sm"
              onClick={() => fileInputRef.current?.click()}
              disabled={uploading}
            >
              파일 선택
            </Button>
            <input
              ref={fileInputRef}
              type="file"
              multiple
              hidden
              onChange={onPickFile}
            />

            {uploading && (
              <div className="mt-2 inline-flex items-center gap-1.5 text-xs text-primary">
                <Loader2 size={14} className="animate-spin" />
                업로드 중…{uploadingName ? ` (${uploadingName})` : ''}
              </div>
            )}
          </div>

          {errorMsg && (
            <div role="alert" className="mt-3 rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
              {errorMsg}
            </div>
          )}
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>파일 ({files.length})</CardTitle>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="flex items-center justify-center py-8 text-sm text-muted">
              <Loader2 size={16} className="animate-spin mr-2" />
              불러오는 중…
            </div>
          ) : files.length === 0 ? (
            <p className="text-sm text-muted text-center py-8">아직 업로드된 파일이 없어요.</p>
          ) : (
            <ul className="divide-y divide-slate-100 -mx-1">
              {files.map((f) => (
                <li key={f.id} className="flex items-center gap-3 py-3 px-1">
                  <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-primary/10 text-primary">
                    <FileIcon size={18} />
                  </span>
                  <div className="flex-1 min-w-0">
                    <div className="text-sm font-semibold text-text truncate">{f.file_name}</div>
                    <div className="text-xs text-muted">
                      {fileSizeLabel(f.file_size)}
                      {f.file_size != null && ' · '}
                      {formatDateKo(f.created_at)}
                    </div>
                  </div>
                  <a
                    href={f.file_url}
                    target="_blank"
                    rel="noreferrer noopener"
                    className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50"
                    aria-label={`${f.file_name} 새 탭에서 열기`}
                  >
                    <ExternalLink size={16} />
                  </a>
                  <button
                    type="button"
                    onClick={() => void handleDelete(f)}
                    className="p-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5"
                    aria-label={`${f.file_name} 삭제`}
                  >
                    <Trash2 size={16} />
                  </button>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>
    </div>
  );
}
