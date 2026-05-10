// bal24 v2 — STEP-MENTOR-TEAM-VIEW 멘토 보고서 열람 + 의견 작성 모달
// PARTNER(멘토) 전용 — 5섹션 읽기전용 + mentor_feedback textarea + 저장.

import { useEffect, useState } from 'react';
import {
  Loader2, ExternalLink, Save, MessageCircle, CheckCircle2,
} from 'lucide-react';
import Modal from '../../../components/ui/Modal';
import { Button } from '../../../components/ui';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import {
  REPORT_STATUS_LABELS,
  type PerformanceReport, type PerformanceTarget, type PerformanceExpenditureItem,
} from '../../../types/performanceReport';

interface Props {
  report: PerformanceReport & {
    participant_applications: {
      name: string | null;
      email: string | null;
      organization: string | null;
    } | null;
  };
  onClose: () => void;
  onFeedbackSaved: () => void;
}

export default function MentorReportViewModal({ report, onClose, onFeedbackSaved }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [feedback, setFeedback] = useState('');
  const [targets, setTargets] = useState<PerformanceTarget[]>([]);
  const [expItems, setExpItems] = useState<PerformanceExpenditureItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);

  // 승인 완료된 보고서는 의견 수정 불가
  const isLocked = report.status === 'approved';

  useEffect(() => {
    setFeedback(report.mentor_feedback ?? '');
    let cancelled = false;
    void (async () => {
      setLoading(true);
      const [{ data: tRows }, { data: eRows }] = await Promise.all([
        supabase.from('performance_targets').select('*').eq('report_id', report.id).order('sort_order'),
        supabase.from('performance_expenditure_items').select('*').eq('report_id', report.id).order('sort_order'),
      ]);
      if (cancelled) return;
      setTargets((tRows ?? []) as PerformanceTarget[]);
      setExpItems((eRows ?? []) as PerformanceExpenditureItem[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [report.id, report.mentor_feedback]);

  const company = report.company_name ?? report.participant_applications?.organization ?? '-';
  const manager = report.manager_name ?? report.participant_applications?.name ?? '-';

  async function saveFeedback() {
    if (!feedback.trim()) {
      toast.error('의견을 입력해 주세요.');
      return;
    }
    setSaving(true);
    const { error } = await supabase
      .from('performance_reports')
      .update({
        mentor_feedback: feedback.trim(),
        mentor_id: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', report.id);
    setSaving(false);
    if (error) {
      console.error('[mentor-view] 의견 저장 실패:', error.message);
      toast.error('의견 저장 중 오류가 발생했어요.');
      return;
    }
    toast.success('의견을 저장했어요.');
    onFeedbackSaved();
  }

  return (
    <Modal open onClose={onClose} title={`보고서 열람 — ${company}`} size="lg">
      <div className="space-y-5 text-sm">
        {/* 상태 헤더 */}
        <div className="flex items-center justify-between gap-2 pb-3 border-b border-slate-100">
          <div className="text-xs text-slate-500">
            제출일 <span className="font-semibold text-[#1E1B4B]">{report.submitted_at ? formatDateKo(report.submitted_at) : '-'}</span>
          </div>
          <span className="text-[11px] font-semibold px-2 py-0.5 rounded-md border bg-slate-50 text-slate-600 border-slate-200">
            {REPORT_STATUS_LABELS[report.status]}
          </span>
        </div>

        {/* 섹션 1 — 기본정보 + 정산총괄표 */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[#1E1B4B]">① 기본정보 + 정산총괄표</h3>
          <div className="grid grid-cols-2 gap-3 text-xs">
            <Info label="기업명" value={company} />
            <Info label="담당자" value={manager} />
            <Info label="대표자" value={report.rep_name ?? '-'} />
            <Info label="협업기업" value={report.partner_company ?? '-'} />
          </div>
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3">
            <table className="w-full text-xs">
              <thead className="text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1 font-semibold">구분</th>
                  <th className="text-right px-2 py-1 font-semibold">계획</th>
                  <th className="text-right px-2 py-1 font-semibold">집행</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-100 tabular-nums">
                <BudgetRow label="총사업비" plan={report.total_budget} exec={report.total_executed} />
                <BudgetRow label="지원금"   plan={report.grant_budget} exec={report.grant_executed} />
                <BudgetRow label="자부담"   plan={report.self_budget}  exec={report.self_executed} />
              </tbody>
            </table>
          </div>
        </section>

        {/* 섹션 2 — 목표성과 결과표 */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[#1E1B4B]">② 목표성과 결과표</h3>
          {loading ? (
            <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />불러오는 중…</div>
          ) : targets.length === 0 ? (
            <p className="text-xs text-slate-400">입력된 목표가 없어요.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold">지표</th>
                    <th className="text-right px-2 py-1.5 font-semibold">계획</th>
                    <th className="text-right px-2 py-1.5 font-semibold">실적</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">달성률</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {targets.map((t) => (
                    <tr key={t.id}>
                      <td className="px-2 py-1.5 font-semibold text-[#1E1B4B]">{t.metric_name}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t.planned_value || '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">{t.actual_value || '-'}</td>
                      <td className="px-2 py-1.5 text-right tabular-nums">
                        {t.achievement_rate != null ? `${t.achievement_rate.toFixed(1)}%` : <span className="text-slate-300">-</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 섹션 3 — 비목별 집행내역 */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[#1E1B4B]">③ 비목별 집행내역</h3>
          {loading ? (
            <div className="text-xs text-slate-400 flex items-center gap-1.5"><Loader2 size={12} className="animate-spin" />불러오는 중…</div>
          ) : expItems.length === 0 ? (
            <p className="text-xs text-slate-400">입력된 집행내역이 없어요.</p>
          ) : (
            <div className="rounded-xl border border-slate-200 overflow-x-auto">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500">
                  <tr>
                    <th className="text-left px-2 py-1.5 font-semibold">비목</th>
                    <th className="text-left px-2 py-1.5 font-semibold">세목</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">예산(지원)</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">예산(자부담)</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">집행(지원)</th>
                    <th className="text-right px-2 py-1.5 font-semibold whitespace-nowrap">집행(자부담)</th>
                    <th className="text-left px-2 py-1.5 font-semibold">비고</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100 tabular-nums">
                  {expItems.map((e) => (
                    <tr key={e.id}>
                      <td className="px-2 py-1.5 font-semibold text-[#1E1B4B]">{e.category}</td>
                      <td className="px-2 py-1.5 text-slate-600">{e.sub_category ?? '-'}</td>
                      <td className="px-2 py-1.5 text-right">{e.grant_budget != null ? formatMoney(e.grant_budget) : '-'}</td>
                      <td className="px-2 py-1.5 text-right">{e.self_budget != null ? formatMoney(e.self_budget) : '-'}</td>
                      <td className="px-2 py-1.5 text-right">{e.grant_executed != null ? formatMoney(e.grant_executed) : '-'}</td>
                      <td className="px-2 py-1.5 text-right">{e.self_executed != null ? formatMoney(e.self_executed) : '-'}</td>
                      <td className="px-2 py-1.5 text-slate-500">{e.notes ?? '-'}</td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>

        {/* 섹션 4 — 사업성과 서술 */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[#1E1B4B]">④ 사업성과 서술</h3>
          <div className="space-y-2 text-xs">
            <Para label="사업 목적/개요" value={report.business_summary} />
            <Para label="판매·홍보 방법" value={report.sales_method} />
            <Para label="사업성과 서술" value={report.achievement_notes} />
          </div>
        </section>

        {/* 섹션 5 — 홍보사진 */}
        <section className="space-y-2">
          <h3 className="text-sm font-bold text-[#1E1B4B]">⑤ 홍보사진 ({report.photo_urls?.length ?? 0}장)</h3>
          {!report.photo_urls || report.photo_urls.length === 0 ? (
            <p className="text-xs text-slate-400">첨부된 사진이 없어요.</p>
          ) : (
            <div className="flex flex-wrap gap-2">
              {report.photo_urls.map((url, idx) => (
                <a key={idx} href={url} target="_blank" rel="noreferrer" className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200 hover:opacity-80 transition-opacity">
                  <img src={url} alt={`사진 ${idx + 1}`} className="w-full h-full object-cover" />
                  <span className="absolute bottom-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/80 text-violet-700">
                    <ExternalLink size={10} />
                  </span>
                </a>
              ))}
            </div>
          )}
        </section>

        {/* 섹션 6 — 멘토 의견 */}
        <section className="space-y-2 pt-3 border-t border-slate-200">
          <h3 className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <MessageCircle size={14} className="text-violet-600" aria-hidden="true" />
            멘토 의견
          </h3>

          {isLocked && (
            <div className="rounded-xl bg-emerald-50 border border-emerald-100 px-3 py-2 text-xs text-emerald-900 flex items-center gap-1.5">
              <CheckCircle2 size={14} aria-hidden="true" />
              승인 완료된 보고서예요. 의견 수정은 불가해요.
            </div>
          )}

          <textarea
            placeholder="이 팀에 대한 검토 의견을 작성해 주세요."
            value={feedback}
            onChange={(e) => setFeedback(e.target.value)}
            disabled={isLocked || saving}
            rows={5}
            className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 resize-y leading-relaxed disabled:opacity-60 disabled:bg-slate-50"
          />

          {!isLocked && (
            <div className="flex items-center justify-end pt-1">
              <Button variant="primary" size="sm" leftIcon={<Save size={12} />}
                onClick={() => void saveFeedback()} loading={saving}>
                의견 저장
              </Button>
            </div>
          )}
        </section>
      </div>
    </Modal>
  );
}

function Info({ label, value }: { label: string; value: string }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider">{label}</p>
      <p className="text-sm text-[#1E1B4B] mt-0.5">{value}</p>
    </div>
  );
}

function BudgetRow({ label, plan, exec }: { label: string; plan: number | null; exec: number | null }) {
  return (
    <tr>
      <td className="px-2 py-1.5 font-semibold text-[#1E1B4B]">{label}</td>
      <td className="px-2 py-1.5 text-right">{plan != null ? formatMoney(plan) : '-'}</td>
      <td className="px-2 py-1.5 text-right">{exec != null ? formatMoney(exec) : '-'}</td>
    </tr>
  );
}

function Para({ label, value }: { label: string; value: string | null }) {
  return (
    <div>
      <p className="text-[10px] font-semibold text-slate-400 uppercase tracking-wider mb-1">{label}</p>
      <div className="rounded-lg bg-slate-50 border border-slate-100 px-3 py-2 whitespace-pre-wrap text-slate-700 leading-relaxed min-h-[32px]">
        {value?.trim() || <span className="text-slate-300">입력 없음</span>}
      </div>
    </div>
  );
}
