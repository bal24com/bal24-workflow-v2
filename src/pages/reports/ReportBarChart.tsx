// bal24 v2 — 월별 수입·지출 막대 차트 (STEP 20, SVG 자체 구현)

import { useMemo } from 'react';
import { formatAmount, formatAmountShort, type MonthlyData } from './financialReportUtils';

interface Props {
  data: MonthlyData[];
  height?: number;
}

const COLOR_INCOME = '#7C3AED';
const COLOR_EXPENSE = '#F97316';
const PADDING_TOP = 24;
const PADDING_BOTTOM = 28;
const PADDING_LEFT = 56;
const PADDING_RIGHT = 12;
const BAR_GAP = 4;

export default function ReportBarChart({ data, height = 240 }: Props) {
  const maxVal = useMemo(
    () => Math.max(1, ...data.map((d) => Math.max(d.income, d.expense))),
    [data],
  );

  const chartHeight = height - PADDING_TOP - PADDING_BOTTOM;
  const tickValues = useMemo(() => {
    const step = Math.ceil(maxVal / 4);
    return Array.from({ length: 5 }, (_, i) => step * i);
  }, [maxVal]);

  const isAllZero = data.every((d) => d.income === 0 && d.expense === 0);

  return (
    <div className="w-full">
      <div className="mb-2 flex items-center gap-3 text-xs">
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_INCOME }} aria-hidden="true" />
          수입
        </span>
        <span className="inline-flex items-center gap-1.5 text-slate-600">
          <span className="h-2.5 w-2.5 rounded-sm" style={{ backgroundColor: COLOR_EXPENSE }} aria-hidden="true" />
          지출
        </span>
      </div>

      {isAllZero ? (
        <div className="flex h-[240px] items-center justify-center rounded-xl bg-slate-50 text-sm text-slate-400">
          이 연도에 등록된 수입·지출이 없어요.
        </div>
      ) : (
        <svg
          role="img"
          aria-label="월별 수입·지출 막대 차트"
          viewBox={`0 0 720 ${height}`}
          width="100%"
          height={height}
          className="overflow-visible"
        >
          {/* Y축 그리드 + 라벨 */}
          {tickValues.map((tick, i) => {
            const y = PADDING_TOP + chartHeight - (tick / maxVal) * chartHeight;
            return (
              <g key={`tick-${i}`}>
                <line
                  x1={PADDING_LEFT}
                  x2={720 - PADDING_RIGHT}
                  y1={y}
                  y2={y}
                  stroke="#E2E8F0"
                  strokeDasharray={i === 0 ? undefined : '2 4'}
                />
                <text
                  x={PADDING_LEFT - 6}
                  y={y + 4}
                  fontSize="10"
                  fill="#94A3B8"
                  textAnchor="end"
                >
                  {tick === 0 ? '0' : formatAmountShort(tick)}
                </text>
              </g>
            );
          })}

          {/* 막대 */}
          {data.map((d, i) => {
            const cellWidth = (720 - PADDING_LEFT - PADDING_RIGHT) / 12;
            const cellX = PADDING_LEFT + i * cellWidth;
            const barWidth = (cellWidth - BAR_GAP * 3) / 2;
            const incomeH = (d.income / maxVal) * chartHeight;
            const expenseH = (d.expense / maxVal) * chartHeight;
            const incomeY = PADDING_TOP + chartHeight - incomeH;
            const expenseY = PADDING_TOP + chartHeight - expenseH;
            const month = i + 1;

            return (
              <g key={d.month}>
                {d.income > 0 && (
                  <g>
                    <rect
                      x={cellX + BAR_GAP}
                      y={incomeY}
                      width={barWidth}
                      height={incomeH}
                      rx={3}
                      fill={COLOR_INCOME}
                      opacity="0.9"
                    >
                      <title>{`${month}월 수입 — ${formatAmount(d.income)}`}</title>
                    </rect>
                  </g>
                )}
                {d.expense > 0 && (
                  <g>
                    <rect
                      x={cellX + BAR_GAP * 2 + barWidth}
                      y={expenseY}
                      width={barWidth}
                      height={expenseH}
                      rx={3}
                      fill={COLOR_EXPENSE}
                      opacity="0.9"
                    >
                      <title>{`${month}월 지출 — ${formatAmount(d.expense)}`}</title>
                    </rect>
                  </g>
                )}
                <text
                  x={cellX + cellWidth / 2}
                  y={height - 8}
                  fontSize="10"
                  fill="#64748B"
                  textAnchor="middle"
                >
                  {month}월
                </text>
              </g>
            );
          })}
        </svg>
      )}
    </div>
  );
}
