// bal24 v2 — 컨소시엄 상세 · 파일 탭
// FileDropZone 기반. consortium-files 버킷 + files.consortium_id 사용.
// TODO: 향후 ProjectDetail/FilesTab과 공유 컴포넌트로 추상화

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, FileIcon, ExternalLink, Trash2 } from 'lucide-react';
import {
  Card,
  CardContent,
  CardHeader,
  CardTitle,
  FileDropZone,
} from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import type { FileRecord } from '../../types/database';

const STORAGE_BUCKET = 'consortium-files';

type Props = {
  consortiumId: string;
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
  if (m.includes('bucket not found')) return `파일 저장소(${STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`;
  if (m.includes('payload too large') || m.includes('exceeded')) return '파일 용량이 너무 커요.';
  if (m.includes('row-level security') || m.includes('permission denied')) return '파일을 올릴 권한이 없어요.';
  return '파일 업로드 중 오류가 발생했어요.';
}

export default function ConsortiumFilesTab({ consortiumId, uploaderId }: Props) {
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const lastUidRef = useRef<string>('');

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    try {
      const { data, error } = await supabase
        .from('files')
        .select('*')
        .eq('consortium_id', consortiumId)
        .order('created_at', { ascending: false });
      if (error) throw error;
      setFiles((data ?? []) as FileRecord[]);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[consortium-files] 조회 실패:', raw);
      setErrorMsg('파일 목록을 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [consortiumId]);

  useEffect(() => { void loadFiles(); }, [loadFiles]);

  const handleFile = useCallback(
    async (file: File) => {
      const uid = `${Date.now()}_${Math.random()}`;
      lastUidRef.current = uid;
      setUploading(true);
      setUploadingName(file.name);
      setErrorMsg(null);
      try {
        const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
        const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 60);
        const path = `${consortiumId}/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;

        const upload = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type || undefined,
        });
        if (upload.error) throw upload.error;

        const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
        const insert = await supabase.from('files').insert({
          consortium_id: consortiumId,
          uploader_id: uploaderId ?? null,
          file_name: file.name,
          file_url: pub.publicUrl,
          file_size: file.size,
          file_type: file.type || null,
        });
        if (insert.error) throw insert.error;

        await loadFiles();
      } catch (err) {
        const raw = err instanceof Error ? err.message : '';
        console.error('[consortium-files] 업로드 실패:', raw);
        setErrorMsg(translateUploadError(raw));
      } finally {
        if (lastUidRef.current === uid) {
          setUploading(false);
          setUploadingName(null);
        }
      }
    },
    [consortiumId, uploaderId, loadFiles],
  );

  const handleDelete = async (record: FileRecord) => {
    if (!confirm(`"${record.file_name}" 파일을 삭제할까요?`)) return;
    try {
      const marker = `/${STORAGE_BUCKET}/`;
      const idx = record.file_url.indexOf(marker);
      if (idx >= 0) {
        const path = record.file_url.slice(idx + marker.length);
        const { error: storageErr } = await supabase.storage.from(STORAGE_BUCKET).remove([path]);
        if (storageErr) console.error('[consortium-files] storage 삭제 실패:', storageErr.message);
      }
      const { error } = await supabase.from('files').delete().eq('id', record.id);
      if (error) throw error;
      await loadFiles();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[consortium-files] 삭제 실패:', raw);
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
          <FileDropZone
            onFileSelected={(f) => void handleFile(f)}
            uploading={uploading}
            uploadingLabel={uploadingName ? `업로드 중… (${uploadingName})` : '업로드 중…'}
          />
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
                  <a href={f.file_url} target="_blank" rel="noreferrer noopener"
                    className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50"
                    aria-label={`${f.file_name} 새 탭에서 열기`}>
                    <ExternalLink size={16} />
                  </a>
                  <button type="button" onClick={() => void handleDelete(f)}
                    className="p-2 rounded-lg text-slate-400 hover:text-danger hover:bg-danger/5"
                    aria-label={`${f.file_name} 삭제`}>
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
