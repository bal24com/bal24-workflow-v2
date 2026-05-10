// bal24 v2 — 프로젝트 산출물 (파일·사진 카테고리별 업로드·갤러리)

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Upload, ImagePlus, FileIcon, Trash2, ExternalLink } from 'lucide-react';
import { Button } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { sanitizeFileName } from '../../../../components/files/sharedFilesUtils';
import { formatDateKo } from '../../../../lib/utils';
import type { ProjectDocument } from '../../../../types/database';

interface Props {
  projectId: string;
}

const BUCKET = 'project-docs';

const CATEGORIES = [
  { key: '',         label: '전체' },
  { key: 'report',   label: '보고서' },
  { key: 'photo',    label: '사진' },
  { key: 'promo',    label: '홍보물' },
  { key: 'delivery', label: '납품물' },
  { key: 'etc',      label: '기타' },
] as const;

function fileSizeLabel(bytes?: number | null): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DeliverablesSection({ projectId }: Props) {
  const toast = useToast();
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<string>('');
  const [uploading, setUploading] = useState(false);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const fileRef = useRef<HTMLInputElement | null>(null);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_documents').select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .in('doc_type', ['deliverable', 'photo'])
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[deliverables] 조회 실패:', error.message);
      toast.error('산출물 목록을 불러오지 못했어요.');
    } else {
      setDocs((data ?? []) as ProjectDocument[]);
    }
    setLoading(false);
  }, [projectId, toast]);

  useEffect(() => {
    if (!projectId) return;
    let cancelled = false;
    void (async () => { await reload(); if (cancelled) return; })();
    return () => { cancelled = true; };
  }, [reload, projectId]);

  // 사진 thumbnail signed URL 생성 (60분)
  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const photos = docs.filter((d) => d.doc_type === 'photo' && !thumbUrls[d.id]);
      if (photos.length === 0) return;
      const next: Record<string, string> = { ...thumbUrls };
      for (const p of photos) {
        const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p.file_url, 3600);
        if (data?.signedUrl) next[p.id] = data.signedUrl;
      }
      if (!cancelled) setThumbUrls(next);
    })();
    return () => { cancelled = true; };
  }, [docs, thumbUrls]);

  async function handleUpload(file: File, isPhoto: boolean, caption?: string) {
    setUploading(true);
    try {
      const safe = sanitizeFileName(file.name);
      const path = `${projectId}/deliverables/${Date.now()}_${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (up.error) throw up.error;
      const { error } = await supabase.from('project_documents').insert({
        project_id: projectId,
        doc_type: isPhoto ? 'photo' : 'deliverable',
        doc_stage: 'wrap',
        file_name: safe,
        file_url: path,
        file_size: file.size,
        description: caption ?? null,
        category: isPhoto ? 'photo' : 'etc',
      });
      if (error) throw error;
    } catch (err) {
      const r = err instanceof Error ? err.message : '';
      console.error('[deliverables] 업로드 실패:', r);
      toast.error('업로드에 실패했어요.');
    } finally {
      setUploading(false);
    }
  }

  async function handleFiles(files: FileList | null, isPhoto: boolean) {
    if (!files || files.length === 0) return;
    let caption: string | undefined;
    if (isPhoto && files.length === 1) {
      const c = window.prompt('사진 설명 (선택)');
      caption = c ?? undefined;
    }
    for (const f of Array.from(files)) await handleUpload(f, isPhoto, caption);
    await reload();
    toast.success(`${files.length}건 업로드 완료.`);
  }

  async function handleOpen(doc: ProjectDocument) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_url, 3600);
    if (error || !data) { toast.error('파일 열기 권한이 없어요.'); return; }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleDelete(doc: ProjectDocument) {
    if (!window.confirm(`"${doc.file_name}" 항목을 삭제할까요?`)) return;
    const { error } = await supabase.from('project_documents')
      .update({ deleted_at: new Date().toISOString() }).eq('id', doc.id);
    if (error) { toast.error('삭제에 실패했어요.'); return; }
    await reload();
    toast.success('삭제됐어요.');
  }

  const visible = docs.filter((d) => {
    if (!filter) return true;
    if (filter === 'photo') return d.doc_type === 'photo';
    return d.category === filter;
  });
  const photos = visible.filter((d) => d.doc_type === 'photo');
  const files = visible.filter((d) => d.doc_type !== 'photo');

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <div className="flex flex-wrap gap-1.5">
          {CATEGORIES.map((c) => (
            <button key={c.key} type="button" onClick={() => setFilter(c.key)}
              className={[
                'inline-flex items-center px-3 py-1 rounded-full text-xs font-semibold transition-colors',
                filter === c.key ? 'bg-violet-600 text-white' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
              ].join(' ')}>{c.label}</button>
          ))}
        </div>
        <div className="flex items-center gap-2">
          <input ref={fileRef} type="file" hidden onChange={(e) => { void handleFiles(e.target.files, false); e.target.value = ''; }} />
          <input ref={photoRef} type="file" hidden multiple accept="image/*" onChange={(e) => { void handleFiles(e.target.files, true); e.target.value = ''; }} />
          <Button variant="outline" size="sm" leftIcon={<Upload size={12} />} onClick={() => fileRef.current?.click()} disabled={uploading}>
            파일 업로드
          </Button>
          <Button variant="primary" size="sm" leftIcon={<ImagePlus size={12} />} onClick={() => photoRef.current?.click()} disabled={uploading}>
            사진 업로드
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted">
          <Loader2 size={16} className="animate-spin mr-2" /> 불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">이 카테고리에 산출물이 없어요.</p>
      ) : (
        <>
          {photos.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-slate-600">사진 ({photos.length})</h3>
              <div className="grid grid-cols-2 sm:grid-cols-3 lg:grid-cols-4 gap-3">
                {photos.map((p) => (
                  <div key={p.id} className="relative group rounded-xl overflow-hidden border border-slate-200 bg-slate-100 aspect-square">
                    {thumbUrls[p.id] ? (
                      <img src={thumbUrls[p.id]} alt={p.description ?? p.file_name} className="w-full h-full object-cover" />
                    ) : (
                      <div className="w-full h-full flex items-center justify-center"><Loader2 size={16} className="animate-spin text-slate-400" /></div>
                    )}
                    <button type="button" onClick={() => handleDelete(p)} aria-label="삭제"
                      className="absolute top-1 right-1 p-1 rounded bg-black/40 text-white opacity-0 group-hover:opacity-100 transition-opacity">
                      <Trash2 size={11} aria-hidden="true" />
                    </button>
                    {p.description && (
                      <div className="absolute inset-x-0 bottom-0 bg-black/60 text-white text-[10px] px-2 py-1 truncate">{p.description}</div>
                    )}
                  </div>
                ))}
              </div>
            </section>
          )}

          {files.length > 0 && (
            <section className="space-y-2">
              <h3 className="text-xs font-bold text-slate-600">파일 ({files.length})</h3>
              <ul className="space-y-1.5">
                {files.map((d) => (
                  <li key={d.id} className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-100 bg-white">
                    <FileIcon size={14} className="text-violet-500 shrink-0" aria-hidden="true" />
                    <div className="flex-1 min-w-0">
                      <div className="text-sm font-semibold text-slate-700 truncate">{d.file_name}</div>
                      <div className="text-[11px] text-slate-400">{fileSizeLabel(d.file_size)} · {formatDateKo(d.created_at)}</div>
                    </div>
                    <button type="button" onClick={() => void handleOpen(d)} aria-label="열기"
                      className="p-1.5 rounded text-slate-400 hover:text-violet-600 hover:bg-slate-50">
                      <ExternalLink size={12} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => void handleDelete(d)} aria-label="삭제"
                      className="p-1.5 rounded text-slate-400 hover:text-rose-500 hover:bg-rose-50">
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </li>
                ))}
              </ul>
            </section>
          )}
        </>
      )}
    </div>
  );
}
