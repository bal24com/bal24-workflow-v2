// bal24 v2 — 공통 파일 탭 (STEP-STORAGE)
// Project / Consortium / Program 모두 같은 UI·로직 사용. bucket·FK 컬럼만 prop.
//
// Storage 패턴 (Private):
// - 신규 업로드: Storage path 를 file_url 에 저장 (publicUrl 사용 X)
// - 다운로드/외부 링크: file_url 이 https 로 시작하면 레거시 publicUrl → 그대로 사용,
//   아니면 createSignedUrl 로 1시간 임시 URL 생성.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, FileIcon, ExternalLink, Trash2 } from 'lucide-react';
import {
  Card, CardContent, CardHeader, CardTitle, FileDropZone,
} from '../ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatDateKo } from '../../lib/utils';
import type { FileRecord } from '../../types/database';
import { sanitizeFileName, translateUploadError } from './sharedFilesUtils';

export type SharedFilesBucket = 'consortium-files' | 'project-files' | 'program-files';
export type SharedFilesFkColumn = 'consortium_id' | 'project_id' | 'program_id';

interface Props {
  bucket: SharedFilesBucket;
  fkColumn: SharedFilesFkColumn;
  fkValue: string;
}

function fileSizeLabel(bytes?: number | null): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

function isLegacyPublicUrl(fileUrl: string): boolean {
  return /^https?:\/\//i.test(fileUrl);
}

/** 레거시 publicUrl 에서 Storage path 추출 (삭제 시 필요) */
function extractLegacyPath(fileUrl: string, bucket: string): string | null {
  const marker = `/${bucket}/`;
  const idx = fileUrl.indexOf(marker);
  return idx >= 0 ? fileUrl.slice(idx + marker.length) : null;
}

export default function SharedFilesTab({ bucket, fkColumn, fkValue }: Props) {
  const { user } = useAuth();
  const [files, setFiles] = useState<FileRecord[]>([]);
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [uploading, setUploading] = useState(false);
  const [uploadingName, setUploadingName] = useState<string | null>(null);
  const lastUidRef = useRef<string>('');

  const loadFiles = useCallback(async () => {
    setLoading(true);
    setErrorMsg(null);
    const { data, error } = await supabase
      .from('files')
      .select('*')
      .eq(fkColumn, fkValue)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[shared-files] 조회 실패:', error.message);
      setErrorMsg('파일 목록을 불러오지 못했어요.');
    } else {
      setFiles((data ?? []) as FileRecord[]);
    }
    setLoading(false);
  }, [fkColumn, fkValue]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await loadFiles();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [loadFiles]);

  const handleFile = useCallback(
    async (file: File) => {
      const uid = `${Date.now()}_${Math.random()}`;
      lastUidRef.current = uid;
      setUploading(true);
      setUploadingName(file.name);
      setErrorMsg(null);
      try {
        const safeName = sanitizeFileName(file.name);
        const path = `${fkValue}/${Date.now()}_${safeName}`;

        const upload = await supabase.storage.from(bucket).upload(path, file, {
          cacheControl: '3600', upsert: false, contentType: file.type || undefined,
        });
        if (upload.error) throw upload.error;

        const insert = await supabase.from('files').insert({
          [fkColumn]: fkValue,
          uploader_id: user?.id ?? null,
          file_name: safeName,
          file_url: path, // Storage path 저장 (Private 버킷 — signedUrl 다운로드)
          file_size: file.size,
          file_type: file.type || null,
        });
        if (insert.error) throw insert.error;

        await loadFiles();
      } catch (err) {
        const raw = err instanceof Error ? err.message : '';
        console.error('[shared-files] 업로드 실패:', raw);
        setErrorMsg(translateUploadError(raw, bucket));
      } finally {
        if (lastUidRef.current === uid) {
          setUploading(false);
          setUploadingName(null);
        }
      }
    },
    [bucket, fkColumn, fkValue, user?.id, loadFiles],
  );

  const handleOpen = async (record: FileRecord) => {
    if (isLegacyPublicUrl(record.file_url)) {
      window.open(record.file_url, '_blank', 'noopener,noreferrer');
      return;
    }
    const { data, error } = await supabase.storage.from(bucket).createSignedUrl(record.file_url, 3600);
    if (error || !data?.signedUrl) {
      console.error('[shared-files] 임시 URL 생성 실패:', error?.message);
      setErrorMsg('파일을 열지 못했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  };

  const handleDelete = async (record: FileRecord) => {
    if (!window.confirm(`"${record.file_name}" 파일을 삭제할까요?`)) return;
    try {
      const path = isLegacyPublicUrl(record.file_url)
        ? extractLegacyPath(record.file_url, bucket)
        : record.file_url;
      if (path) {
        const storageRes = await supabase.storage.from(bucket).remove([path]);
        if (storageRes.error) console.error('[shared-files] storage 삭제 실패:', storageRes.error.message);
      }
      const { error } = await supabase.from('files').delete().eq('id', record.id);
      if (error) throw error;
      await loadFiles();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[shared-files] 삭제 실패:', raw);
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
                  <button
                    type="button"
                    onClick={() => void handleOpen(f)}
                    className="p-2 rounded-lg text-slate-500 hover:text-primary hover:bg-slate-50"
                    aria-label={`${f.file_name} 새 탭에서 열기`}
                  >
                    <ExternalLink size={16} />
                  </button>
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
