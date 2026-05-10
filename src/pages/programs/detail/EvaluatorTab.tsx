// bal24 v2 — STEP-EVALUATION-SYSTEM PM 측 평가위원 관리 탭
// 평가위원 목록 + 추가 + 평가 링크 복사 + 완료 처리(→ staff_fee 자동) + 점수 집계.

import { useCallback, useEffect, useState } from 'react';
import {
  Loader2, Plus, Copy, ExternalLink, CheckCircle2, Trash2, Award, Trophy,
} from 'lucide-react';
import { Button, Card, CardContent } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { formatDateKo } from '../../../lib/utils';
import {
  fetchEvaluators, deleteEvaluator, completeEvaluator,
  fetchScoreSummary, buildEvalUrl,
  type EvaluatorRow, type ApplicationScoreSummary,
} from './evaluatorUtils';
import AddEvaluatorModal from './AddEvaluatorModal';

interface Props {
  programId: string;
}

const STATUS_BADGE: Record<string, { label: string; className: string }> = {
  invited:   { label: '초대됨',   className: 'bg-slate-100 text-slate-600 border-slate-200' },
  accepted:  { label: '평가 중',  className: 'bg-violet-50 text-violet-700 border-violet-200' },
  completed: { label: '완료',     className: 'bg-emerald-50 text-emerald-700 border-emerald-200' },
  declined:  { label: '거절',     className: 'bg-rose-50 text-rose-700 border-rose-200' },
};

export default function EvaluatorTab({ programId }: Props) {
  const toast = useToast();
  const [evaluators, setEvaluators] = useState<EvaluatorRow[]>([]);
  const [scoreSummary, setScoreSummary] = useState<ApplicationScoreSummary[]>([]);
  const [loading, setLoading] = useState(true);
  const [modalOpen, setModalOpen] = useState(false);
  const [actingId, setActingId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const [list, summary] = await Promise.all([
      fetchEvaluators(programId),
      fetchScoreSummary(programId),
    ]);
    setEvaluators(list);
    setScoreSummary(summary);
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  async function handleCopyLink(ev: EvaluatorRow) {
    const url = buildEvalUrl(ev.eval_token);
    const ok = await copyToClipboard(url);
    if (ok) toast.success('평가 링크를 복사했어요.');
    else toast.error('복사에 실패했어요. 직접 선택해 복사해 주세요.');
  }

  async function handleComplete(ev: EvaluatorRow) {
    if (!window.confirm(`${ev.staff_pool?.name ?? '평가위원'} 의 평가를 완료 처리할까요? 강사료가 자동 등록돼요.`)) return;
    setActingId(ev.id);
    const result = await completeEvaluator(ev);
    setActingId(null);
    if (!result.success) {
      toast.error(result.error ?? '평가 완료 처리에 실패했어요.');
      return;
    }
    toast.success('평가를 완료 처리했어요. 강사료가 등록됐어요.');
    await refresh();
  }

  async function handleDelete(ev: EvaluatorRow) {
    if (!window.confirm(`${ev.staff_pool?.name ?? '평가위원'} 을(를) 삭제할까요? 입력된 점수도 함께 삭제됩니다.`)) return;
    setActingId(ev.id);
    const ok = await deleteEvaluator(ev.id);
    setActingId(null);
    if (!ok) {
      toast.error('삭제에 실패했어요.');
      return;
    }
    toast.success('평가위원을 삭제했어요.');
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 size={20} className="animate-spin text-violet-400 mr-2" aria-hidden="true" />
        <span className="text-sm">불러오는 중…</span>
      </div>
    );
  }

  return (
    <div className="space-y-5">
      {/* 헤더 */}
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Award size={18} className="text-violet-600" aria-hidden="true" />
          평가위원 ({evaluators.length})
        </h2>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setModalOpen(true)}>
          평가위원 추가
        </Button>
      </header>

      {/* 평가위원 목록 */}
      {evaluators.length === 0 ? (
        <EmptyState
          emoji="🧑‍⚖️"
          title="등록된 평가위원이 없어요"
          description="우측 상단 '평가위원 추가' 로 시작하세요."
        />
      ) : (
        <ul className="grid grid-cols-1 lg:grid-cols-2 gap-3">
          {evaluators.map((ev) => {
            const badge = STATUS_BADGE[ev.status] ?? STATUS_BADGE.invited;
            const acting = actingId === ev.id;
            return (
              <li key={ev.id}>
                <Card>
                  <CardContent className="p-4 space-y-3">
                    <div className="flex items-start justify-between gap-2 flex-wrap">
                      <div className="min-w-0">
                        <p className="text-sm font-bold text-[#1E1B4B] truncate">
                          {ev.staff_pool?.name ?? '이름 미상'}
                        </p>
                        <p className="text-[11px] text-slate-500 truncate">
                          {ev.staff_pool?.email ?? '이메일 없음'}
                        </p>
                      </div>
                      <span className={`text-[11px] font-semibold px-2 py-0.5 rounded-md border ${badge.className}`}>
                        {badge.label}
                      </span>
                    </div>

                    <div className="rounded-xl bg-violet-50/50 p-2.5 text-xs space-y-0.5">
                      <div className="flex justify-between text-slate-600">
                        <span>평가비</span>
                        <span className="tabular-nums font-semibold">
                          {ev.fee_amount.toLocaleString()}원 ({ev.fee_type})
                        </span>
                      </div>
                      <div className="flex justify-between text-slate-500">
                        <span>초대일</span>
                        <span className="tabular-nums">{formatDateKo(ev.invited_at) || '-'}</span>
                      </div>
                      {ev.completed_at && (
                        <div className="flex justify-between text-emerald-700">
                          <span>완료일</span>
                          <span className="tabular-nums">{formatDateKo(ev.completed_at)}</span>
                        </div>
                      )}
                    </div>

                    <div className="flex items-center gap-1 justify-end flex-wrap">
                      <button
                        type="button"
                        onClick={() => void handleCopyLink(ev)}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-slate-600 hover:bg-slate-100"
                      >
                        <Copy size={11} aria-hidden="true" />
                        평가 링크
                      </button>
                      <a
                        href={buildEvalUrl(ev.eval_token)}
                        target="_blank"
                        rel="noreferrer"
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-violet-700 hover:bg-violet-50"
                      >
                        <ExternalLink size={11} aria-hidden="true" />
                        열기
                      </a>
                      {ev.status !== 'completed' && (
                        <button
                          type="button"
                          onClick={() => void handleComplete(ev)}
                          disabled={acting}
                          className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-emerald-700 hover:bg-emerald-50 disabled:opacity-50"
                        >
                          {acting ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <CheckCircle2 size={11} aria-hidden="true" />}
                          완료 처리
                        </button>
                      )}
                      <button
                        type="button"
                        onClick={() => void handleDelete(ev)}
                        disabled={acting}
                        className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] text-rose-500 hover:bg-rose-50 disabled:opacity-50"
                      >
                        <Trash2 size={11} aria-hidden="true" />
                        삭제
                      </button>
                    </div>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}

      {/* 점수 집계 */}
      <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-3">
        <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Trophy size={16} className="text-amber-500" aria-hidden="true" />
          신청자별 점수 집계
        </h3>
        {scoreSummary.length === 0 ? (
          <p className="text-xs text-slate-400 text-center py-4">아직 입력된 점수가 없어요.</p>
        ) : (
          <ul className="flex flex-col divide-y divide-slate-100">
            {scoreSummary.map((s, idx) => (
              <li key={s.application_id} className="py-2.5 flex items-center gap-3">
                <span className="w-6 text-center text-xs font-bold text-slate-500 tabular-nums">{idx + 1}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-semibold text-[#1E1B4B] truncate">
                    {s.applicant_name ?? '이름 미상'}
                  </p>
                  <p className="text-[11px] text-slate-500">
                    평가위원 {s.evaluator_count}명 참여
                  </p>
                </div>
                <span className="text-base font-bold text-violet-700 tabular-nums">
                  {s.avg_score.toFixed(1)}점
                </span>
              </li>
            ))}
          </ul>
        )}
      </section>

      <AddEvaluatorModal
        open={modalOpen}
        programId={programId}
        onClose={() => setModalOpen(false)}
        onAdded={() => { void refresh(); }}
      />
    </div>
  );
}
