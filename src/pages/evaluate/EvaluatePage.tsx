// bal24 v2 — STEP-EVALUATION-SYSTEM 외부 평가 포털 (/evaluate/:token)
// 비로그인. 토큰 검증 → 신청자 목록 + 카테고리 3종 점수 입력 → UPSERT.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, ShieldAlert, CheckCircle2, Award, Save } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import {
  fetchEvaluatorByToken, fetchApplicants, fetchExistingScores,
  upsertScore, setEvaluatorStatus,
  type EvaluatorContext, type ApplicantRow,
} from './evaluateUtils';
import { EVALUATION_CATEGORIES, EVALUATION_TOTAL_MAX } from '../programs/detail/evaluatorUtils';

type Screen = 'loading' | 'invalid' | 'completed' | 'ready';

interface ScoreState {
  /** key: `${applicationId}:${category}` */
  [key: string]: { score: string; comment: string };
}

const k = (appId: string, cat: string) => `${appId}:${cat}`;

export default function EvaluatePage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [screen, setScreen] = useState<Screen>('loading');
  const [ctx, setCtx] = useState<EvaluatorContext | null>(null);
  const [applicants, setApplicants] = useState<ApplicantRow[]>([]);
  const [scores, setScores] = useState<ScoreState>({});
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setScreen('invalid'); return; }
    const c = await fetchEvaluatorByToken(token);
    if (!c) { setScreen('invalid'); return; }
    setCtx(c);
    if (c.evaluator.status === 'completed') { setScreen('completed'); return; }

    const apps = await fetchApplicants(c.evaluator.program_id);
    setApplicants(apps);

    const existing = await fetchExistingScores(c.evaluator.id, apps.map((a) => a.id));
    const initial: ScoreState = {};
    for (const a of apps) {
      for (const cat of EVALUATION_CATEGORIES) {
        const found = existing.find((e) => e.application_id === a.id && e.category === cat.key);
        initial[k(a.id, cat.key)] = {
          score: found ? String(found.score) : '',
          comment: found?.comment ?? '',
        };
      }
    }
    setScores(initial);
    setScreen('ready');
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [load]);

  const updateScore = (appId: string, cat: string, score: string) => {
    setScores((p) => ({ ...p, [k(appId, cat)]: { ...p[k(appId, cat)], score } }));
  };
  const updateComment = (appId: string, cat: string, comment: string) => {
    setScores((p) => ({ ...p, [k(appId, cat)]: { ...p[k(appId, cat)], comment } }));
  };

  const totalsByApp = useMemo(() => {
    const result = new Map<string, number>();
    for (const a of applicants) {
      let sum = 0;
      for (const cat of EVALUATION_CATEGORIES) {
        const v = Number(scores[k(a.id, cat.key)]?.score ?? 0);
        if (Number.isFinite(v)) sum += v;
      }
      result.set(a.id, sum);
    }
    return result;
  }, [applicants, scores]);

  async function handleSaveAll() {
    if (!ctx) return;
    setSubmitting(true);
    try {
      let okCount = 0;
      let failCount = 0;
      for (const a of applicants) {
        for (const cat of EVALUATION_CATEGORIES) {
          const entry = scores[k(a.id, cat.key)];
          const raw = entry?.score?.trim() ?? '';
          if (!raw) continue;
          const numeric = Number(raw);
          if (!Number.isFinite(numeric) || numeric < 0 || numeric > cat.max) {
            toast.error(`${a.name} - ${cat.key}: 0 ~ ${cat.max} 사이 숫자여야 해요.`);
            failCount += 1;
            continue;
          }
          const result = await upsertScore({
            evaluatorId: ctx.evaluator.id,
            applicationId: a.id,
            category: cat.key,
            score: numeric,
            maxScore: cat.max,
            comment: entry?.comment,
          });
          if (result.success) okCount += 1;
          else failCount += 1;
        }
      }
      // 진행 중 표기 — 첫 저장 시 'invited' → 'accepted'
      if (ctx.evaluator.status === 'invited' && okCount > 0) {
        await setEvaluatorStatus(ctx.evaluator.id, 'accepted');
      }
      if (failCount === 0 && okCount > 0) {
        toast.success(`${okCount}건의 점수를 저장했어요.`);
      } else if (okCount > 0) {
        toast.warning(`${okCount}건 저장됐지만 ${failCount}건 실패했어요.`);
      } else if (failCount > 0) {
        toast.error('저장에 실패한 항목이 있어요. 입력값을 확인해 주세요.');
      } else {
        toast.info('저장할 점수가 없어요.');
      }
    } finally {
      setSubmitting(false);
    }
  }

  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (screen === 'invalid') {
    return <ErrorCard icon={<ShieldAlert size={32} className="mx-auto text-rose-400" />} title="유효하지 않은 평가 링크" message="링크를 다시 확인해 주세요." />;
  }

  if (screen === 'completed') {
    return <ErrorCard icon={<CheckCircle2 size={32} className="mx-auto text-emerald-500" />} title="평가가 완료됐어요" message="이미 완료된 평가입니다. 추가 입력이 필요하면 담당자에게 문의해 주세요." />;
  }

  if (!ctx) return null;

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 px-4 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider inline-flex items-center gap-1">
            <Award size={11} aria-hidden="true" />
            평가 포털
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#1E1B4B]">{ctx.programName ?? '프로그램'}</h1>
          <p className="mt-1 text-xs text-slate-500">
            평가위원 <span className="font-bold text-violet-700">{ctx.evaluatorName ?? '-'}</span> 님 · 총 {EVALUATION_TOTAL_MAX}점 만점
          </p>
        </header>

        {applicants.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">평가 대상 신청자가 아직 없어요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {applicants.map((a) => {
              const total = totalsByApp.get(a.id) ?? 0;
              return (
                <li key={a.id} className="rounded-2xl border border-violet-100 bg-white p-5 space-y-3">
                  <header className="flex items-center justify-between gap-2 flex-wrap">
                    <div className="min-w-0">
                      <p className="text-base font-bold text-[#1E1B4B] truncate">{a.name}</p>
                      {a.organization && (
                        <p className="text-[11px] text-slate-500 truncate">{a.organization}</p>
                      )}
                    </div>
                    <span className="text-base font-bold text-violet-700 tabular-nums">
                      {total} / {EVALUATION_TOTAL_MAX}점
                    </span>
                  </header>

                  {a.motivation && (
                    <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3">
                      {a.motivation}
                    </p>
                  )}

                  <div className="space-y-2">
                    {EVALUATION_CATEGORIES.map((cat) => {
                      const entry = scores[k(a.id, cat.key)] ?? { score: '', comment: '' };
                      return (
                        <div key={cat.key} className="grid grid-cols-1 sm:grid-cols-3 gap-2 items-start">
                          <label className="text-xs font-semibold text-slate-700 sm:pt-2">
                            {cat.key} <span className="text-[10px] text-slate-400">({cat.max}점)</span>
                          </label>
                          <input
                            type="number"
                            min={0}
                            max={cat.max}
                            value={entry.score}
                            onChange={(e) => updateScore(a.id, cat.key, e.target.value)}
                            disabled={submitting}
                            placeholder={`0 ~ ${cat.max}`}
                            className="rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                          <input
                            type="text"
                            value={entry.comment}
                            onChange={(e) => updateComment(a.id, cat.key, e.target.value)}
                            disabled={submitting}
                            placeholder="코멘트 (선택)"
                            className="rounded-xl border border-slate-200 px-3 py-2 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                          />
                        </div>
                      );
                    })}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        {applicants.length > 0 && (
          <div className="sticky bottom-4 z-10">
            <Button
              variant="primary"
              loading={submitting}
              onClick={() => void handleSaveAll()}
              className="!w-full !py-3 text-base font-semibold shadow-lg"
              leftIcon={<Save size={16} />}
            >
              전체 저장
            </Button>
          </div>
        )}

        <p className="text-center text-[10px] text-slate-400 py-2">© 2026 (주)밸런스닷 · WorkFlow</p>
      </div>
    </div>
  );
}

interface ErrorProps { icon: React.ReactNode; title: string; message: string }
function ErrorCard({ icon, title, message }: ErrorProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center space-y-3">
        {icon}
        <p className="text-base font-bold text-[#1E1B4B]">{title}</p>
        <p className="text-sm text-slate-500">{message}</p>
      </div>
    </div>
  );
}
