// bal24 v2 — STEP-PM-REPORT-REVIEW 사업실적보고서 검수 탭 (PM)
// 보고서 목록 + 상태 필터 + 상세 모달 + 검토 시작/승인/반려 처리.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, FileBarChart, Eye, ClipboardCheck, Link2, FileSearch,
} from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import {
  REPORT_STATUS_LABELS, type PerformanceReport, type ReportStatus,
} from '../../../types/performanceReport';
import { sendNotification } from '../../../lib/notifyUtils';
import {
  generateAuditToken, copyAuditPortalLink, updateMentorAssignment,
} from './reportReviewUtils';
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

// 상태 → CSS 클래스 (CLAUDE.md 디자인 시스템: 회색/바이올렛/주황/민트)
const STATUS_CLASS: Record<ReportStatus, string> = {
  draft:     'bg-slate-100 text-slate-700 border-slate-200',     // 회색
  submitted: 'bg-violet-50 text-violet-700 border-violet-200',   // 바이올렛
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',      // 검토중 (스펙 미언급, 유지)
  approved:  'bg-cyan-50 text-cyan-700 border-cyan-200',         // 민트 (#06B6D4)
  rejected:  'bg-orange-50 text-orange-700 border-orange-200',   // 주황
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

// PARTNER(멘토) 후보 — 드롭다운에서 사용
interface PartnerOption {
  id: string;
  name: string | null;
}

export default function ReportReviewTab({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<ReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterTab>('all');
  const [acting, setActing] = useState(false);
  const [target, setTarget] = useState<ReportRow | null>(null);
  const [partners, setPartners] = useState<PartnerOption[]>([]);
  // STEP-EMAIL-NOTIFY — 반려 메일 발송 시 프로그램명 사용
  const [programName, setProgramName] = useState<string>('');

  const refresh = useCallback(async () => {
    setLoading(true);
    const [reportsRes, partnersRes, progRes] = await Promise.all([
      supabase.from('performance_reports').select(SELECT_COLUMNS).eq('program_id', programId).order('submitted_at', { ascending: false, nullsFirst: false }),
      supabase.from('profiles').select('id, name').eq('role', 'partner').order('name', { ascending: true }),
      supabase.from('programs').select('name').eq('id', programId).maybeSingle(),
    ]);
    setProgramName(((progRes.data?.name as string | undefined) ?? ''));

    const { data, error } = reportsRes;
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

    if (partnersRes.error) {
      console.error('[report-review] 멘토 후보 조회 실패:', partnersRes.error.message);
      setPartners([]);
    } else {
      setPartners((partnersRes.data ?? []) as PartnerOption[]);
    }

    setLoading(false);
  }, [programId, toast]);

  // STEP-AUDIT-TOKEN-UI — 감사 의뢰 (audit_token 발급)
  async function requestAudit(reportId: string) {
    if (!window.confirm('회계사무소 감사를 의뢰할까요?\n감사 링크가 생성돼요.')) return;
    setActing(true);
    const r = await generateAuditToken(reportId);
    setActing(false);
    if (!r.ok) { toast.error('감사 의뢰 중 오류가 발생했어요.'); return; }
    toast.success('감사 링크가 생성됐어요.');
    await refresh();
  }

  // 감사 포털 링크 복사
  async function copyAuditLink(auditToken: string) {
    const r = await copyAuditPortalLink(auditToken);
    if (r.ok) toast.success('감사 링크를 클립보드에 복사했어요.');
    else toast.error('링크 복사에 실패했어요. 직접 복사해 주세요.');
  }

  // 멘토 배정/해제
  async function assignMentor(reportId: string, mentorId: string | null) {
    setActing(true);
    const r = await updateMentorAssignment(reportId, mentorId);
    setActing(false);
    if (!r.ok) { toast.error('멘토 배정 중 오류가 발생했어요.'); return; }
    toast.success(mentorId ? '멘토를 배정했어요.' : '멘토 배정을 해제했어요.');
    await refresh();
  }

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

  // 검토 시작: submitted → reviewing (멱등 처리 — `.eq('status','submitted')` 가드)
  async function startReview(reportId: string) {
    setActing(true);
    const { error } = await supabase.from('performance_reports')
      .update({ status: 'reviewing', pm_reviewed_by: user?.id ?? null, updated_at: new Date().toISOString() })
      .eq('id', reportId).eq('status', 'submitted');
    setActing(false);
    if (error) {
      console.error('[report-review] 검토 시작 실패:', error.message);
      toast.error('검토 시작 중 오류가 발생했어요.'); return;
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
    if (!reason.trim()) { toast.error('반려 사유를 입력해 주세요.'); return; }
    // 발송 직전 수신자 정보 캡처 (refresh 후 target 이 null 이 될 수 있음)
    const row = items.find((r) => r.id === reportId);
    const recipientEmail = row?.participant_applications?.email?.trim() ?? '';
    const recipientName = row?.manager_name ?? row?.participant_applications?.name ?? '';
    setActing(true);
    const { error } = await supabase
      .from('performance_reports')
      .update({
        status: 'rejected', reject_reason: reason.trim(), pm_comment: reason.trim(),
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
    // STEP-EMAIL-NOTIFY — 보고서 반려 이메일 (fire-and-forget)
    if (recipientEmail && recipientName) {
      void sendNotification({
        type: 'returned', recipientEmail, recipientName,
        programTitle: programName, rejectReason: reason.trim(),
      });
    }
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
                <th className="text-left px-3 py-2.5 font-semibold whitespace-nowrap">멘토</th>
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
                    <td className="px-3 py-2.5 text-xs">
                      <select
                        value={r.mentor_id ?? ''}
                        onChange={(e) => void assignMentor(r.id, e.target.value || null)}
                        disabled={acting}
                        className="text-[11px] rounded-md border border-slate-200 bg-white px-1.5 py-1 text-slate-700 focus:border-violet-300 focus:ring-1 focus:ring-violet-200 disabled:opacity-50"
                      >
                        <option value="">미배정</option>
                        {partners.map((p) => (
                          <option key={p.id} value={p.id}>{p.name ?? p.id.slice(0, 8)}</option>
                        ))}
                      </select>
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
                      {r.status === 'approved' && !r.audit_token && (
                        <button type="button" onClick={() => void requestAudit(r.id)} disabled={acting}
                          title="회계사무소 감사 링크를 생성해요"
                          className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md border border-orange-200 text-orange-700 hover:bg-orange-50 disabled:opacity-50">
                          <FileSearch size={11} aria-hidden="true" />
                          감사 의뢰
                        </button>
                      )}
                      {r.audit_token && (
                        <button type="button" onClick={() => void copyAuditLink(r.audit_token as string)}
                          title={r.audit_submitted_at ? '감사 완료됨 (재발송용)' : '감사 링크 복사'}
                          className="inline-flex items-center gap-0.5 text-[11px] px-2 py-1 rounded-md border border-cyan-200 text-cyan-700 hover:bg-cyan-50">
                          <Link2 size={11} aria-hidden="true" />
                          감사링크
                        </button>
                      )}
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
