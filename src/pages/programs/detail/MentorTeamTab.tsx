// bal24 v2 — STEP-MENTOR-TEAM-VIEW PARTNER(멘토) 담당팀 탭
// performance_reports.mentor_id = auth.uid() 인 보고서 목록 + 모달 호출.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Building2, FileText, NotebookPen, Handshake,
} from 'lucide-react';
import EmptyState from '../../../components/EmptyState';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatMoney } from '../../../lib/utils';
import { supabase } from '../../../lib/supabase';
import { isMissingTableError } from '../../schedule/scheduleUtils';
import {
  REPORT_STATUS_LABELS, type PerformanceReport, type ReportStatus,
} from '../../../types/performanceReport';
import MentorReportViewModal from './MentorReportViewModal';
import MentoringLogModal from './MentoringLogModal';

interface Props {
  programId: string;
}

interface MentorReportRow extends PerformanceReport {
  participant_applications: {
    name: string | null;
    email: string | null;
    organization: string | null;
  } | null;
}

const STATUS_CLASS: Record<ReportStatus, string> = {
  draft:     'bg-slate-100 text-slate-700 border-slate-200',
  submitted: 'bg-cyan-50 text-cyan-700 border-cyan-200',
  reviewing: 'bg-amber-50 text-amber-700 border-amber-200',
  approved:  'bg-emerald-50 text-emerald-700 border-emerald-200',
  rejected:  'bg-rose-50 text-rose-700 border-rose-200',
};

const SELECT_COLUMNS = `
  *,
  participant_applications (
    name,
    email,
    organization
  )
`;

export default function MentorTeamTab({ programId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [items, setItems] = useState<MentorReportRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [mentorStaffPoolId, setMentorStaffPoolId] = useState<string | null>(null);
  const [reportTarget, setReportTarget] = useState<MentorReportRow | null>(null);
  const [logTarget, setLogTarget] = useState<MentorReportRow | null>(null);

  const refresh = useCallback(async () => {
    if (!user) {
      setItems([]);
      setLoading(false);
      return;
    }
    setLoading(true);

    // 1) 멘토 본인의 staff_pool_id (활동일지 INSERT 시 expert_id 로 사용)
    const { data: profile } = await supabase
      .from('profiles')
      .select('staff_pool_id')
      .eq('id', user.id)
      .maybeSingle();
    const staffPoolId = (profile?.staff_pool_id as string | null | undefined) ?? null;
    setMentorStaffPoolId(staffPoolId);

    // 2) 본인이 멘토로 배정된 보고서 목록
    const { data, error } = await supabase
      .from('performance_reports')
      .select(SELECT_COLUMNS)
      .eq('mentor_id', user.id)
      .eq('program_id', programId)
      .order('created_at', { ascending: false });

    if (error) {
      if (isMissingTableError(error.message)) {
        setTableMissing(true);
        setItems([]);
      } else {
        console.error('[mentor-team] 조회 실패:', error.message);
        toast.error('담당팀 목록을 불러오지 못했어요.');
        setItems([]);
      }
    } else {
      setTableMissing(false);
      setItems((data ?? []) as MentorReportRow[]);
    }
    setLoading(false);
  }, [user, programId, toast]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const teamCount = useMemo(() => items.length, [items]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12 text-slate-500">
        <Loader2 size={20} className="animate-spin text-violet-400 mr-2" aria-hidden="true" />
        불러오는 중…
      </div>
    );
  }

  if (tableMissing) {
    return (
      <div className="max-w-2xl rounded-2xl border border-amber-200 bg-amber-50 p-6 text-sm text-amber-900">
        <p className="font-bold">보고서 테이블이 아직 만들어지지 않았어요.</p>
        <p className="mt-1 text-xs">관리자가 SQL 마이그레이션을 실행하면 사용할 수 있어요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-1.5">
          <Handshake size={18} className="text-violet-600" aria-hidden="true" />
          담당팀 ({teamCount})
        </h2>
      </header>

      {teamCount === 0 ? (
        <EmptyState emoji="🤝" title="배정된 팀이 없어요" description="PM에게 문의해 주세요." />
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
          {items.map((r) => {
            const company = r.company_name ?? r.participant_applications?.organization ?? '-';
            const manager = r.manager_name ?? r.participant_applications?.name ?? '-';
            const isDraft = r.status === 'draft';
            return (
              <article
                key={r.id}
                className={[
                  'rounded-2xl border p-4 space-y-3 shadow-[0_4px_16px_rgba(124,58,237,0.04)]',
                  isDraft ? 'bg-slate-50 border-slate-200' : 'bg-white border-violet-100',
                ].join(' ')}
              >
                <div className="flex items-start justify-between gap-2">
                  <div className="flex items-center gap-2 min-w-0">
                    <Building2 size={16} className="text-violet-600 shrink-0" aria-hidden="true" />
                    <h3 className="text-sm font-bold text-[#1E1B4B] truncate">{company}</h3>
                  </div>
                  <span className={`inline-flex items-center text-[10px] font-semibold px-2 py-0.5 rounded-md border whitespace-nowrap ${STATUS_CLASS[r.status]}`}>
                    {REPORT_STATUS_LABELS[r.status]}
                  </span>
                </div>

                <div className="text-xs text-slate-600 space-y-0.5">
                  <p>담당자: <span className="font-semibold text-[#1E1B4B]">{manager}</span></p>
                  <p>
                    집행액:{' '}
                    <span className="font-semibold text-[#1E1B4B] tabular-nums">
                      {r.total_executed != null ? formatMoney(r.total_executed) : '-'}
                    </span>
                  </p>
                  {r.mentor_feedback && (
                    <p className="text-[11px] text-violet-700 mt-1.5 line-clamp-2">
                      💬 {r.mentor_feedback}
                    </p>
                  )}
                </div>

                {isDraft ? (
                  <p className="text-[11px] text-slate-500 italic">아직 보고서를 제출하지 않았어요.</p>
                ) : null}

                <div className="flex items-center gap-1.5 pt-1">
                  <button
                    type="button"
                    onClick={() => setReportTarget(r)}
                    disabled={isDraft}
                    className={[
                      'inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border transition-colors',
                      isDraft
                        ? 'border-slate-200 text-slate-300 cursor-not-allowed'
                        : 'border-violet-200 text-violet-700 hover:bg-violet-50',
                    ].join(' ')}
                  >
                    <FileText size={11} aria-hidden="true" />
                    보고서 열람
                  </button>
                  <button
                    type="button"
                    onClick={() => setLogTarget(r)}
                    className="inline-flex items-center gap-1 text-[11px] px-2 py-1 rounded-md border border-emerald-200 text-emerald-700 hover:bg-emerald-50"
                  >
                    <NotebookPen size={11} aria-hidden="true" />
                    멘토링 일지 작성
                  </button>
                </div>
              </article>
            );
          })}
        </div>
      )}

      {reportTarget && (
        <MentorReportViewModal
          report={reportTarget}
          onClose={() => setReportTarget(null)}
          onFeedbackSaved={() => { void refresh(); setReportTarget(null); }}
        />
      )}

      {logTarget && (
        <MentoringLogModal
          programId={programId}
          applicationId={logTarget.application_id ?? null}
          mentorStaffPoolId={mentorStaffPoolId}
          onClose={() => setLogTarget(null)}
          onSaved={() => setLogTarget(null)}
        />
      )}
    </div>
  );
}
