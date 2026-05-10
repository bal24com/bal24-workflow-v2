// bal24 v2 — 프로그램 설명(목표) textarea 입력 필드 (ProgramFormModal V-1 보호)

interface Props {
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}

export default function ProgramDescriptionField({ value, onChange, disabled }: Props) {
  return (
    <div className="space-y-1.5">
      <label htmlFor="program-desc" className="text-sm font-semibold text-slate-700">설명</label>
      <textarea
        id="program-desc"
        rows={3}
        value={value}
        onChange={(e) => onChange(e.target.value)}
        disabled={disabled}
        placeholder="프로그램 개요·목표·진행 방식 등"
        className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
      />
    </div>
  );
}
