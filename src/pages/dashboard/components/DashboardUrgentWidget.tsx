// bal24 v2 — 대시보드 긴급 처리 위젯 (멘토링 일지 승인 대기·반려 미수정 카운트)
// PageHelpBanner 다음, KPI 위에 노출. 0건이면 위젯 자체를 숨김 (alarm fatigue 방지).

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { AlertCircle, ArrowRight, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';

interface UrgentCounts {
  submittedCount: number;   // 승인 대기 멘토링 일지
  rejectedCount: number;    // 반려 후 미수정 멘토링 일지
}

async function fetchUrgentCounts(): Promise<UrgentCounts> {
  const [submittedRes, rejectedRes] = await Promise.all([
    supabase
      .from('mentoring_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'submitted'),
    supabase
      .from('mentoring_logs')
      .select('id', { count: 'exact', head: true })
      .eq('status', 'rejected'),
  ]);

  // PGRST205 (테이블 없음) · 그 외 에러도 0 처리 (위젯이 대시보드 전체를 깨면 안 됨)
  const submittedCount = submittedRes.error ? 0 : submittedRes.count ?? 0;
  const rejectedCount = rejectedRes.error ? 0 : rejectedRes.count ?? 0;

  if (submittedRes.error) {
    console.warn('[dashboard-urgent] submitted 조회 실패:', submittedRes.error.message);
  }
  if (rejectedRes.error) {
    console.warn('[dashboard-urgent] rejected 조회 실패:', rejectedRes.error.message);
  }

  return { submittedCount, rejectedCount };
}

interface UrgentRowProps {
  label: string;
  count: number;
  to: string;
  tone: 'amber' | 'rose';
}

function UrgentRow({ label, count, to, tone }: UrgentRowProps) {
  const toneClass =
    tone === 'amber'
      ? 'text-amber-700 hover:bg-amber-100/60'
      : 'text-rose-700 hover:bg-rose-100/60';
  const chipClass =
    tone === 'amber'
      ? 'bg-amber-500 text-white'
      : 'bg-rose-500 text-white';
  return (
    <Link
      to={to}
      className={`flex items-center justify-between rounded-xl px-3 py-2 transition-colors ${toneClass}`}
    >
      <span className="flex items-center gap-2 text-sm font-semibold">
        <span className={`inline-flex h-6 min-w-[24px] px-1.5 items-center justify-center rounded-full text-xs font-bold ${chipClass}`}>
          {count}
        </span>
        {label}
      </span>
      <span className="inline-flex items-center gap-0.5 text-xs">
        보기
        <ArrowRight size={12} aria-hidden="true" />
      </span>
    </Link>
  );
}

export default function DashboardUrgentWidget() {
  const [counts, setCounts] = useState<UrgentCounts | null>(null);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      try {
        const c = await fetchUrgentCounts();
        if (!cancelled) setCounts(c);
      } catch (err) {
        const raw = err instanceof Error ? err.message : '';
        console.warn('[dashboard-urgent] 카운트 조회 실패:', raw);
        if (!cancelled) setCounts({ submittedCount: 0, rejectedCount: 0 });
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => { cancelled = true; };
  }, []);

  if (loading) {
    return (
      <div
        className="rounded-2xl border border-amber-100 bg-amber-50/40 p-4 flex items-center gap-2"
        aria-hidden="true"
      >
        <Loader2 className="animate-spin text-amber-500" size={16} />
        <span className="text-xs text-amber-700">긴급 처리 항목 확인 중...</span>
      </div>
    );
  }

  const total = (counts?.submittedCount ?? 0) + (counts?.rejectedCount ?? 0);
  if (total === 0) return null; // 비어 있을 때 위젯 자체 숨김

  return (
    <section
      className="rounded-2xl border border-amber-200 bg-amber-50/60 p-4 shadow-[0_4px_16px_rgba(245,158,11,0.08)] flex flex-col gap-2"
      aria-label="긴급 처리 필요 항목"
    >
      <header className="flex items-center gap-1.5 px-1">
        <AlertCircle size={16} className="text-amber-600" aria-hidden="true" />
        <h2 className="text-sm font-bold text-amber-900">긴급 처리 필요</h2>
      </header>

      <div className="flex flex-col gap-1">
        {counts && counts.submittedCount > 0 && (
          <UrgentRow
            label="멘토링 일지 승인 대기"
            count={counts.submittedCount}
            to="/programs"
            tone="amber"
          />
        )}
        {counts && counts.rejectedCount > 0 && (
          <UrgentRow
            label="반려 후 미수정 일지"
            count={counts.rejectedCount}
            to="/programs"
            tone="rose"
          />
        )}
      </div>
    </section>
  );
}
