// bal24 v2 — 프로젝트 결과보고서 페이지
// 자동 집계 → 섹션별 편집 → 저장 → PDF → 제출 → 정산 워크플로우

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Link, useParams } from 'react-router-dom';
import {
  ArrowLeft, Loader2, RefreshCw, Save, Download, Send, FileText, ExternalLink,
} from 'lucide-react';
import { Badge, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatMoney } from '../../lib/utils';
import {
  aggregateReportData, buildReportContent, formatKoreanDate,
  generateReportPDF, uploadReportPDF,
} from './reportUtils';
import type {
  ProjectReport, ProjectSettlementRow, ReportContent, ReportStatus,
} from '../../types/database';
import ReportSettlementBar from './ReportSettlementBar';
import { ReadonlyField, Section, TextareaField } from './ReportSectionFields';

type ProjectInfo = { id: string; name: string };

const STATUS_LABEL: Record<ReportStatus, string> = {
  draft: '초안', submitted: '제출됨', approved: '승인', rejected: '반려',
};

function statusBadgeVariant(s: ReportStatus) {
  switch (s) {
    case 'submitted': return 'primary' as const;
    case 'approved':  return 'success' as const;
    case 'rejected':  return 'danger' as const;
    default:           return 'default' as const;
  }
}

export default function ProjectReportPage() {
  const { projectId } = useParams<{ projectId: string }>();
  const { user } = useAuth();
  const [project, setProject] = useState<ProjectInfo | null>(null);
  const [report, setReport] = useState<ProjectReport | null>(null);
  const [settlement, setSettlement] = useState<ProjectSettlementRow | null>(null);
  const [content, setContent] = useState<ReportContent>({});
  const [title, setTitle] = useState('');
  const [loading, setLoading] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [aggregating, setAggregating] = useState(false);
  const [saving, setSaving] = useState(false);
  const [generatingPdf, setGeneratingPdf] = useState(false);
  const [submitting, setSubmitting] = useState(false);

  const fetchData = useCallback(async () => {
    if (!projectId) return;
    setLoading(true);
    setErrorMsg(null);
    try {
      const [pR, rR, sR] = await Promise.all([
        // STEP-TRASH-FILTER-AUDIT — 휴지통 프로젝트 리포트 페이지 차단
        supabase.from('projects').select('id, name').eq('id', projectId).is('deleted_at', null).maybeSingle(),
        supabase.from('project_reports').select('*').eq('project_id', projectId).order('created_at', { ascending: false }).limit(1).maybeSingle(),
        supabase.from('project_settlements').select('*').eq('project_id', projectId).maybeSingle(),
      ]);
      if (pR.error) throw pR.error;
      if (!pR.data) { setErrorMsg('프로젝트를 찾을 수 없어요.'); return; }
      setProject(pR.data as ProjectInfo);

      if (rR.error) console.error('[report] 보고서 조회 실패:', rR.error.message);
      if (sR.error) console.error('[report] 정산 조회 실패:', sR.error.message);

      const r = (rR.data ?? null) as ProjectReport | null;
      setReport(r);
      setContent(r?.content ?? {});
      setTitle(r?.title ?? `${(pR.data as ProjectInfo).name} 결과보고서`);
      setSettlement((sR.data ?? null) as ProjectSettlementRow | null);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[report] 조회 실패:', raw);
      setErrorMsg('데이터를 불러오지 못했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setLoading(false);
    }
  }, [projectId]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const isReadonly = useMemo(() => report?.status === 'submitted' || report?.status === 'approved', [report]);

  const handleAggregate = async () => {
    if (!projectId) return;
    setAggregating(true);
    setErrorMsg(null);
    try {
      const data = await aggregateReportData(projectId);
      const draft = buildReportContent(data);
      // notes는 사용자 입력 보존
      setContent((prev) => ({ ...draft, notes: prev.notes ?? '' }));
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[report] 집계 실패:', raw);
      setErrorMsg(raw || '자동 집계 중 오류가 발생했어요.');
    } finally {
      setAggregating(false);
    }
  };

  const handleSave = async (): Promise<ProjectReport | null> => {
    if (!projectId) return null;
    setSaving(true);
    setErrorMsg(null);
    try {
      const payload = {
        project_id: projectId,
        title: title.trim() || '결과보고서',
        report_type: report?.report_type ?? 'final',
        content,
      };
      if (report) {
        const { data, error } = await supabase
          .from('project_reports')
          .update(payload).eq('id', report.id).select('*').single();
        if (error) throw error;
        const next = data as ProjectReport;
        setReport(next);
        return next;
      } else {
        const { data, error } = await supabase
          .from('project_reports')
          .insert({ ...payload, created_by: user?.id ?? null })
          .select('*').single();
        if (error) throw error;
        const next = data as ProjectReport;
        setReport(next);
        return next;
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[report] 저장 실패:', raw);
      const m = raw.toLowerCase();
      setErrorMsg(m.includes('row-level security') ? '저장 권한이 없어요.' : '저장 중 오류가 발생했어요.');
      return null;
    } finally {
      setSaving(false);
    }
  };

  const handleGeneratePDF = async () => {
    if (!projectId || !project) return;
    setGeneratingPdf(true);
    setErrorMsg(null);
    try {
      const blob = await generateReportPDF(title || '결과보고서', content, project.name);
      const url = await uploadReportPDF(blob, projectId);
      // 다운로드도 동시 트리거
      const a = document.createElement('a');
      a.href = url;
      a.download = `${title || '결과보고서'}_${new Date().toISOString().slice(0, 10)}.pdf`;
      a.target = '_blank';
      document.body.appendChild(a);
      a.click();
      document.body.removeChild(a);
      // pdf_url 저장 (이미 보고서가 있으면)
      if (report) {
        const { error } = await supabase.from('project_reports').update({ pdf_url: url }).eq('id', report.id);
        if (error) console.error('[report] pdf_url 저장 실패:', error.message);
        else setReport({ ...report, pdf_url: url });
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[report] PDF 생성 실패:', raw);
      setErrorMsg(raw || 'PDF 생성 중 오류가 발생했어요.');
    } finally {
      setGeneratingPdf(false);
    }
  };

  const handleSubmit = async () => {
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const saved = report ?? await handleSave();
      if (!saved) { setSubmitting(false); return; }
      const { data: updated, error } = await supabase
        .from('project_reports')
        .update({
          status: 'submitted',
          submitted_at: new Date().toISOString(),
          submitted_by: user?.id ?? null,
        })
        .eq('id', saved.id)
        .select('*').single();
      if (error) throw error;
      setReport(updated as ProjectReport);
      // project_settlements upsert: current_step=1 + report_id
      if (projectId) {
        const upsertPayload = {
          project_id: projectId,
          report_id: saved.id,
          current_step: 1,
        };
        const existing = settlement?.id;
        const { error: sErr } = existing
          ? await supabase.from('project_settlements').update(upsertPayload).eq('id', existing)
          : await supabase.from('project_settlements').insert(upsertPayload);
        if (sErr) console.error('[report] 정산 upsert 실패:', sErr.message);
      }
      await fetchData();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[report] 제출 실패:', raw);
      setErrorMsg('제출 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center py-20 text-sm text-muted">
        <Loader2 size={18} className="animate-spin mr-2" />
        불러오는 중…
      </div>
    );
  }
  if (errorMsg && !project) {
    return (
      <div className="space-y-3">
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
        <Link to="/projects" className="inline-flex items-center gap-1.5 text-sm text-primary hover:underline">
          <ArrowLeft size={14} />프로젝트 목록으로
        </Link>
      </div>
    );
  }
  if (!project) return null;

  const status: ReportStatus = report?.status ?? 'draft';

  return (
    <div className="space-y-5 max-w-[1100px]">
      <div className="space-y-2">
        <Link to={`/projects/${project.id}`} className="inline-flex items-center gap-1.5 text-xs text-muted hover:text-primary">
          <ArrowLeft size={12} />프로젝트 상세
        </Link>
        <div className="flex flex-wrap items-center justify-between gap-3">
          <div className="space-y-1">
            <h1 className="text-2xl font-bold text-text">{project.name}</h1>
            <div className="flex items-center gap-2 flex-wrap">
              <Badge variant={statusBadgeVariant(status)}>{STATUS_LABEL[status]}</Badge>
              {report?.submitted_at && <span className="text-xs text-muted">제출 {formatKoreanDate(report.submitted_at)}</span>}
              {report?.approved_at && <span className="text-xs text-muted">승인 {formatKoreanDate(report.approved_at)}</span>}
            </div>
          </div>
          <div className="flex items-center gap-2 flex-wrap">
            <Button variant="outline" leftIcon={<RefreshCw size={14} />} onClick={() => void handleAggregate()} loading={aggregating} disabled={isReadonly}>
              자동 집계
            </Button>
            <Button variant="outline" leftIcon={<Download size={14} />} onClick={() => void handleGeneratePDF()} loading={generatingPdf}>
              PDF 다운로드
            </Button>
            <Button variant="outline" leftIcon={<Save size={14} />} onClick={() => void handleSave()} loading={saving} disabled={isReadonly}>
              저장
            </Button>
            <Button variant="primary" leftIcon={<Send size={14} />} onClick={() => void handleSubmit()} loading={submitting} disabled={status === 'submitted' || status === 'approved'}>
              제출
            </Button>
          </div>
        </div>
        {report?.pdf_url && (
          <a href={report.pdf_url} target="_blank" rel="noreferrer noopener"
            className="inline-flex items-center gap-1 text-xs text-primary hover:underline">
            <FileText size={12} />최근 PDF 보기 <ExternalLink size={11} />
          </a>
        )}
      </div>

      {report?.status === 'rejected' && report.reject_reason && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm">
          <div className="font-semibold text-danger mb-1">반려 사유</div>
          <p className="text-text whitespace-pre-wrap">{report.reject_reason}</p>
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-3 text-sm text-danger">{errorMsg}</div>
      )}

      <ReportSettlementBar
        settlement={settlement}
        reportSubmitted={status === 'submitted' || status === 'approved'}
        projectId={project.id}
        projectName={project.name}
        onChanged={() => void fetchData()}
      />

      <Input label="보고서 제목" value={title} onChange={(e) => setTitle(e.target.value)} disabled={isReadonly} />

      <Section title="① 사업 개요">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReadonlyField label="기간" value={content.overview?.period ?? '–'} />
          <ReadonlyField label="고객사" value={content.overview?.clientName ?? '–'} />
          <ReadonlyField label="총예산" value={formatMoney(content.overview?.totalBudget) || '–'} />
        </div>
        <TextareaField label="개요 설명" value={content.overview?.description ?? ''}
          onChange={(v) => setContent((p) => ({ ...p, overview: { ...p.overview, description: v } }))}
          disabled={isReadonly} rows={3} />
      </Section>

      <Section title="② 추진 실적">
        {(content.performance?.programs ?? []).length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500"><tr>
                <th className="text-left px-3 py-2 font-semibold">프로그램</th>
                <th className="text-right px-3 py-2 font-semibold">세션 수</th>
                <th className="text-right px-3 py-2 font-semibold">출석 평균</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(content.performance?.programs ?? []).map((pg, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-text">{pg.name}</td>
                    <td className="px-3 py-2 text-right">{pg.sessionCount ?? 0}회</td>
                    <td className="px-3 py-2 text-right">{pg.attendanceRate != null ? `${pg.attendanceRate}` : '–'}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TextareaField label="실적 요약" value={content.performance?.summary ?? ''}
          onChange={(v) => setContent((p) => ({ ...p, performance: { ...p.performance, summary: v } }))}
          disabled={isReadonly} rows={3} />
      </Section>

      <Section title="③ 인력 투입 현황">
        {(content.staff?.experts ?? []).length > 0 && (
          <div className="overflow-x-auto rounded-xl border border-slate-200">
            <table className="w-full text-sm">
              <thead className="bg-slate-50 text-xs text-slate-500"><tr>
                <th className="text-left px-3 py-2 font-semibold">전문가</th>
                <th className="text-right px-3 py-2 font-semibold">투입 시간</th>
                <th className="text-right px-3 py-2 font-semibold">강의확인서</th>
              </tr></thead>
              <tbody className="divide-y divide-slate-100">
                {(content.staff?.experts ?? []).map((e, i) => (
                  <tr key={i}>
                    <td className="px-3 py-2 text-text">{e.name}</td>
                    <td className="px-3 py-2 text-right">{e.logHours.toFixed(1)}h</td>
                    <td className="px-3 py-2 text-right">{e.certCount ?? 0}건</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
        <TextareaField label="인력 요약" value={content.staff?.summary ?? ''}
          onChange={(v) => setContent((p) => ({ ...p, staff: { ...p.staff, summary: v } }))}
          disabled={isReadonly} rows={2} />
      </Section>

      <Section title="④ 예산 집행 현황">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <ReadonlyField label="계획 예산" value={formatMoney(content.budget?.plannedTotal) || '–'} />
          <ReadonlyField label="수입 합계" value={formatMoney(content.budget?.incomeTotal) || '–'} />
          <ReadonlyField label="지출 (총액)" value={formatMoney(content.budget?.expenseGross) || '–'} />
          <ReadonlyField label="실지급 합계" value={formatMoney(content.budget?.expenseNet) || '–'} />
          <ReadonlyField label="잔액 (수입-지출)" value={formatMoney(content.budget?.balance) || '–'} />
        </div>
        <TextareaField label="예산 요약" value={content.budget?.summary ?? ''}
          onChange={(v) => setContent((p) => ({ ...p, budget: { ...p.budget, summary: v } }))}
          disabled={isReadonly} rows={2} />
      </Section>

      <Section title="⑤ 특이사항 및 성과">
        <TextareaField label="" value={content.notes ?? ''}
          onChange={(v) => setContent((p) => ({ ...p, notes: v }))}
          disabled={isReadonly} rows={6}
          placeholder="자유롭게 입력해 주세요. (예: 만족도 조사 결과, 향후 개선점)" />
      </Section>
    </div>
  );
}

