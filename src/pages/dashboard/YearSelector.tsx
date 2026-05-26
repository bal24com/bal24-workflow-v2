// 연도 선택 탭 — 박경수님 + SkyClaw STEP-FINANCE-DASHBOARD-UI (2026-05-27)
// 전체 + 올해 기준 최근 3년 버튼. null = 전체.

interface Props {
  selectedYear: number | null;
  onChange: (year: number | null) => void;
}

export default function YearSelector({ selectedYear, onChange }: Props) {
  const currentYear = new Date().getFullYear();
  const years = [currentYear - 2, currentYear - 1, currentYear];

  return (
    <div className="inline-flex items-center gap-1 rounded-lg border border-slate-200 bg-white p-0.5">
      <button type="button" onClick={() => onChange(null)}
        className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
          selectedYear === null ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
        }`}>전체</button>
      {years.map((y) => (
        <button key={y} type="button" onClick={() => onChange(y)}
          className={`px-3 py-1.5 rounded-md text-xs font-semibold transition-colors ${
            selectedYear === y ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'
          }`}>{y}년</button>
      ))}
    </div>
  );
}
