// bal24 v2 — STEP-AUDIT-PORTAL 회계감사 외부 포털 (/audit/:token)
// 비로그인 anon. audit_token 으로 보고서·증빙 조회 → 항목별/종합 의견 → 감사 제출.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, ShieldAlert, CheckCircle2, FileSearch,
} from 'lucide-react';
import { useToast } from '../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../lib/utils';
import { supabase } from '../../lib/supabase';
import {
  uploadFile, STORAGE_BUCKETS, STORAGE_PATHS, getFileExtension, safeFileBase,
} from '../../lib/storageUtils';
import type { PerformanceReport } from '../../types/performanceReport';
import type { GrantExpenditure } from '../../types/grantLedger';
import AuditExpenditureCard from './AuditExpenditureCard';
import AuditSubmitSection from './AuditSubmitSection';

type Screen = 'loading' | 'invalid' | 'completed' | 'ready';
type FilterTab = 'all' | 'operation' | 'promotion' | 'etc';

const FILTER_TABS: { key: FilterTab; label: string; match: (s: string) => boolean }[] = [
  { key: 'all',       label: '전체',       match: () => true },
  { key: 'operation', label: '운영비',     match: (s) => /운영|재료|외주/.test(s) },
  { key: 'promotion', label: '광고홍보비', match: (s) => /광고|홍보/.test(s) },
  { key: 'etc',       label: '기타',       match: () => false /* placeholder, computed inversely */ },
];

interface ReportRow extends PerformanceReport {
  programs: { name: string | null; program_type: string | null } | null;
  participant_applications: { name: string | null; organization: string | null } | null;
}

export default function AuditPortalPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [screen, setScreen] = useState<Screen>('loading');
  const [report, setReport] = useState<ReportRow | null>(null);
  const [expenditures, setExpenditures] = useState<GrantExpenditure[]>([]);
  const [auditComments, setAuditComments] = useState<Record<string, string>>({});
  const [overallComment, setOverallComment] = useState('');
  const [auditFile, setAuditFile] = useState<File | null>(null);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [submitting, setSubmitting] = useState(false);
  const [uploading, setUploading] = useState(false);

  const load = useCallback(async () => {
    if (!token) { setScreen('invalid'); return; }

    // 1) 보고서 + 프로그램·신청자 조인
    const { data: r, error: reportErr } = await supabase
      .from('performance_reports')
      .select(`
        *,
        programs (name, program_type),
        participant_applications (name, organization)
      `)
      .eq('audit_token', token)
      .maybeSingle();

    if (reportErr || !r) {
      console.error('[audit-portal] 보고서 조회 실패:', reportErr?.message);
      setScreen('invalid');
      return;
    }
    const reportRow = r as ReportRow;
    setReport(reportRow);
    setOverallComment(reportRow.audit_comment ?? '');

    if (reportRow.audit_submitted_at) {
      setScreen('completed');
      return;
    }

    // 2) 지출증빙 조회 (program_id 우선, 없으면 project_id)
    let q = supabase.from('grant_expenditures').select('*').order('expenditure_date', { ascending: true });
    if (reportRow.program_id) q = q.eq('program_id', reportRow.program_id);
    else if (reportRow.project_id) q = q.eq('project_id', reportRow.project_id);
    const { data: exps, error: expErr } = await q;
    if (expErr) {
      console.error('[audit-portal] 지출 조회 실패:', expErr.message);
      setExpenditures([]);
    } else {
      const list = (exps ?? []) as GrantExpenditure[];
      setExpenditures(list);
      // 기존 notes 값을 초기 의견으로
      const init: Record<string, string> = {};
      list.forEach((e) => { if (e.notes) init[e.id] = e.notes; });
      setAuditComments(init);
    }

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

  const counts = useMemo(() => {
    const acc: Record<FilterTab, number> = { all: expenditures.length, operation: 0, promotion: 0, etc: 0 };
    expenditures.forEach((e) => {
      const tag = `${e.account_code ?? ''} ${e.item_name}`;
      if (FILTER_TABS[1].match(tag)) acc.operation += 1;
      else if (FILTER_TABS[2].match(tag)) acc.promotion += 1;
      else acc.etc += 1;
    });
    return acc;
  }, [expenditures]);

  const visible = useMemo(() => {
    if (filter === 'all') return expenditures;
    return expenditures.filter((e) => {
      const tag = `${e.account_code ?? ''} ${e.item_name}`;
      if (filter === 'operation') return FILTER_TABS[1].match(tag);
      if (filter === 'promotion') return FILTER_TABS[2].match(tag);
      // etc: 운영비/광고홍보비 어디에도 속하지 않는 항목
      return !FILTER_TABS[1].match(tag) && !FILTER_TABS[2].match(tag);
    });
  }, [expenditures, filter]);

  const totals = useMemo(() => {
    const planTotal = report?.total_budget ?? 0;
    const execTotal = report?.total_executed ?? 0;
    const rate = planTotal > 0 ? Math.min((execTotal / planTotal) * 100, 999) : 0;
    return { planTotal, execTotal, rate };
  }, [report]);

  function handleFileSelect(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0] ?? null;
    if (fileRef.current) fileRef.current.value = '';
    if (!f) return;
    if (f.size > 20 * 1024 * 1024) {
      toast.error('파일은 20MB 이하만 업로드할 수 있어요.');
      return;
    }
    setAuditFile(f);
  }

  async function submitAudit() {
    if (!report) return;
    if (!overallComment.trim()) {
      toast.error('종합 감사 의견을 입력해 주세요.');
      return;
    }
    if (!window.confirm('감사를 최종 제출할게요. 제출 후에는 수정이 불가해요.')) return;

    setSubmitting(true);
    try {
      // 1) PDF 업로드 (선택)
      let auditReportUrl: string | null = report.audit_report_url ?? null;
      if (auditFile) {
        setUploading(true);
        try {
          const ext = getFileExtension(auditFile);
          const base = safeFileBase(auditFile.name);
          const projectKey = report.project_id ?? report.program_id ?? report.id;
          const path = STORAGE_PATHS.auditReport(projectKey, `audit_${Date.now()}_${base}.${ext}`);
          const result = await uploadFile(STORAGE_BUCKETS.AUDIT_REPORTS, path, auditFile);
          auditReportUrl = result.url;
        } catch (err) {
          const m = err instanceof Error ? err.message : '파일 업로드에 실패했어요.';
          console.error('[audit-portal] 리포트 업로드 실패:', m);
          toast.error(m);
          return;
        } finally {
          setUploading(false);
        }
      }

      // 2) performance_reports UPDATE
      const { error: updErr } = await supabase
        .from('performance_reports')
        .update({
          audit_comment:      overallComment.trim(),
          audit_report_url:   auditReportUrl,
          audit_submitted_at: new Date().toISOString(),
          updated_at:         new Date().toISOString(),
        })
        .eq('audit_token', token);
      if (updErr) {
        console.error('[audit-portal] 감사 제출 실패:', updErr.message);
        toast.error('감사 제출 중 오류가 발생했어요. 다시 시도해 주세요.');
        return;
      }

      // 3) 항목별 의견 저장 (notes 컬럼 활용)
      const updates = Object.entries(auditComments).filter(([, v]) => v.trim());
      const results = await Promise.all(
        updates.map(([expId, c]) =>
          supabase.from('grant_expenditures').update({ notes: c.trim() }).eq('id', expId),
        ),
      );
      const failedItems = results.filter((r) => r.error).length;
      if (failedItems > 0) {
        console.error(`[audit-portal] 항목 의견 ${failedItems}건 저장 실패`);
        toast.warning(`종합 의견은 제출됐지만 ${failedItems}건의 항목 의견 저장에 실패했어요.`);
      } else {
        toast.success('감사를 제출했어요. 담당 PM에게 결과가 전달돼요.');
      }
      setScreen('completed');
      window.scrollTo({ top: 0, behavior: 'smooth' });
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
    return (
      <ErrorCard
        icon={<ShieldAlert size={32} className="mx-auto text-rose-400" />}
        title="유효하지 않은 감사 링크예요"
        message="링크를 다시 확인해 주세요. 문제가 계속되면 담당 PM에게 문의해 주세요."
      />
    );
  }

  if (!report) return null;

  const programName = report.programs?.name ?? '프로그램';
  const orgName = report.company_name ?? report.participant_applications?.organization ?? '-';

  return (
    <div className="min-h-screen bg-gradient-to-b from-slate-50 to-violet-50/30 px-4 py-6 sm:py-10">
      <div className="max-w-3xl mx-auto space-y-4">
        {/* 헤더 */}
        <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider inline-flex items-center gap-1">
            <FileSearch size={11} aria-hidden="true" />
            회계감사 포털
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#1E1B4B]">{programName}</h1>
          <p className="mt-1 text-xs text-slate-500">
            기업명 <span className="font-bold text-violet-700">{orgName}</span>
            {report.manager_name && <span> · 담당자 {report.manager_name}</span>}
          </p>
          <p className="mt-2 text-[11px] text-slate-500 bg-amber-50 border border-amber-100 rounded-lg px-3 py-2">
            ⓘ 이 페이지는 지정된 회계사무소 전용이에요. 링크를 외부에 공유하지 말아 주세요.
          </p>
        </header>

        {/* 완료 상태 배너 */}
        {screen === 'completed' && (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-5 space-y-1">
            <p className="text-sm font-bold text-emerald-900 flex items-center gap-2">
              <CheckCircle2 size={16} aria-hidden="true" />
              감사가 완료됐어요
            </p>
            <p className="text-xs text-emerald-800">
              제출일{' '}
              <span className="font-semibold tabular-nums">
                {report.audit_submitted_at ? formatDateKo(report.audit_submitted_at) : '-'}
              </span>{' '}
              · 담당 PM에게 결과가 전달됐어요.
            </p>
          </div>
        )}

        {/* 섹션 1 — 정산총괄표 */}
        <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-3">
          <h2 className="text-base font-bold text-[#1E1B4B]">정산총괄표</h2>
          <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 overflow-x-auto">
            <table className="w-full text-sm">
              <thead className="text-xs text-slate-500">
                <tr>
                  <th className="text-left px-2 py-1 font-semibold">구분</th>
                  <th className="text-right px-2 py-1 font-semibold">계획</th>
                  <th className="text-right px-2 py-1 font-semibold">집행</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-violet-100 tabular-nums">
                <SumRow label="총사업비" plan={report.total_budget} exec={report.total_executed} />
                <SumRow label="지원금"   plan={report.grant_budget} exec={report.grant_executed} />
                <SumRow label="자부담"   plan={report.self_budget}  exec={report.self_executed} />
              </tbody>
            </table>
          </div>
          {totals.planTotal > 0 && (
            <div className="space-y-1">
              <div className="flex items-center justify-between text-[11px] text-slate-500">
                <span>집행률</span>
                <span className="font-bold text-violet-700 tabular-nums">{totals.rate.toFixed(1)}%</span>
              </div>
              <div className="h-2 bg-slate-100 rounded-full overflow-hidden">
                <div
                  className="h-full bg-violet-500 transition-[width] duration-500"
                  style={{ width: `${Math.min(totals.rate, 100)}%` }}
                />
              </div>
            </div>
          )}
        </section>

        {/* 섹션 2 — 지출증빙 */}
        <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-3">
          <h2 className="text-base font-bold text-[#1E1B4B]">지출증빙 ({expenditures.length})</h2>

          <nav role="tablist" className="flex flex-wrap items-center gap-1.5">
            {FILTER_TABS.map((t) => {
              const active = filter === t.key;
              return (
                <button
                  key={t.key}
                  type="button"
                  role="tab"
                  aria-selected={active}
                  onClick={() => setFilter(t.key)}
                  className={[
                    'inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors',
                    active ? 'bg-violet-600 text-white shadow-sm' : 'bg-white text-slate-600 border border-slate-200 hover:bg-slate-50',
                  ].join(' ')}
                >
                  {t.label}
                  <span className={['inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px]',
                    active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'].join(' ')}>
                    {counts[t.key]}
                  </span>
                </button>
              );
            })}
          </nav>

          {visible.length === 0 ? (
            <div className="rounded-xl border border-slate-200 bg-slate-50 px-4 py-6 text-center text-sm text-slate-500">
              해당 조건의 지출 항목이 없어요.
            </div>
          ) : (
            <ul className="space-y-3">
              {visible.map((exp, idx) => (
                <li key={exp.id}>
                  <AuditExpenditureCard
                    index={idx + 1}
                    exp={exp}
                    comment={auditComments[exp.id] ?? ''}
                    onCommentChange={(v) => setAuditComments((p) => ({ ...p, [exp.id]: v }))}
                    disabled={screen === 'completed' || submitting}
                  />
                </li>
              ))}
            </ul>
          )}
        </section>

        {/* 섹션 3 — 종합 의견 + 제출 */}
        <AuditSubmitSection
          overallComment={overallComment}
          onCommentChange={setOverallComment}
          auditFile={auditFile}
          onFileSelect={handleFileSelect}
          onFileClear={() => setAuditFile(null)}
          existingReportUrl={report.audit_report_url}
          fileRef={fileRef}
          isCompleted={screen === 'completed'}
          submitting={submitting}
          uploading={uploading}
          onSubmit={() => void submitAudit()}
        />

        <p className="text-center text-[10px] text-slate-400 py-2">© 2026 (주)밸런스닷 · WorkFlow</p>
      </div>
    </div>
  );
}

function SumRow({ label, plan, exec }: { label: string; plan: number | null; exec: number | null }) {
  return (
    <tr>
      <td className="px-2 py-1.5 text-xs font-semibold text-[#1E1B4B]">{label}</td>
      <td className="px-2 py-1.5 text-right">{plan != null ? formatMoney(plan) : '-'}</td>
      <td className="px-2 py-1.5 text-right">{exec != null ? formatMoney(exec) : '-'}</td>
    </tr>
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
