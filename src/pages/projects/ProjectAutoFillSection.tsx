// bal24 v2 — STEP-AI-DOC-FEATURES 프로젝트 폼 상단 자동채우기 섹션 (드롭존 + 컨소시엄 미리보기)

import { useRef, useState } from 'react';
import { Loader2, Sparkles, Paperclip, Trash2 } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import {
  extractProjectFromDoc, countFilledFields,
  type ProjectAutoFillResult, type ProjectAutoFillMember,
} from '../../lib/projectAutoFill';

interface Props {
  onApply: (result: ProjectAutoFillResult) => void;
  members: ProjectAutoFillMember[];
  setMembers: (next: ProjectAutoFillMember[]) => void;
  autoConsortium: boolean;
  setAutoConsortium: (v: boolean) => void;
  disabled?: boolean;
}

const ACCEPT = '.pdf,.docx,.xlsx,.csv,.txt,.png,.jpg,.jpeg,.webp';

export default function ProjectAutoFillSection({
  onApply, members, setMembers, autoConsortium, setAutoConsortium, disabled,
}: Props) {
  const toast = useToast();
  const [file, setFile] = useState<File | null>(null);
  const [running, setRunning] = useState(false);
  const inputRef = useRef<HTMLInputElement | null>(null);

  async function handleRun() {
    if (!file) return;
    setRunning(true);
    try {
      const result = await extractProjectFromDoc(file);
      const count = countFilledFields(result);
      onApply(result);
      if (count === 0) toast.error('자동채우기에 실패했어요. 직접 입력해 주세요.');
      else if (result.consortium_members.length > 0) {
        toast.success(`${count}개 항목과 참여기관 ${result.consortium_members.length}곳을 추출했어요.`);
      } else {
        toast.success(`${count}개 항목을 자동으로 채웠어요.`);
      }
    } finally {
      setRunning(false);
    }
  }

  function patchMember(idx: number, patch: Partial<ProjectAutoFillMember>) {
    setMembers(members.map((m, i) => (i === idx ? { ...m, ...patch } : m)));
  }

  function removeMember(idx: number) {
    setMembers(members.filter((_, i) => i !== idx));
  }

  return (
    <section className="rounded-xl bg-violet-50 border border-violet-200 p-4 space-y-3">
      <header>
        <p className="text-sm font-bold text-violet-800 inline-flex items-center gap-1">
          <Sparkles size={14} aria-hidden="true" />
          📄 문서로 자동채우기 (선택)
        </p>
        <p className="text-[11px] text-violet-700/80 mt-0.5">
          과업지시서·제안서·공정표 PDF/Word/이미지 업로드 → AI가 폼 자동 입력해요.
        </p>
      </header>

      <div className="flex flex-wrap items-center gap-2">
        <input ref={inputRef} type="file" accept={ACCEPT} hidden
          onChange={(e) => setFile(e.target.files?.[0] ?? null)} disabled={disabled || running} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={disabled || running}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-40">
          <Paperclip size={12} aria-hidden="true" /> 파일 선택
        </button>
        {file && <span className="text-[11px] text-violet-700 truncate max-w-[260px]" title={file.name}>{file.name}</span>}
        <button type="button" onClick={() => void handleRun()} disabled={!file || disabled || running}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
          {running ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Sparkles size={12} aria-hidden="true" />}
          {running ? '추출 중…' : 'AI 자동채우기'}
        </button>
      </div>

      {members.length > 0 && (
        <div className="rounded-lg border border-violet-200 bg-white overflow-hidden">
          <div className="bg-violet-100 px-3 py-1.5 flex items-center justify-between">
            <span className="text-[11px] font-bold text-violet-800">
              🤝 컨소시엄 자동 감지 ({members.length}곳)
            </span>
            <label className="inline-flex items-center gap-1.5 text-[11px] text-violet-700 cursor-pointer">
              <input type="checkbox" checked={autoConsortium}
                onChange={(e) => setAutoConsortium(e.target.checked)} disabled={disabled || running}
                className="w-3.5 h-3.5 rounded border-violet-300 text-violet-600 focus:ring-violet-300" />
              저장 시 컨소시엄 자동 생성
            </label>
          </div>
          <ul className="divide-y divide-violet-100">
            {members.map((m, idx) => (
              <li key={idx} className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)_24px] items-center gap-2 px-3 py-1.5 text-xs">
                <input type="text" value={m.org_name}
                  onChange={(e) => patchMember(idx, { org_name: e.target.value })}
                  placeholder="기관명"
                  className="rounded border border-slate-200 px-2 py-1 font-semibold focus:outline-none focus:border-violet-400" />
                <input type="text" value={m.responsibilities}
                  onChange={(e) => patchMember(idx, { responsibilities: e.target.value })}
                  placeholder="담당 역할"
                  className="rounded border border-slate-200 px-2 py-1 text-slate-600 focus:outline-none focus:border-violet-400" />
                <button type="button" onClick={() => removeMember(idx)} aria-label="삭제"
                  className="p-1 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                  <Trash2 size={11} aria-hidden="true" />
                </button>
              </li>
            ))}
          </ul>
        </div>
      )}
    </section>
  );
}
