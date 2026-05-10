// bal24 v2 — STEP-AUTOFILL 파일로 프로그램 일괄 생성 모달

import { useEffect, useRef, useState } from 'react';
import { Loader2, Sparkles, Trash2, Upload, FileIcon } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { extractBulkProgramsFromFile, type ExtractedProgram, type ExtractedProgramType } from '../../lib/programAutoFill';
import type { Project, ProgramType } from '../../types/database';

const ACCEPT = '.pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp';

function toLegacyType(pt?: ExtractedProgramType): ProgramType {
  if (pt === 'education') return '교육';
  if (pt === 'event') return '행사';
  return '기타';
}

interface DraftRow {
  id: string;
  selected: boolean;
  name: string;
  start_date: string;
  end_date: string;
  program_type: ExtractedProgramType;
  description: string;
}

function tempId(): string {
  return `bulk-${Math.random().toString(36).slice(2, 10)}`;
}

function toDraft(p: ExtractedProgram, idx: number): DraftRow {
  return {
    id: `${tempId()}-${idx}`,
    selected: true,
    name: p.name?.trim() || '',
    start_date: p.start_date ?? '',
    end_date: p.end_date ?? '',
    program_type: (p.program_type ?? 'education') as ExtractedProgramType,
    description: p.description ?? '',
  };
}

interface Props {
  open: boolean;
  defaultProjectId?: string;
  onClose: () => void;
  onSuccess: () => void;
}

export default function BulkProgramModal({ open, defaultProjectId, onClose, onSuccess }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [projectId, setProjectId] = useState<string>(defaultProjectId ?? '');
  const [projects, setProjects] = useState<Pick<Project, 'id' | 'name'>[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [dragActive, setDragActive] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    if (!open) return;
    setFile(null);
    setRows([]);
    setProjectId(defaultProjectId ?? '');
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase
        .from('projects').select('id, name').order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) console.error('[bulk-program] projects 조회 실패:', error.message);
      setProjects((data ?? []) as Pick<Project, 'id' | 'name'>[]);
    })();
    return () => { cancelled = true; };
  }, [open, defaultProjectId]);

  async function handleAnalyze() {
    if (!file) return;
    setAnalyzing(true);
    try {
      const list = await extractBulkProgramsFromFile(file);
      if (list.length === 0) {
        toast.error('문서에서 프로그램을 찾지 못했어요.');
        setRows([]);
      } else {
        setRows(list.map(toDraft));
        toast.success(`${list.length}개 프로그램을 추출했어요. 검토 후 등록해 주세요.`);
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[bulk-program] 분석 실패:', raw);
      toast.error('AI 분석에 실패했어요. 다른 파일로 시도해 주세요.');
    } finally {
      setAnalyzing(false);
    }
  }

  function patchRow(id: string, patch: Partial<DraftRow>) {
    setRows((prev) => prev.map((r) => (r.id === id ? { ...r, ...patch } : r)));
  }

  function removeRow(id: string) {
    setRows((prev) => prev.filter((r) => r.id !== id));
  }

  function toggleAll(checked: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  }

  async function handleBulkInsert() {
    const targets = rows.filter((r) => r.selected && r.name.trim());
    if (targets.length === 0) {
      toast.error('등록할 항목을 선택해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = targets.map((r) => ({
        project_id: projectId || null,
        name: r.name.trim(),
        type: toLegacyType(r.program_type),
        program_type: r.program_type,
        status: '준비',
        start_date: r.start_date || null,
        end_date: r.end_date || null,
        description: r.description.trim() || null,
      }));
      const { error } = await supabase.from('programs').insert(payload);
      if (error) throw error;
      toast.success(`${targets.length}개 프로그램이 등록됐어요.`);
      onSuccess();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[bulk-program] 일괄 등록 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('row-level security') || m.includes('permission denied')) {
        toast.error('프로그램 등록 권한이 없어요.');
      } else {
        toast.error('일괄 등록 중 오류가 발생했어요.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  const onDragOver = (e: React.DragEvent) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e: React.DragEvent) => { if (e.currentTarget === e.target) setDragActive(false); };
  const onDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f) setFile(f);
  };

  const selectedCount = rows.filter((r) => r.selected && r.name.trim()).length;
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="📁 파일로 프로그램 일괄 생성"
      description="PDF·DOCX·PPT 등 문서를 업로드하면 AI가 프로그램 목록을 추출해요."
      size="lg"
      closeOnBackdrop={!submitting && !analyzing}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {rows.length > 0 && <>선택 <strong className="text-violet-700">{selectedCount}</strong>개 / 전체 {rows.length}개</>}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={submitting || analyzing}>취소</Button>
            <Button
              variant="primary"
              onClick={() => void handleBulkInsert()}
              loading={submitting}
              disabled={selectedCount === 0 || analyzing}
            >
              {selectedCount > 0 ? `${selectedCount}개 일괄 등록하기` : '일괄 등록하기'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div
          onDragOver={onDragOver}
          onDragEnter={onDragOver}
          onDragLeave={onDragLeave}
          onDrop={onDrop}
          className={[
            'rounded-xl border-2 border-dashed p-4 text-center transition-colors',
            dragActive ? 'border-violet-400 bg-violet-50' : 'border-slate-200 bg-slate-50/40',
          ].join(' ')}
        >
          <Upload size={20} className="mx-auto text-slate-400 mb-1" aria-hidden="true" />
          <p className="text-xs text-slate-600">파일 드래그 또는 클릭 업로드 (PDF·DOCX·XLSX·이미지 지원)</p>
          <input ref={inputRef} type="file" accept={ACCEPT} hidden
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center justify-center gap-2 mt-2">
            <button type="button" onClick={() => inputRef.current?.click()}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50">
              <FileIcon size={12} aria-hidden="true" /> 파일 선택
            </button>
            <button type="button" onClick={() => void handleAnalyze()}
              disabled={!file || analyzing}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-40 disabled:cursor-not-allowed">
              {analyzing ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
              {analyzing ? '분석 중…' : 'AI 분석'}
            </button>
          </div>
          {file && <p className="text-[11px] text-slate-500 mt-2 truncate" title={file.name}>{file.name}</p>}
        </div>

        {rows.length > 0 && (
          <>
            <div className="flex items-center justify-between gap-2">
              <label className="inline-flex items-center gap-1.5 text-xs">
                <input type="checkbox" checked={allSelected} onChange={(e) => toggleAll(e.target.checked)}
                  className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-300" />
                <span className="font-semibold text-slate-700">전체 선택</span>
              </label>
              <div className="flex items-center gap-2">
                <label className="text-xs font-semibold text-slate-700">연결 프로젝트</label>
                <select value={projectId} onChange={(e) => setProjectId(e.target.value)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-violet-400">
                  <option value="">— 없음 —</option>
                  {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
                </select>
              </div>
            </div>

            <ul className="space-y-1.5 max-h-[420px] overflow-y-auto">
              {rows.map((r) => (
                <li key={r.id} className="grid grid-cols-[24px_minmax(0,2fr)_minmax(120px,140px)_minmax(120px,140px)_minmax(110px,130px)_28px] items-center gap-2 px-2 py-1.5 rounded-lg border border-slate-100 bg-white">
                  <input type="checkbox" checked={r.selected}
                    onChange={(e) => patchRow(r.id, { selected: e.target.checked })}
                    className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-300" />
                  <input type="text" value={r.name}
                    onChange={(e) => patchRow(r.id, { name: e.target.value })}
                    placeholder="프로그램명 (필수)"
                    className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs focus:outline-none focus:border-violet-400" />
                  <Input type="date" value={r.start_date}
                    onChange={(e) => patchRow(r.id, { start_date: e.target.value })} />
                  <Input type="date" value={r.end_date}
                    onChange={(e) => patchRow(r.id, { end_date: e.target.value })} />
                  <select value={r.program_type}
                    onChange={(e) => patchRow(r.id, { program_type: e.target.value as ExtractedProgramType })}
                    className="h-8 px-2 rounded-md border border-slate-200 bg-white text-xs focus:outline-none focus:border-violet-400">
                    <option value="education">교육</option>
                    <option value="mentoring">멘토링</option>
                    <option value="event">행사</option>
                    <option value="report">보고</option>
                  </select>
                  <button type="button" onClick={() => removeRow(r.id)}
                    aria-label="제거"
                    className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </li>
              ))}
            </ul>
          </>
        )}

        {rows.length === 0 && !analyzing && (
          <p className="text-xs text-slate-400 italic text-center py-4">
            파일을 업로드하고 [AI 분석]을 눌러 주세요.
          </p>
        )}
      </div>
    </Modal>
  );
}
