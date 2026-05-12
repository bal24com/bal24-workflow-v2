// bal24 v2 — 문서 업로드로 교육생 명단 AI 추출 + 체크박스 일괄 등록 모달

import { useRef, useState } from 'react';
import { Loader2, Sparkles, Paperclip, FileIcon } from 'lucide-react';
import { Modal, Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { callAi, callAiWithFile } from '../../../lib/aiClient';
import { fileToText, classifyFile } from '../../../lib/fileToText';
import {
  PARTICIPANT_ROLE_LABEL, PARTICIPANT_ROLE_VALUES,
} from '../../../lib/participantUtils';
import type { ParticipantRole } from '../../../types/database';

interface Props {
  open: boolean;
  programId: string;
  onSuccess: () => void;
  onClose: () => void;
}

interface ExtractedPerson {
  name: string;
  email?: string | null;
  phone?: string | null;
  org?: string | null;
}

interface DraftRow extends ExtractedPerson {
  selected: boolean;
}

const SYSTEM_PROMPT = `교육생·참여자 명단 문서에서 사람 목록을 JSON 배열로만 반환합니다.
각 항목. name(이름 필수), email, phone, org(소속).
없는 항목=null. JSON 배열만 반환. 최대 200명.`;

const ACCEPT = '.xlsx,.csv,.pdf,.png,.jpg,.jpeg,.docx,.txt';

function safeParse(raw: string): ExtractedPerson[] {
  const c = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try { const r = JSON.parse(c); return Array.isArray(r) ? (r as ExtractedPerson[]) : []; }
  catch { const i = c.indexOf('['); return i >= 0 ? safeParse(c.slice(i)) : []; }
}

export default function ParticipantDocImportModal({ open, programId, onSuccess, onClose }: Props) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [extracting, setExtracting] = useState(false);
  const [rows, setRows] = useState<DraftRow[]>([]);
  const [role, setRole] = useState<ParticipantRole>('participant');
  const [submitting, setSubmitting] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  function reset() {
    setFile(null);
    setRows([]);
    setRole('participant');
    setExtracting(false);
    setSubmitting(false);
  }

  async function handleExtract() {
    if (!file) return;
    setExtracting(true);
    try {
      const kind = classifyFile(file);
      let raw = '';
      // STEP-PARTICIPANT-PDF-FIX — PDF/이미지/unknown은 멀티모달, 그 외만 텍스트 추출
      if (kind !== 'unknown' && kind !== 'pdf' && kind !== 'image') {
        const doc = await fileToText(file);
        if (doc?.text) {
          const r = await callAi({
            preset: 'curriculum-extract',
            systemOverride: SYSTEM_PROMPT,
            messages: [{ role: 'user', content: doc.text.slice(0, 5000) }],
            maxTokens: 4096,
          });
          raw = r.ok ? (r.text ?? '') : '';
        }
      } else {
        const r = await callAiWithFile(file, '명단을 JSON 배열로 반환해 주세요.', 'curriculum-extract',
          { systemOverride: SYSTEM_PROMPT, maxTokens: 4096 });
        raw = r.ok ? (r.text ?? '') : '';
      }
      const persons = safeParse(raw).filter((p) => p.name?.trim());
      if (persons.length === 0) {
        toast.error('명단을 추출하지 못했어요. 다른 파일로 시도해 주세요.');
        setRows([]);
        return;
      }
      setRows(persons.map((p) => ({ ...p, selected: true })));
      toast.success(`${persons.length}명을 추출했어요. 검토 후 등록해 주세요.`);
    } catch (err) {
      // STEP-PARTICIPANT-PDF-FIX — 실제 원인 토스트로 노출 (silent fail 차단)
      const msg = err instanceof Error ? err.message : '알 수 없는 오류';
      console.error('[participant-doc-import] AI 추출 실패:', msg);
      toast.error(`명단 추출 실패: ${msg}`);
    } finally {
      setExtracting(false);
    }
  }

  function toggleAll(checked: boolean) {
    setRows((prev) => prev.map((r) => ({ ...r, selected: checked })));
  }

  function toggleRow(idx: number, checked: boolean) {
    setRows((prev) => prev.map((r, i) => (i === idx ? { ...r, selected: checked } : r)));
  }

  async function handleSubmit() {
    const selected = rows.filter((r) => r.selected && r.name.trim());
    if (selected.length === 0) {
      toast.error('등록할 항목을 선택해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const payload = selected.map((r) => ({
        program_id: programId,
        name: r.name.trim(),
        role,
        email: r.email ?? null,
        phone: r.phone ?? null,
        memo: r.org ?? null,
      }));
      const { error } = await supabase.from('program_participants').insert(payload);
      if (error) throw error;
      toast.success(`${payload.length}명이 등록됐어요.`);
      onSuccess();
      reset();
      onClose();
    } catch (err) {
      const r = err instanceof Error ? err.message : '';
      console.error('[participant-doc-import] 일괄 등록 실패:', r);
      toast.error('일괄 등록 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  }

  const selectedCount = rows.filter((r) => r.selected && r.name.trim()).length;
  const allSelected = rows.length > 0 && rows.every((r) => r.selected);

  return (
    <Modal
      open={open}
      onClose={() => { reset(); onClose(); }}
      title="📄 문서로 교육생 일괄 등록"
      description="엑셀·PDF·이미지·DOCX에서 AI가 명단을 자동 추출해 등록해요."
      size="lg"
      closeOnBackdrop={!submitting && !extracting}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          <span className="text-xs text-slate-500">
            {rows.length > 0 && <>선택 <strong className="text-violet-700">{selectedCount}</strong>명 / 전체 {rows.length}명</>}
          </span>
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={() => { reset(); onClose(); }} disabled={submitting || extracting}>취소</Button>
            <Button variant="primary" loading={submitting} disabled={selectedCount === 0 || extracting}
              onClick={() => void handleSubmit()}>
              {selectedCount > 0 ? `${selectedCount}명 등록하기` : '등록하기'}
            </Button>
          </div>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-violet-50 border border-violet-200 p-4 space-y-2">
          <input ref={inputRef} type="file" hidden accept={ACCEPT}
            onChange={(e) => setFile(e.target.files?.[0] ?? null)} />
          <div className="flex items-center gap-2">
            <button type="button" onClick={() => inputRef.current?.click()} disabled={extracting}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40">
              <Paperclip size={12} aria-hidden="true" /> 파일 선택
            </button>
            {file && <span className="text-[11px] text-violet-700 truncate max-w-[260px]" title={file.name}>{file.name}</span>}
            <button type="button" onClick={() => void handleExtract()} disabled={!file || extracting}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
              {extracting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
              {extracting ? '명단 추출 중…' : 'AI로 명단 읽기'}
            </button>
          </div>
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
                <label className="text-xs font-semibold text-slate-700">역할 일괄 지정</label>
                <select value={role} onChange={(e) => setRole(e.target.value as ParticipantRole)}
                  className="rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-xs focus:outline-none focus:border-violet-400">
                  {PARTICIPANT_ROLE_VALUES.map((r) => (<option key={r} value={r}>{PARTICIPANT_ROLE_LABEL[r]}</option>))}
                </select>
              </div>
            </div>

            <ul className="max-h-[420px] overflow-y-auto divide-y divide-slate-100 rounded-lg border border-slate-200 bg-white">
              {rows.map((r, idx) => (
                <li key={idx} className="grid grid-cols-[24px_minmax(0,1fr)_minmax(0,1.5fr)_minmax(0,1fr)_minmax(0,1fr)] items-center gap-2 px-3 py-2 text-xs">
                  <input type="checkbox" checked={r.selected} onChange={(e) => toggleRow(idx, e.target.checked)}
                    className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-300" />
                  <span className="font-bold text-slate-800 truncate">{r.name}</span>
                  <span className="text-slate-500 truncate">{r.email ?? '-'}</span>
                  <span className="text-slate-500 truncate">{r.phone ?? '-'}</span>
                  <span className="text-slate-400 truncate">{r.org ?? '-'}</span>
                </li>
              ))}
            </ul>
          </>
        )}

        {rows.length === 0 && !extracting && (
          <p className="text-xs text-slate-400 italic text-center py-4 inline-flex items-center justify-center gap-1 w-full">
            <FileIcon size={12} aria-hidden="true" /> 파일을 업로드하고 [AI로 명단 읽기]를 눌러 주세요.
          </p>
        )}
      </div>
    </Modal>
  );
}
