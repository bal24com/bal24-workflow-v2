// bal24 v2 — 프로그램 상세 · 결과·만족도 탭
// public_forms (form_type='survey'·'feedback') + surveys 통계.

import { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { Loader2, FileText, Star, Plus } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import {
  fetchProgramForms,
  fetchProgramSurveySummary,
  formTypeLabel,
  type FormRow,
  type SurveySummary,
} from './programDetailUtils';

const SURVEY_TYPE_LABEL: Record<string, string> = {
  사전: '사전 설문',
  사후: '사후 설문',
};

export default function SurveyResultTab({ programId }: { programId: string }) {
  const toast = useToast();
  const [forms, setForms] = useState<FormRow[]>([]);
  const [summary, setSummary] = useState<SurveySummary>({ total: 0, byType: {} });
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      try {
        const [f, s] = await Promise.all([
          fetchProgramForms(programId),
          fetchProgramSurveySummary(programId),
        ]);
        if (cancelled) return;
        setForms(f.filter((x) => x.form_type === 'survey' || x.form_type === 'feedback'));
        setSummary(s);
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[program-detail] 결과·만족도 로드 실패:', raw);
        toast.error('결과·만족도 정보를 불러오지 못했어요.');
      } finally {
        if (!cancelled) setLoading(false);
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="grid grid-cols-1 lg:grid-cols-2 gap-4">
      {/* 외부 폼 (설문·피드백) */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <FileText size={16} className="text-violet-500" aria-hidden="true" />
            외부 폼 ({forms.length})
          </h3>
          <Link to="/forms" className="text-xs text-violet-600 hover:underline inline-flex items-center gap-0.5">
            <Plus size={12} aria-hidden="true" />새 폼
          </Link>
        </header>
        {forms.length === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">
            등록된 설문·피드백 폼이 없어요.
          </p>
        ) : (
          <ul className="flex flex-col gap-1.5">
            {forms.map((f) => (
              <li
                key={f.id}
                className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2"
              >
                <div className="flex items-center gap-1.5">
                  <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-violet-100 text-violet-700 shrink-0">
                    {formTypeLabel(f.form_type)}
                  </span>
                  <span className="flex-1 min-w-0 truncate text-xs font-semibold text-[#1E1B4B]">
                    {f.title}
                  </span>
                  <span className="text-[11px] text-slate-500 tabular-nums shrink-0">
                    응답 {f.application_count}건
                  </span>
                </div>
                {(f.open_at || f.close_at) && (
                  <p className="mt-0.5 text-[10px] text-slate-400 tabular-nums">
                    {formatDateKo(f.open_at)}
                    {' ~ '}
                    {formatDateKo(f.close_at) || '미정'}
                  </p>
                )}
              </li>
            ))}
          </ul>
        )}
      </section>

      {/* 만족도 요약 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3">
        <header className="flex items-center justify-between">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <Star size={16} className="text-orange-500" aria-hidden="true" />
            만족도 응답 ({summary.total})
          </h3>
        </header>

        {summary.total === 0 ? (
          <p className="text-xs text-slate-400 italic text-center py-4">
            아직 만족도 응답이 없어요.
          </p>
        ) : (
          <div className="flex flex-col gap-2">
            {Object.entries(summary.byType).map(([type, stat]) => (
              <div
                key={type}
                className="rounded-xl border border-orange-100 bg-orange-50/30 p-3 flex items-center gap-3"
              >
                <span className="inline-flex items-center px-2 py-1 rounded-md text-xs font-bold bg-orange-100 text-orange-700 shrink-0">
                  {SURVEY_TYPE_LABEL[type] ?? type}
                </span>
                <div className="flex-1 min-w-0">
                  <p className="text-xs text-slate-500">응답 수</p>
                  <p className="text-sm font-bold text-[#1E1B4B] tabular-nums">{stat.count}건</p>
                </div>
                <div className="shrink-0 text-right">
                  <p className="text-xs text-slate-500">평균 평점</p>
                  <p className="text-sm font-bold text-orange-600 tabular-nums">
                    {stat.avgRating != null ? `${stat.avgRating} / 5` : '—'}
                  </p>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </div>
  );
}
