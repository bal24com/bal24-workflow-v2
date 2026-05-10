// bal24 v2 — STEP-PROGRAM-CREATION-WIZARD 프로그램 유형 14종 그리드 (ProgramFormModal 분리)

import { PROGRAM_TYPE_CONFIG, getProgramTypeConfig } from './programTypeConfig';
import type { ExtendedProgramType } from './programTypeConfig';

interface Props {
  value: ExtendedProgramType;
  onChange: (v: ExtendedProgramType) => void;
  disabled?: boolean;
}

export default function ProgramTypeSelector({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">
        유형 <span className="text-xs font-normal text-slate-400">— {getProgramTypeConfig(value).description}</span>
      </label>
      <div className="grid grid-cols-2 sm:grid-cols-3 gap-1.5">
        {PROGRAM_TYPE_CONFIG.map((c) => {
          const active = value === c.type;
          return (
            <button
              key={c.type}
              type="button"
              onClick={() => onChange(c.type)}
              disabled={disabled}
              className={`inline-flex items-center gap-1.5 px-3 py-2 rounded-xl border text-xs font-semibold transition-colors disabled:opacity-50 ${
                active
                  ? 'bg-violet-600 text-white border-violet-600 shadow-sm'
                  : `${c.color} text-slate-700 hover:opacity-80`
              }`}
            >
              <span aria-hidden="true">{c.emoji}</span>
              <span className="truncate">{c.label}</span>
            </button>
          );
        })}
      </div>
    </div>
  );
}
