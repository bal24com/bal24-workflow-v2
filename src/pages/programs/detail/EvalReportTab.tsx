// bal24 v2 — STEP-EVAL-REPORT 평가 결과 리포트 탭
// eval_result_summary 뷰 기반 순위·점수 집계 + 합격 처리.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Trophy, CheckCircle2, Users2, BarChart3,
} from 'lucide-react';
import { Button, Card, CardContent } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import { isMissingTableError } from '../../schedule/scheduleUtils';
import {
  PARTICIPANT_STATUS_LABELS, PARTICIPANT_STATUS_TONE,
} from './applicationMgmtUtils';
import type { ParticipantStatus } from '../../../types/application';

interface Props {
  programId: string;
}

interface EvalResultRow {
  application_id: string;
  program_id: string;
  applicant_name: string | null;
  application_status: ParticipantStatus;
  applied_at: string;
  avg_score: number;
  max_score: number;
  min_score: number;
  evaluator_count: number;
  rank: number;
}

const RANK_BADGE: Record<number, { label: string; className: string }> = {
  1: { label: '🥇 1위', className: 'bg-amber-100 text-amber-800 border-amber-200' },
  2: { label: '🥈 2위', className: 'bg-slate-200 text-slate-700 border-slate-300' },
  3: { label: '🥉 3위', className: 'bg-orange-100 text-orange-800 border-orange-200' },
};

export default function EvalReportTab({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [rows, setRows] = useState<EvalResultRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [viewMissing, setViewMissing] = useState(false);
  const [acting, setActing] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setViewMissing(false);
    const { data, error } = await supabase
      .from('eval_result_summary')
      .select('*')
      .eq('program_id', programId)
      .order('rank', { ascending: true });
    if (error) {
      if (isMissingTableError(error.message)) {
        setViewMissing(true);
        setRows([]);
        setLoading(false);
        return;
      }
      console.error('[eval-report] 조회 실패:', error.message);
      toast.error('평가 결과를 불러오지 못했어요.');
      setRows([]);
      setLoading(false);
      return;
    }
    setRows(((data ?? []) as EvalResultRow[]));
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  async function handleAccept(applicationId: string) {
    if (!window.confirm('합격 처리하면 신청자에게 즉시 반영돼요. 진행할까요?')) return;
    setActing(applicationId);
    try {
      const { error } = await supabase
        .from('participant_applications')
        .update({
          status: 'accepted',
          reviewed_by: user?.id ?? null,
          reviewed_at: new Date().toISOString(),
          updated_at: new Date().toISOString(),
        })
        .eq('id', applicationId);
      if (error) {
        console.error('[eval-report] 합격 처리 실패:', error.message);
        toast.error('합격 처리에 실패했어요.');
        return;
      }
      toast.success('합격 처리됐어요.');
      await refresh();
    } finally {
      setActing(null);
    }
  }

  // 요약
  const summary = useMemo(() => {
    const total = rows.length;
    const evaluated = rows.filter((r) => r.evaluator_count > 0).length;
    const topScore = rows.reduce((m, r) => Math.max(m, Number(r.avg_score)), 0);
    return { total, evaluated, topScore };
  }, [rows]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 size={20} className="animate-spin text-violet-400 mr-2" aria-hidden="true" />
        불러오는 중…
      </div>
    );
  }

  if (viewMissing) {
    return (
      <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-bold">평가 집계 데이터를 불러올 수 없어요.</p>
        <p className="mt-1 text-xs">
          관리자가 SQL 마이그레이션 <code>20260510_eval_result_summary.sql</code> 을 실행하면 사용할 수 있어요.
        </p>
      </div>
    );
  }

  if (rows.length === 0) {
    return <EmptyState emoji="📊" title="아직 평가 점수가 없어요" description="평가위원이 점수를 입력하면 결과가 자동 집계돼요." />;
  }

  return (
    <div className="space-y-4">
      {/* 요약 배지 3개 */}
      <ul className="grid grid-cols-3 gap-3">
        <li>
          <Card>
            <CardContent className="p-4 text-center space-y-1">
              <Users2 size={16} className="mx-auto text-violet-600" aria-hidden="true" />
              <p className="text-[11px] text-slate-500">전체 신청자</p>
              <p className="text-xl font-bold text-[#1E1B4B] tabular-nums">{summary.total}<span className="text-sm text-slate-400 ml-0.5">명</span></p>
            </CardContent>
          </Card>
        </li>
        <li>
          <Card>
            <CardContent className="p-4 text-center space-y-1">
              <BarChart3 size={16} className="mx-auto text-cyan-600" aria-hidden="true" />
              <p className="text-[11px] text-slate-500">평가 완료</p>
              <p className="text-xl font-bold text-[#1E1B4B] tabular-nums">{summary.evaluated}<span className="text-sm text-slate-400 ml-0.5">명</span></p>
            </CardContent>
          </Card>
        </li>
        <li>
          <Card>
            <CardContent className="p-4 text-center space-y-1">
              <Trophy size={16} className="mx-auto text-amber-500" aria-hidden="true" />
              <p className="text-[11px] text-slate-500">최고 평균</p>
              <p className="text-xl font-bold text-violet-700 tabular-nums">{summary.topScore.toFixed(1)}<span className="text-sm text-slate-400 ml-0.5">점</span></p>
            </CardContent>
          </Card>
        </li>
      </ul>

      {/* 결과 테이블 */}
      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-center px-3 py-2.5 font-semibold w-16">순위</th>
              <th className="text-left px-3 py-2.5 font-semibold">신청자</th>
              <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">평균점수</th>
              <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">최고/최저</th>
              <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">평가위원</th>
              <th className="text-center px-3 py-2.5 font-semibold">신청상태</th>
              <th className="text-right px-3 py-2.5 font-semibold">액션</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {rows.map((r) => {
              const rankBadge = RANK_BADGE[r.rank];
              const isEvaluated = r.evaluator_count > 0;
              const isAccepted = r.application_status === 'accepted';
              return (
                <tr key={r.application_id} className="hover:bg-violet-50/30 transition-colors">
                  <td className="px-3 py-2.5 text-center">
                    {rankBadge ? (
                      <span className={`text-[11px] font-bold px-2 py-0.5 rounded-md border ${rankBadge.className}`}>
                        {rankBadge.label}
                      </span>
                    ) : (
                      <span className="text-xs font-bold text-slate-400 tabular-nums">{r.rank}</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 font-semibold text-[#1E1B4B]">
                    {r.applicant_name ?? '이름 미상'}
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isEvaluated ? (
                      <span className="text-base font-bold text-violet-700 tabular-nums">{Number(r.avg_score).toFixed(1)}</span>
                    ) : (
                      <span className="text-xs text-slate-300">-</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-right text-xs text-slate-500 tabular-nums whitespace-nowrap">
                    {isEvaluated ? `${Number(r.max_score).toFixed(1)} / ${Number(r.min_score).toFixed(1)}` : '-'}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    {isEvaluated ? (
                      <span className="text-xs text-slate-600 tabular-nums">{r.evaluator_count}명</span>
                    ) : (
                      <span className="text-[10px] font-semibold bg-slate-100 text-slate-500 border border-slate-200 px-1.5 py-0.5 rounded-md">미평가</span>
                    )}
                  </td>
                  <td className="px-3 py-2.5 text-center">
                    <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${PARTICIPANT_STATUS_TONE[r.application_status]}`}>
                      {PARTICIPANT_STATUS_LABELS[r.application_status]}
                    </span>
                  </td>
                  <td className="px-3 py-2.5 text-right">
                    {isAccepted ? (
                      <span className="inline-flex items-center gap-1 text-xs font-bold text-emerald-700">
                        <CheckCircle2 size={12} aria-hidden="true" />
                        합격
                      </span>
                    ) : (
                      <Button
                        variant="outline"
                        size="sm"
                        onClick={() => void handleAccept(r.application_id)}
                        disabled={acting !== null}
                        loading={acting === r.application_id}
                        className="!border-emerald-200 !text-emerald-700 hover:!bg-emerald-50"
                        leftIcon={<CheckCircle2 size={12} />}
                      >
                        합격 처리
                      </Button>
                    )}
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
