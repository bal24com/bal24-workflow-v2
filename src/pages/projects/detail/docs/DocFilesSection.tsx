// bal24 v2 — 프로젝트 문서 단계별 파일 슬롯 (영업·운영·정산)

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Upload, FileIcon, ExternalLink, Trash2 } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { sanitizeFileName } from '../../../../components/files/sharedFilesUtils';
import SharedFilesTab from '../../../../components/files/SharedFilesTab';
import { formatDateKo } from '../../../../lib/utils';
import type { ProjectDocument, ProjectDocStage } from '../../../../types/database';

interface Props {
  projectId: string;
}

interface SlotDef {
  category: string;
  label: string;
  stage: ProjectDocStage;
}

const STAGES: { stage: ProjectDocStage; label: string; slots: SlotDef[] }[] = [
  { stage: 'sales', label: '영업 단계', slots: [
    { category: 'estimate',      label: '견적서',     stage: 'sales' },
    { category: 'operation_plan', label: '운영안',     stage: 'sales' },
  ]},
  { stage: 'active', label: '운영 단계', slots: [
    { category: 'kickoff_report', label: '착수보고서', stage: 'active' },
    { category: 'interim_report', label: '중간보고서', stage: 'active' },
  ]},
  { stage: 'wrap', label: '정산 단계', slots: [
    { category: 'delivery_confirm', label: '납품확인서', stage: 'wrap' },
    { category: 'settlement_report', label: '정산보고서', stage: 'wrap' },
  ]},
];

const ACCEPT = '.pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx';
const BUCKET = 'project-docs';

function fileSizeLabel(bytes?: number | null): string {
  if (bytes == null || bytes < 0) return '';
  if (bytes < 1024) return `${bytes} B`;
  if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
  return `${(bytes / (1024 * 1024)).toFixed(1)} MB`;
}

export default function DocFilesSection({ projectId }: Props) {
  const toast = useToast();
  const [docs, setDocs] = useState<ProjectDocument[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploadingSlot, setUploadingSlot] = useState<string | null>(null);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('project_documents').select('*')
      .eq('project_id', projectId)
      .is('deleted_at', null)
      .in('doc_type', ['estimate', 'operation_plan', 'other'])
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[doc-files] 조회 실패:', error.message);
      toast.error('문서 목록을 불러오지 못했어요.');
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

  async function handleUpload(slot: SlotDef, file: File) {
    setUploadingSlot(slot.category);
    try {
      const safe = sanitizeFileName(file.name);
      const path = `${projectId}/${slot.stage}/${slot.category}_${Date.now()}_${safe}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (up.error) throw up.error;
      const docType = slot.category === 'estimate' ? 'estimate'
        : slot.category === 'operation_plan' ? 'operation_plan' : 'other';
      const { error: insErr } = await supabase.from('project_documents').insert({
        project_id: projectId,
        doc_type: docType,
        doc_stage: slot.stage,
        file_name: safe,
        file_url: path,
        file_size: file.size,
        category: slot.category,
      });
      if (insErr) throw insErr;
      await reload();
      toast.success(`${slot.label} 업로드 완료.`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[doc-files] 업로드 실패:', raw);
      toast.error('업로드에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setUploadingSlot(null);
    }
  }

  async function handleOpen(doc: ProjectDocument) {
    const { data, error } = await supabase.storage.from(BUCKET).createSignedUrl(doc.file_url, 3600);
    if (error || !data) {
      console.error('[doc-files] signed URL 실패:', error?.message);
      toast.error('파일 열기 권한이 없어요.');
      return;
    }
    window.open(data.signedUrl, '_blank', 'noopener,noreferrer');
  }

  async function handleDelete(doc: ProjectDocument) {
    if (!window.confirm(`"${doc.file_name}" 파일을 삭제할까요?`)) return;
    const { error } = await supabase.from('project_documents')
      .update({ deleted_at: new Date().toISOString() }).eq('id', doc.id);
    if (error) {
      console.error('[doc-files] 삭제 실패:', error.message);
      toast.error('삭제에 실패했어요.');
      return;
    }
    await reload();
    toast.success('삭제됐어요.');
  }

  return (
    <div className="space-y-5">
      {loading ? (
        <div className="flex items-center justify-center py-8 text-sm text-muted">
          <Loader2 size={16} className="animate-spin mr-2" /> 불러오는 중…
        </div>
      ) : (
        <>
          {STAGES.map((sg) => (
            <section key={sg.stage} className="space-y-2">
              <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">{sg.label}</h3>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {sg.slots.map((slot) => (
                  <SlotCard key={slot.category} slot={slot}
                    docs={docs.filter((d) => d.category === slot.category)}
                    uploading={uploadingSlot === slot.category}
                    onUpload={(f) => void handleUpload(slot, f)}
                    onOpen={(d) => void handleOpen(d)}
                    onDelete={(d) => void handleDelete(d)} />
                ))}
              </div>
            </section>
          ))}
          <section className="space-y-2 pt-2 border-t border-slate-100">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">기타 첨부</h3>
            <SharedFilesTab bucket="project-files" fkColumn="project_id" fkValue={projectId} />
          </section>
        </>
      )}
    </div>
  );
}

interface SlotCardProps {
  slot: SlotDef;
  docs: ProjectDocument[];
  uploading: boolean;
  onUpload: (file: File) => void;
  onOpen: (doc: ProjectDocument) => void;
  onDelete: (doc: ProjectDocument) => void;
}

function SlotCard({ slot, docs, uploading, onUpload, onOpen, onDelete }: SlotCardProps) {
  const ref = useRef<HTMLInputElement | null>(null);
  return (
    <div className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-sm font-bold text-slate-800">{slot.label}</p>
        <input ref={ref} type="file" hidden accept={ACCEPT}
          onChange={(e) => { const f = e.target.files?.[0]; if (f) { onUpload(f); e.target.value = ''; } }} />
        <button type="button" onClick={() => ref.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1 px-2 py-1 rounded-lg border border-violet-200 bg-white text-[11px] font-semibold text-violet-700 hover:bg-violet-50 disabled:opacity-40">
          {uploading ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <Upload size={11} aria-hidden="true" />}
          {uploading ? '업로드 중…' : '파일 업로드'}
        </button>
      </div>
      {docs.length === 0 ? (
        <p className="text-[11px] text-slate-400 italic">파일이 없어요.</p>
      ) : (
        <ul className="space-y-1.5">
          {docs.map((d) => (
            <li key={d.id} className="flex items-center gap-2 px-2 py-1.5 rounded-lg bg-slate-50">
              <FileIcon size={12} className="text-violet-500 shrink-0" aria-hidden="true" />
              <div className="flex-1 min-w-0">
                <div className="text-xs font-semibold text-slate-700 truncate">{d.file_name}</div>
                <div className="text-[10px] text-slate-400">{fileSizeLabel(d.file_size)} · {formatDateKo(d.created_at)}</div>
              </div>
              <button type="button" onClick={() => onOpen(d)} aria-label="열기"
                className="p-1 rounded text-slate-400 hover:text-violet-600 hover:bg-white">
                <ExternalLink size={11} aria-hidden="true" />
              </button>
              <button type="button" onClick={() => onDelete(d)} aria-label="삭제"
                className="p-1 rounded text-slate-400 hover:text-rose-500 hover:bg-white">
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
