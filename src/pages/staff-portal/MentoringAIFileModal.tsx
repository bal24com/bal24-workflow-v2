// bal24 v2 — STEP-PORTAL-MULTI-FIX PART F (박경수님 2026-05-26)
// 파일 업로드 → mentoring-log-ai Edge Function → 생성된 일지 본문 미리보기.

import { useRef, useState } from 'react';
import { Loader2, Upload, Sparkles, X, RotateCw } from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  open: boolean;
  onClose: () => void;
  /** AI 가 생성한 본문을 받아서 MentoringLogForm 에 prefill. */
  onApply: (content: string) => void;
  programName: string;
  mentorName: string;
  /** 멘티 이름들 (콤마 결합 후 전달). */
  menteeNames: string[];
  /** 회차 (기본 1). */
  sessionNo?: number | null;
}

type Step = 'upload' | 'generating' | 'preview';

export default function MentoringAIFileModal({
  open, onClose, onApply, programName, mentorName, menteeNames, sessionNo,
}: Props) {
  const toast = useToast();
  const [step, setStep] = useState<Step>('upload');
  const [file, setFile] = useState<File | null>(null);
  const [generated, setGenerated] = useState('');
  const [errMsg, setErrMsg] = useState<string | null>(null);
  const inputRef = useRef<HTMLInputElement | null>(null);

  if (!open) return null;

  function reset() {
    setStep('upload');
    setFile(null);
    setGenerated('');
    setErrMsg(null);
  }

  async function callAI(targetFile: File) {
    setStep('generating');
    setErrMsg(null);
    try {
      const fd = new FormData();
      fd.append('file', targetFile);
      fd.append('mentee_name', menteeNames.join(', '));
      fd.append('program_title', programName);
      fd.append('session_count', String(sessionNo ?? 1));
      const url = `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/mentoring-log-ai`;
      const res = await fetch(url, {
        method: 'POST',
        headers: {
          apikey: import.meta.env.VITE_SUPABASE_ANON_KEY,
          Authorization: `Bearer ${import.meta.env.VITE_SUPABASE_ANON_KEY}`,
        },
        body: fd,
      });
      const data = await res.json() as { content?: string; error?: string };
      if (!res.ok || !data.content) {
        setErrMsg(data.error ?? 'AI 생성에 실패했어요.');
        setStep('upload');
        return;
      }
      setGenerated(data.content);
      setStep('preview');
    } catch (err) {
      console.error('[MentoringAIFileModal] 호출 실패:', err);
      setErrMsg('네트워크 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      setStep('upload');
    }
  }

  function handleSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    setFile(f);
    void callAI(f);
  }

  function handleRetry() {
    if (file) void callAI(file);
  }

  function handleApply(useEditedContent: boolean) {
    if (!generated.trim()) return;
    onApply(generated);
    toast.success(useEditedContent ? 'AI 생성 내용을 일지에 적용했어요.' : '내용을 그대로 적용했어요.');
    reset();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true" onClick={() => { reset(); onClose(); }}>
      <div className="bg-white w-full max-w-lg rounded-2xl shadow-xl"
        onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-[#1E1B4B] inline-flex items-center gap-2">
            <Sparkles size={16} className="text-violet-500" aria-hidden="true" />
            파일로 일지 자동 생성
          </h3>
          <button type="button" onClick={() => { reset(); onClose(); }}
            className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100">
            <X size={14} />
          </button>
        </header>

        <div className="px-5 py-4">
          <p className="text-xs text-slate-500 mb-3">
            발표자료·메모·이미지를 올리면 AI 가 멘토링 일지 본문을 작성해요. (편집 후 적용 가능)
          </p>

          {step === 'upload' && (
            <div>
              <label className="block border-2 border-dashed border-violet-300 rounded-xl p-6 text-center cursor-pointer hover:border-violet-500 hover:bg-violet-50 transition-colors">
                <Upload size={20} className="mx-auto text-violet-500 mb-2" aria-hidden="true" />
                <p className="text-sm font-semibold text-violet-700">파일 선택</p>
                <p className="text-[11px] text-slate-400 mt-1">이미지(jpg·png) / 텍스트(.txt·.md) — 최대 10MB</p>
                <input ref={inputRef} type="file"
                  accept="image/*,application/pdf,text/plain,text/markdown,.txt,.md"
                  className="hidden" onChange={handleSelect} />
              </label>
              {errMsg && (
                <p className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-md px-2 py-1.5 mt-3">{errMsg}</p>
              )}
            </div>
          )}

          {step === 'generating' && (
            <div className="py-8 text-center">
              <Loader2 size={28} className="mx-auto animate-spin text-violet-500 mb-3" aria-hidden="true" />
              <p className="text-sm font-semibold text-violet-700">🤖 AI 가 일지를 작성 중이에요…</p>
              <p className="text-[11px] text-slate-400 mt-1">파일 크기에 따라 10~20초 소요</p>
            </div>
          )}

          {step === 'preview' && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1.5">AI 생성 결과 (편집 가능)</p>
              <textarea value={generated} onChange={(e) => setGenerated(e.target.value)}
                className="w-full min-h-[220px] rounded-md border border-violet-200 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-y" />
              <p className="text-[11px] text-slate-500 mt-1">
                <strong>{mentorName}</strong>님이 <strong>{programName}</strong> · {sessionNo ?? '?'}회차 멘토링 일지에 사용 예정.
              </p>
            </div>
          )}
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
          {step === 'preview' && (
            <>
              <button type="button" onClick={handleRetry}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-700 border border-slate-300 hover:bg-slate-50">
                <RotateCw size={11} aria-hidden="true" /> 다시 생성
              </button>
              <button type="button" onClick={() => handleApply(true)}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold text-white bg-violet-600 hover:bg-violet-700">
                일지에 적용
              </button>
            </>
          )}
          {step === 'upload' && (
            <button type="button" onClick={() => { reset(); onClose(); }}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100">
              취소
            </button>
          )}
        </footer>
      </div>
    </div>
  );
}
