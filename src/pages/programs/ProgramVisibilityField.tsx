// bal24 v2 — 프로그램 가시성(visibility) 단일 select 묶음

export type ProgramVisibility = 'private' | 'internal' | 'public';

const VISIBILITY_OPTIONS: { value: ProgramVisibility; label: string; desc: string }[] = [
  { value: 'internal', label: '팀 내부 공개', desc: '로그인한 팀원 전체가 조회 가능' },
  { value: 'private',  label: '배정자 한정',  desc: '배정된 담당자·강사·멘토만 조회 가능' },
  { value: 'public',   label: '외부 공개',    desc: '외부 링크로도 접근 가능' },
];

interface Props {
  value: ProgramVisibility;
  onChange: (v: ProgramVisibility) => void;
  disabled?: boolean;
}

export default function ProgramVisibilityField({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="program-visibility" className="text-sm font-semibold text-slate-700">
        가시성 <span className="text-xs font-normal text-slate-400">— 누구에게 노출할지 선택</span>
      </label>
      <select
        id="program-visibility"
        value={value}
        onChange={(e) => onChange(e.target.value as ProgramVisibility)}
        disabled={disabled}
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
      >
        {VISIBILITY_OPTIONS.map((o) => (
          <option key={o.value} value={o.value}>{o.label} — {o.desc}</option>
        ))}
      </select>
    </div>
  );
}
