// bal24 v2 — STEP-PM-REPORT-REVIEW 사업실적보고서 검수 탭 (PM)
// 보고서 목록 + 상태 필터 + 상세 모달 + 검토 시작/승인/반려 처리.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, FileBarChart, Eye, ClipboardCheck,
} from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import {
  REPORT_STATUS_LABELS, type PerformanceReport, type ReportStatus,
} from '../../../types/performanceReport';
import ReportReviewModal from './ReportReviewModal';

interface Props {
  programId: string;
}

type FilterTab = 'all' | ReportStatus;

const FILTER_TABS: { key: FilterTab; label: string }[] = [
  { key: 'all',       label: '전체' },
  { key: 'submitted', label: REPORT_STATUS_LABELS.submitted },
  { key: 'reviewing', label: REPORT_STATUS_LABELS.reviewing },
  { key: 'approved',  label: REPORT_STATUS_LABELS.approved },
  { key: 'rejected',  label: REPORT_STATUS_LABELS.rejected },
  { key: 'draft',     label: REPORT_STATUS_LABELS.draft },
];

// 상태 → CSS 클래스 (statusStyles 패턴)
const STATUS_CLASS: Record<ReportStatus, string> = {
  draft:     'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-rose-50 text-rose-700 border-rose-200',
};

// 신청자 정보 join 결과 (PostgREST nested select)
interface ReportRow extends PerformanceReport {
  participant_applications: {
    name: string | null;
    email: string | null;
    organization: string | null;
  } | null;
}

const SELECT_COLUMNS = `
  *,
  participant_applications (
    name,
    email,
    organization
  )
`;

export default function ReportReviewTab({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [acting, setActing] = useState(false);
  const [target, setTarget] = useState<ReportRow | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('performance_reports')
      .select(SELECT_COLUMNS)
      .eq('program_id', programId)
      .order('submitted_at', { ascending: false, nullsFirst: false });

    if (error) {
      const msg = error.message?.toLowerCase() ?? '';
      // 테이블 미존재(PGRST205) — 빈 목록으로 처리
      if (msg.includes('pgrst205') || msg.includes('does not exist')) {
        setItems([]);
      } else {
        console.error('[report-review] 조회 실패:', error.message);
        toast.error('보고서 목록을 불러오지 못했어요.');
        setItems([]);
      }
    } else {
      setItems((data ?? []) as ReportRow[]);
    }
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

  const counts = useMemo(() => {
    const acc: Record<FilterTab, number> = {
      all: items.length, draft: 0, submitted: 0, reviewing: 0, approved: 0, rejected: 0,
    };
    items.forEach((r) => { acc[r.status] += 1; });
    return acc;
  }, [items]);

  const visible = useMemo(() => {
    if (filter === 'all') return items;
    return items.filter((r) => r.status === filter);
  }, [items, filter]);

  // 검토 시작: submitted → reviewing (멱등 처리)
  async function startReview(reportId: string) {
    setActing(true);
    const { error } = await supabase
      .from('performance_reports')
      .update({
        status: 'reviewing',
        pm_reviewed_by: user?.id ?? null,
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId)
      .eq('status', 'submitted');
    setActing(false);
    if (error) {
      console.error('[report-review] 검토 시작 실패:', error.message);
      toast.error('검토 시작 중 오류가 발생했어요.');
      return;
    }
    toast.success('검토를 시작했어요.');
    await refresh();
  }

  async function approveReport(reportId: string, comment: string) {
    setActing(true);
    const { error } = await supabase
      .from('performance_reports')
      .update({
        status: 'approved',
        pm_comment: comment.trim() || null,
        pm_reviewed_by: user?.id ?? null,
        pm_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    setActing(false);
    if (error) {
      console.error('[report-review] 승인 처리 실패:', error.message);
      toast.error('승인 처리 중 오류가 발생했어요.');
      return;
    }
    toast.success('보고서를 승인했어요.');
    setTarget(null);
    await refresh();
  }

  async function rejectReport(reportId: string, reason: string) {
    if (!reason.trim()) {
      toast.error('반려 사유를 입력해 주세요.');
      return;
    }
    setActing(true);
    const { error } = await supabase
      .from('performance_reports')
      .update({
        status: 'rejected',
        reject_reason: reason.trim(),
        pm_comment: reason.trim(),
        pm_reviewed_by: user?.id ?? null,
        pm_reviewed_at: new Date().toISOString(),
        updated_at: new Date().toISOString(),
      })
      .eq('id', reportId);
    setActing(false);
    if (error) {
      console.error('[report-review] 반려 처리 실패:', error.message);
      toast.error('반려 처리 중 오류가 발생했어요.');
      return;
    }
    toast.success('보고서를 반려했어요.');
    setTarget(null);
    await refresh();
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 size={20} className="animate-spin text-violet-400 mr-2" aria-hidden="true" />
        불러오는 중…
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 헤더 */}
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <FileBarChart size={18} className="text-violet-600" aria-hidden="true" />
          사업실적보고서 ({items.length})
        </h2>
      </header>

      {/* 필터 탭 */}
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

      {/* 테이블 */}
      {visible.length === 0 ? (
        <EmptyState emoji="📭" title="제출된 보고서가 없어요" />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold">기업명</th>
                <th className="text-left px-3 py-2.5 font-semibold">담당자</th>
                <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">제출일</th>
                <th className="text-center px-3 py-2.5 font-semibold">상태</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">집행액</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">사진</th>
                <th className="text-right px-3 py-2.5 font-semibold">액션</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r) => {
                const company = r.company_name ?? r.participant_applications?.organization ?? '-';
                const manager = r.manager_name ?? r.participant_applications?.name ?? '-';
                const photoCount = r.photo_urls?.length ?? 0;
                const isProcessed = r.status === 'approved' || r.status === 'rejected';
                return (
                  <tr key={r.id} className="hover:bg-violet-50/40 transition-colors">
                    <td className="px-3 py-2.5">
                      <button type="button" onClick={() => setTarget(r)} className="text-violet-700 hover:underline font-semibold text-left">
                        {company}
                      </button>
                      {r.participant_applications?.email && (
                        <p className="text-[11px] text-slate-400">{r.participant_applications.email}</p>
                      )}
                    </td>
                    <td className="px-3 py-2.5 text-xs text-slate-600">{manager}</td>
                    <td className="px-3 py-2.5 text-[11px] text-slate-500 tabular-nums whitespace-nowrap">
                      {r.submitted_at ? formatDateKo(r.submitted_at) : '-'}
                    </td>
                    <td className="px-3 py-2.5 text-center">
                      <span className={`inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border ${STATUS_CLASS[r.status]}`}>
                        {REPORT_STATUS_LABELS[r.status]}
                      </span>
                    </td>
                    <td className="px-3 py-2.5 text-right text-xs tabular-nums">
                      {r.total_executed != null ? formatMoney(r.total_executed) : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-center text-xs text-slate-500 tabular-nums">
                      {photoCount > 0 ? `${photoCount}장` : <span className="text-slate-300">-</span>}
                    </td>
                    <td className="px-3 py-2.5 text-right space-x-1 whitespace-nowrap">
                      {r.status === 'submitted' && (
                        <button type="button" onClick={() => void startReview(r.id)} disabled={acting}
                          className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md bg-amber-50 text-amber-700 hover:bg-amber-100 disabled:opacity-50">
                          <ClipboardCheck size={11} aria-hidden="true" />
                          검토 시작
                        </button>
                      )}
                      <button type="button" onClick={() => setTarget(r)}
                        className={[
                          'inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md border',
                          isProcessed
                            ? 'border-slate-200 text-slate-600 hover:bg-slate-50'
                            : 'border-violet-200 text-violet-700 hover:bg-violet-50',
                        ].join(' ')}>
                        <Eye size={11} aria-hidden="true" />
                        {isProcessed ? '열람' : '검토'}
                      </button>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      )}

      {target && (
        <ReportReviewModal
          report={target}
          onClose={() => setTarget(null)}
          onApprove={(comment) => void approveReport(target.id, comment)}
          onReject={(reason) => void rejectReport(target.id, reason)}
          acting={acting}
        />
      )}
    </div>
  );
}
