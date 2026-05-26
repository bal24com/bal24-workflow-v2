// bal24 v2 — MentoringTab 헤더 통계 카드 (V-1 분리용).

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'violet' | 'emerald' | 'slate' | 'orange';
}

const COLOR_MAP: Record<StatCardProps['color'], string> = {
  violet:  'bg-violet-50 text-violet-700 border-violet-100',
  emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
  slate:   'bg-slate-50 text-slate-700 border-slate-100',
  orange:  'bg-orange-50 text-orange-700 border-orange-100',
};

export default function MentoringStatCard({ icon, label, value, color }: StatCardProps) {
  return (
    <div className={`rounded-2xl border p-3 ${COLOR_MAP[color]}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-80">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
