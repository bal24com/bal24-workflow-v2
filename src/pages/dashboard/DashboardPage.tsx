// bal24 v2 — 대시보드 메인
// 1단 KPI 4개 / 2단 미완료 태스크 / 3단 오늘 할일 / 4단 간트차트

import {
  Briefcase,
  ListChecks,
  AlertTriangle,
  Wallet,
  ArrowUp,
  ArrowDown,
  Minus,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';

type Trend = 'up' | 'down' | 'flat';

type Kpi = {
  label: string;
  value: number;
  unit?: string;
  diff: number;
  trend: Trend;
  Icon: LucideIcon;
  tone: 'primary' | 'accent' | 'danger' | 'secondary';
};

const KPIS: Kpi[] = [
  { label: '운영 프로젝트', value: 0, diff: 0, trend: 'flat', Icon: Briefcase,     tone: 'primary'   },
  { label: '진행 태스크',   value: 0, diff: 0, trend: 'flat', Icon: ListChecks,    tone: 'accent'    },
  { label: '기한초과',      value: 0, diff: 0, trend: 'flat', Icon: AlertTriangle, tone: 'danger'    },
  { label: '이번달 정산',   value: 0, unit: '원', diff: 0, trend: 'flat', Icon: Wallet, tone: 'secondary' },
];

const TONE_BG: Record<Kpi['tone'], string> = {
  primary:   'bg-primary/10 text-primary',
  accent:    'bg-accent/10 text-accent',
  danger:    'bg-danger/10 text-danger',
  secondary: 'bg-secondary/10 text-secondary',
};

function TrendBadge({ trend, diff }: { trend: Trend; diff: number }) {
  if (trend === 'flat') {
    return (
      <span className="inline-flex items-center gap-0.5 text-xs text-slate-400">
        <Minus size={12} />
        전주 대비 0
      </span>
    );
  }
  const isUp = trend === 'up';
  const Icon = isUp ? ArrowUp : ArrowDown;
  const color = isUp ? 'text-success' : 'text-danger';
  return (
    <span className={`inline-flex items-center gap-0.5 text-xs font-semibold ${color}`}>
      <Icon size={12} />
      전주 대비 {Math.abs(diff)}
    </span>
  );
}

function KpiCard({ kpi }: { kpi: Kpi }) {
  const { label, value, unit, diff, trend, Icon, tone } = kpi;
  return (
    <div className="v2-card p-5 flex flex-col gap-3">
      <div className="flex items-center justify-between">
        <span className="text-sm text-muted">{label}</span>
        <span className={`inline-flex items-center justify-center w-9 h-9 rounded-lg ${TONE_BG[tone]}`}>
          <Icon size={18} />
        </span>
      </div>
      <div className="flex items-baseline gap-1">
        <span className="text-3xl font-bold text-text">{value.toLocaleString()}</span>
        {unit && <span className="text-sm text-muted">{unit}</span>}
      </div>
      <TrendBadge trend={trend} diff={diff} />
    </div>
  );
}

function SectionCard({
  title,
  desc,
  children,
}: {
  title: string;
  desc?: string;
  children: React.ReactNode;
}) {
  return (
    <section className="v2-card p-5 flex flex-col gap-4">
      <header>
        <h2 className="text-base font-bold text-text">{title}</h2>
        {desc && <p className="text-xs text-muted mt-0.5">{desc}</p>}
      </header>
      {children}
    </section>
  );
}

function EmptyState({ message }: { message: string }) {
  return (
    <div className="flex flex-col items-center justify-center py-10 text-center">
      <div className="w-12 h-12 rounded-full bg-slate-100 flex items-center justify-center text-slate-400 text-xl mb-2">
        📭
      </div>
      <p className="text-sm text-muted">{message}</p>
    </div>
  );
}

function GanttPlaceholder() {
  return (
    <div className="border border-dashed border-slate-200 rounded-btn p-6 text-center bg-slate-50/50">
      <div className="text-2xl mb-2">📊</div>
      <p className="text-sm text-muted">간트차트는 데이터가 쌓이면 여기에 표시돼요.</p>
    </div>
  );
}

export default function DashboardPage() {
  return (
    <div className="space-y-6 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🏠</span>
        홈
      </h1>
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4">
        {KPIS.map((kpi) => (
          <KpiCard key={kpi.label} kpi={kpi} />
        ))}
      </div>

      <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
        <SectionCard title="미완료 태스크" desc="아직 처리되지 않은 모든 태스크">
          <EmptyState message="미완료 태스크가 없어요." />
        </SectionCard>

        <SectionCard title="오늘 내 할일" desc="D-day 가까운 순">
          <EmptyState message="오늘 할 일이 없어요." />
        </SectionCard>
      </div>

      <SectionCard title="간트차트" desc="프로젝트 일정 한눈에 보기">
        <GanttPlaceholder />
      </SectionCard>
    </div>
  );
}
