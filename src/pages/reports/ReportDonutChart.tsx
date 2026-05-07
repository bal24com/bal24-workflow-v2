// bal24 v2 — 계정과목별 지출 도넛 차트 (STEP 20, SVG 자체 구현)

import { useMemo } from 'react';
import { formatAmount, type AccountExpense } from './financialReportUtils';

interface Props {
  data: AccountExpense[];
  size?: number;
}

const PALETTE = ['#7C3AED', '#F97316', '#06B6D4', '#10B981', '#F59E0B', '#EF4444', '#A855F7', '#0EA5E9'];

export default function ReportDonutChart({ data, size = 220 }: Props) {
  const total = useMemo(() => data.reduce((s, d) => s + d.amount, 0), [data]);
  const radius = size / 2 - 16;
  const center = size / 2;
  const strokeWidth = 28;

  // 각 segment 의 누적 비율 계산
  const segments = useMemo(() => {
    if (total === 0) return [];
    let cumulative = 0;
    return data.map((d, idx) => {
      const ratio = d.amount / total;
      const startAngle = cumulative * 360 - 90;
      cumulative += ratio;
      const endAngle = cumulative * 360 - 90;
      return { ...d, ratio, startAngle, endAngle, color: PALETTE[idx % PALETTE.length] };
    });
  }, [data, total]);

  function arcPath(startAngle: number, endAngle: number): string {
    const start = polar(center, center, radius, endAngle);
    const end = polar(center, center, radius, startAngle);
    const largeArcFlag = endAngle - startAngle <= 180 ? '0' : '1';
    return `M ${start.x} ${start.y} A ${radius} ${radius} 0 ${largeArcFlag} 0 ${end.x} ${end.y}`;
  }

  function polar(cx: number, cy: number, r: number, angleDeg: number): { x: number; y: number } {
    const angleRad = (angleDeg * Math.PI) / 180;
    return { x: cx + r * Math.cos(angleRad), y: cy + r * Math.sin(angleRad) };
  }

  if (total === 0) {
    return (
      <div className="flex flex-col items-center gap-3">
        <div
          className="flex items-center justify-center rounded-full bg-slate-50 text-sm text-slate-400"
          style={{ width: size, height: size }}
        >
          데이터 없음
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col sm:flex-row items-center gap-6">
      <div className="relative shrink-0" style={{ width: size, height: size }}>
        <svg
          role="img"
          aria-label="계정과목별 지출 도넛 차트"
          viewBox={`0 0 ${size} ${size}`}
          width={size}
          height={size}
        >
          {segments.length === 1 ? (
            <circle
              cx={center}
              cy={center}
              r={radius}
              fill="none"
              stroke={segments[0].color}
              strokeWidth={strokeWidth}
            />
          ) : (
            segments.map((s) => (
              <path
                key={s.accountCode}
                d={arcPath(s.startAngle, s.endAngle)}
                fill="none"
                stroke={s.color}
                strokeWidth={strokeWidth}
                strokeLinecap="butt"
              >
                <title>{`${s.label} — ${formatAmount(s.amount)} (${s.ratio.toFixed(1)}%)`}</title>
              </path>
            ))
          )}
        </svg>
        <div className="pointer-events-none absolute inset-0 flex flex-col items-center justify-center">
          <span className="text-[11px] font-semibold text-slate-500">총 지출</span>
          <span className="text-base font-bold text-[#1E1B4B]">{formatAmount(total)}</span>
        </div>
      </div>

      <ul className="flex-1 min-w-0 space-y-1.5 text-sm w-full">
        {segments.map((s) => (
          <li key={s.accountCode} className="flex items-center gap-2">
            <span
              aria-hidden="true"
              className="h-3 w-3 shrink-0 rounded-sm"
              style={{ backgroundColor: s.color }}
            />
            <span className="flex-1 truncate text-slate-700">{s.label}</span>
            <span className="text-xs text-slate-500 tabular-nums shrink-0">
              {formatAmount(s.amount)} · {s.ratio.toFixed(1)}%
            </span>
          </li>
        ))}
      </ul>
    </div>
  );
}
