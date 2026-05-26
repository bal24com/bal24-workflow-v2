// bal24 v2 — STEP-CONSORTIUM-FORM-AI-AUTOFILL (박경수님 2026-05-27)
// 컨소시엄 등록 폼 — 자동채우기 섹션 (드롭존 + 안내 + 에러).

import ConsortiumDocDropzone from './ConsortiumDocDropzone';

interface Props {
  isAnalyzing: boolean;
  disabled: boolean;
  analyzeError: string | null;
  onFile: (file: File) => void;
  onClearError: () => void;
}

export default function ConsortiumAutoFillSection({
  isAnalyzing, disabled, analyzeError, onFile, onClearError,
}: Props) {
  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          📄 문서로 자동채우기 <span className="text-slate-400 font-normal normal-case">(선택)</span>
        </h3>
        <span className="text-[11px] text-slate-400">제안서·협약서·계획서 등 업로드</span>
      </div>
      <ConsortiumDocDropzone onFile={onFile} isAnalyzing={isAnalyzing} disabled={disabled} />
      {analyzeError && (
        <p className="text-xs text-rose-500" role="alert">
          {analyzeError}{' '}
          <button
            type="button"
            onClick={onClearError}
            className="underline text-slate-500 hover:text-slate-700 ml-1"
          >
            닫기
          </button>
        </p>
      )}
    </section>
  );
}
