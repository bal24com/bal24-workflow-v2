// bal24 v2 — AI 빠른 프롬프트 템플릿 (STEP 21)
// 가로 스크롤 칩 — 클릭 시 입력창 채움

import { PROMPT_TEMPLATES } from './aiUtils';

interface Props {
  onSelect: (text: string) => void;
  disabled?: boolean;
}

export default function AiPromptTemplates({ onSelect, disabled }: Props) {
  return (
    <div className="flex gap-1.5 overflow-x-auto pb-1 -mx-1 px-1 scrollbar-thin">
      {PROMPT_TEMPLATES.map((t) => (
        <button
          key={t.label}
          type="button"
          onClick={() => onSelect(t.text)}
          disabled={disabled}
          className="shrink-0 rounded-full bg-violet-50 border border-violet-200 px-3 py-1 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:hover:bg-violet-50 transition-colors"
        >
          {t.label}
        </button>
      ))}
    </div>
  );
}
