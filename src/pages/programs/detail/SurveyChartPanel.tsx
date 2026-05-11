// bal24 v2 — STEP-SURVEY-ACCORDION-UI
// 만족도 문항 분포 차트 (recharts) — bar / horizontal / pie 3종

import {
  BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell,
  PieChart, Pie, Legend,
} from 'recharts';

export type ChartType = 'bar' | 'horizontal' | 'pie';

export interface DistributionPoint {
  score: number;       // 1~5
  count: number;
  label: string;       // "1점" 등
}

interface Props {
  data: DistributionPoint[];
  chartType: ChartType;
  height?: number;
}

const VIOLET_PALETTE = ['#DDD6FE', '#C4B5FD', '#A78BFA', '#8B5CF6', '#7C3AED'];

function colorOf(score: number): string {
  return VIOLET_PALETTE[Math.max(0, Math.min(4, score - 1))];
}

export default function SurveyChartPanel({ data, chartType, height = 200 }: Props) {
  if (data.length === 0 || data.every((d) => d.count === 0)) {
    return (
      <p className="text-xs text-slate-400 italic text-center py-6">시각화할 응답이 없어요.</p>
    );
  }

  if (chartType === 'pie') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <PieChart>
          <Pie data={data} dataKey="count" nameKey="label" cx="50%" cy="50%" outerRadius={Math.max(60, height / 2.5)} label>
            {data.map((d) => (<Cell key={d.score} fill={colorOf(d.score)} />))}
          </Pie>
          <Tooltip formatter={(v) => `${v}명`} />
          <Legend wrapperStyle={{ fontSize: '11px' }} />
        </PieChart>
      </ResponsiveContainer>
    );
  }

  if (chartType === 'horizontal') {
    return (
      <ResponsiveContainer width="100%" height={height}>
        <BarChart data={data} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
          <XAxis type="number" tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
          <YAxis type="category" dataKey="label" width={48} tick={{ fontSize: 10, fill: '#1E1B4B' }} />
          <Tooltip formatter={(v) => `${v}명`} />
          <Bar dataKey="count" radius={[0, 4, 4, 0]}>
            {data.map((d) => (<Cell key={d.score} fill={colorOf(d.score)} />))}
          </Bar>
        </BarChart>
      </ResponsiveContainer>
    );
  }

  // 기본: 세로 막대
  return (
    <ResponsiveContainer width="100%" height={height}>
      <BarChart data={data} margin={{ left: 8, right: 16, top: 8, bottom: 4 }}>
        <XAxis dataKey="label" tick={{ fontSize: 10, fill: '#1E1B4B' }} />
        <YAxis tick={{ fontSize: 10, fill: '#64748B' }} allowDecimals={false} />
        <Tooltip formatter={(v) => `${v}명`} />
        <Bar dataKey="count" radius={[4, 4, 0, 0]}>
          {data.map((d) => (<Cell key={d.score} fill={colorOf(d.score)} />))}
        </Bar>
      </BarChart>
    </ResponsiveContainer>
  );
}
