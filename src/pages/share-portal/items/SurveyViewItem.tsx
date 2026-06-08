// bal24 v2 — 외부공유 항목 · 만족도 확인 (read-only 통계, 결과 단계)

import { useEffect, useState } from 'react';
import { Star, Loader2 } from 'lucide-react';
import { fetchPublicSurveySummary, type SurveySummaryItem } from '../sharePortalUtils';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

const TYPE_LABEL: Record<string, string> = {
  사전: '사전 설문',
  사후: '사후 설문',
};

export default function SurveyViewItem({ programId }: Props) {
  const [stats, setStats] = useState<SurveySummaryItem[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const next = await fetchPublicSurveySummary(programId);
      if (cancelled) return;
      setStats(next);
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  const total = stats.reduce((s, r) => s + r.count, 0);

  // 박경수님 2026-06-08 — 만족도 응답이 0건이면 카드 자체를 숨김 (미진행 설문 노출 방지)
  if (!loading && total === 0) return null;

  return (
    <ItemCard
      icon={<Star size={18} aria-hidden="true" />}
      title="만족도 결과"
      hint={`총 ${total}건 응답 — 평균 평점`}
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : (
        <ul className="flex flex-col gap-2">
          {stats.map((s) => (
            <li
              key={s.type}
              className="flex items-center gap-3 rounded-xl border border-orange-100 bg-orange-50/30 px-3 py-2.5"
            >
              <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-orange-100 text-orange-700 shrink-0">
                {TYPE_LABEL[s.type] ?? s.type}
              </span>
              <div className="flex-1 min-w-0">
                <p className="text-[11px] text-slate-500">응답 수</p>
                <p className="text-sm font-bold text-[#1E1B4B] tabular-nums">{s.count}건</p>
              </div>
              <div className="shrink-0 text-right">
                <p className="text-[11px] text-slate-500">평균 평점</p>
                <p className="text-sm font-bold text-orange-600 tabular-nums">
                  {s.avg_rating != null ? `${s.avg_rating} / 5` : '—'}
                </p>
              </div>
            </li>
          ))}
        </ul>
      )}
    </ItemCard>
  );
}
