// bal24 v2 — STEP-STAFF-PORTAL-P4 / 박경수님 2026-05-26 양식 보강 + 수정 기능
// 강사 포털 · 일지 탭 — mentoring_logs + activity_logs 통합 목록.
// 멘토링 일지 상세는 PDF 양식과 동일한 표 형태로 출력. canEditMentoringLog 시 [수정] 버튼.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, BookOpen, ListChecks, ChevronDown, ChevronUp, FileText, Pencil, FileDown } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import type { ActivityLogType } from '../../../types/database';
import {
  MENTORING_LOG_STATUS_LABEL, MENTORING_LOG_STATUS_STYLE,
  canEditMentoringLog,
} from '../../../types/mentoring';
import type { StaffPortalIdentity } from '../staffPortalUtils';
import MentoringLogForm, { type MentoringLogInitial } from './MentoringLogForm';
import { fetchLogForPdf } from '../../programs/detail/mentoringLogPdfFetch';
import type { MentoringLogForPdf } from '../../programs/detail/mentoringLogPdf';
import { downloadMentoringLogPdf } from '../../programs/detail/mentoringLogPdf';
import MentoringLogExpandedView from './MentoringLogExpandedView';
import { fetchStaffLogs, type UnifiedLog, type UnifiedKind, type AssignmentLite, type MenteeLite } from './staffLogFetch';

interface Props {
  staff: StaffPortalIdentity;
  selectedProgramId: string | null;
}

type FilterKind = 'all' | UnifiedKind;

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

const ACTIVITY_TYPE_LABEL: Record<ActivityLogType, string> = {
  mentoring: '멘토링', lecture: '강의', business_trip: '출장',
  ta: 'TA', operation: '운영', dispatch: '파견',
};

export default function StaffLogTab({ staff, selectedProgramId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [filter, setFilter] = useState<FilterKind>('all');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 박경수님 2026-05-26 — 수정 진행 중인 일지 id + 수정 모드용 assignment·멘티 캐시
  const [editingLogId, setEditingLogId] = useState<string | null>(null);
  const [assignmentsById, setAssignmentsById] = useState<Map<string, AssignmentLite>>(new Map());
  const [menteesById, setMenteesById] = useState<Map<string, MenteeLite>>(new Map());
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // 박경수님 2026-05-26 — 상세 펼침 시 양식 표용 풀 데이터 캐시 (멘토 정보·사진 URL)
  const [detailByLogId, setDetailByLogId] = useState<Map<string, MentoringLogForPdf>>(new Map());

  const fetchData = useCallback(async () => {
    if (!selectedProgramId) { setLogs([]); setLoading(false); return; }
    setLoading(true);
    const result = await fetchStaffLogs({
      staffId: staff.id, sourceType: staff.sourceType, programId: selectedProgramId,
    });
    setAssignmentsById(result.assignmentsById);
    setMenteesById(result.menteesById);
    setLogs(result.logs);
    if (result.error) toast.error('멘토링 일지 조회 중 오류가 발생했어요.');
    setLoading(false);
  }, [staff.id, staff.sourceType, selectedProgramId, toast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const visible = useMemo(() => filter === 'all' ? logs : logs.filter((l) => l.kind === filter), [logs, filter]);
  const counts = useMemo(() => ({
    all: logs.length,
    mentoring: logs.filter((l) => l.kind === 'mentoring').length,
    activity: logs.filter((l) => l.kind === 'activity').length,
  }), [logs]);

  async function handleDownloadPdf(logId: string) {
    setDownloadingId(logId);
    // 캐시된 detail 재사용 (양식 표 펼침 시 이미 fetch 됐을 수 있음)
    const cached = detailByLogId.get(logId);
    const data = cached ?? await fetchLogForPdf(logId);
    if (!data) { setDownloadingId(null); toast.error('일지 정보를 불러오지 못했어요.'); return; }
    try {
      await downloadMentoringLogPdf(data);
      toast.success('PDF 다운로드가 시작됐어요.');
    } catch (err) {
      console.error('[staff-portal/log] PDF 생성 실패:', err);
      toast.error('PDF 생성 중 오류가 발생했어요.');
    } finally {
      setDownloadingId(null);
    }
  }

  function cacheDetail(logId: string, d: MentoringLogForPdf) {
    setDetailByLogId((prev) => {
      const next = new Map(prev);
      next.set(logId, d);
      return next;
    });
  }

  if (!selectedProgramId) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState emoji="🎯" title="먼저 개요 탭에서 프로그램을 선택해 주세요."
          description="선택된 프로그램의 일지만 표시돼요." />
      </div>
    );
  }
  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }

  return (
    <div className="space-y-4">
      <section className={CARD_CLASS}>
        <header className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-2">
            <FileText size={16} className="text-violet-500" aria-hidden="true" />
            내 일지 ({logs.length}건)
          </h2>
        </header>

        {/* 필터 */}
        <nav role="tablist" aria-label="일지 필터" className="flex gap-1.5 flex-wrap mb-4">
          {([
            { key: 'all', label: '전체' },
            { key: 'mentoring', label: '멘토링 일지' },
            { key: 'activity', label: '활동 일지' },
          ] as const).map((f) => {
            const active = filter === f.key;
            return (
              <button key={f.key} type="button" role="tab" aria-selected={active}
                onClick={() => setFilter(f.key)}
                className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-semibold transition-colors ${
                  active
                    ? 'bg-violet-600 text-white'
                    : 'text-slate-500 hover:text-violet-600 hover:bg-violet-50'
                }`}>
                {f.label}
                <span className={`inline-flex items-center justify-center min-w-[1.25rem] px-1 rounded text-[10px] ${active ? 'bg-white/20 text-white' : 'bg-slate-100 text-slate-500'}`}>{counts[f.key]}</span>
              </button>
            );
          })}
        </nav>

        {visible.length === 0 ? (
          <EmptyState emoji="📝"
            title={logs.length === 0 ? '아직 작성된 일지가 없어요.' : '조건에 맞는 일지가 없어요.'} />
        ) : (
          <ul className="space-y-2">
            {visible.map((l) => {
              const expanded = expandedId === l.id;
              const isEditing = editingLogId === l.id;
              const kindBadge = l.kind === 'mentoring' ? '멘토링' : '활동';
              const kindStyle = l.kind === 'mentoring'
                ? 'bg-violet-100 text-violet-700' : 'bg-cyan-100 text-cyan-700';
              const Icon = l.kind === 'mentoring' ? BookOpen : ListChecks;
              const canEdit = l.kind === 'mentoring' && l.status != null && canEditMentoringLog({ status: l.status });
              const asn = l.assignmentId ? assignmentsById.get(l.assignmentId) : null;
              const menteesForForm: MenteeLite[] = asn
                ? (asn.mentee_ids ?? []).map((id) => menteesById.get(id)).filter((m): m is MenteeLite => !!m)
                : [];

              // 수정 모드 — 카드 안에 폼 인라인
              if (isEditing && l.kind === 'mentoring' && asn) {
                const initial: MentoringLogInitial = {
                  id: l.id,
                  subject: l.subject ?? null,
                  log_date: l.date,
                  start_time: l.startTime ?? null,
                  end_time: l.endTime ?? null,
                  location: null,
                  content: l.content,
                  next_plan: l.nextPlan ?? null,
                  recipient: l.recipient ?? null,
                  team_name: l.teamName ?? null,
                  mentee_ids: l.menteeIds ?? null,
                };
                return (
                  <li key={`${l.kind}-${l.id}`} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <MentoringLogForm
                      assignment={{
                        id: asn.id,
                        mentee_ids: asn.mentee_ids,
                        program: asn.program,
                      }}
                      mentees={menteesForForm}
                      programName={asn.program?.name ?? '(프로그램 미지정)'}
                      mentorName={staff.name}
                      userId={user?.id ?? null}
                      initialLog={initial}
                      onSaved={() => { setEditingLogId(null); void fetchData(); }}
                      onCancel={() => setEditingLogId(null)}
                    />
                  </li>
                );
              }

              return (
                <li key={`${l.kind}-${l.id}`} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className={`inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold ${kindStyle}`}>
                      <Icon size={10} aria-hidden="true" />{kindBadge}
                    </span>
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{formatDateKo(l.date)}</span>
                    {l.sessionNo != null && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">{l.sessionNo}회차</span>
                    )}
                    {l.logType && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-slate-100 text-slate-600">{ACTIVITY_TYPE_LABEL[l.logType]}</span>
                    )}
                    {l.kind === 'mentoring' && l.status && (
                      <span className={`text-[10px] px-1.5 py-0.5 rounded font-semibold ${MENTORING_LOG_STATUS_STYLE[l.status]}`}>
                        {MENTORING_LOG_STATUS_LABEL[l.status]}
                      </span>
                    )}
                    {l.programName && (
                      <span className="text-xs text-slate-500 ml-auto truncate max-w-[40%]">{l.programName}</span>
                    )}
                  </div>
                  {l.title && <p className="text-sm font-semibold text-[#1E1B4B] mt-2">{l.title}</p>}
                  <p className={`mt-1.5 text-sm text-slate-700 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>{l.content}</p>

                  {/* 박경수님 2026-05-26 — 멘토링 일지 상세 양식 표 (펼침 시). PDF 와 동일 구조. */}
                  {expanded && l.kind === 'mentoring' && (
                    <MentoringLogExpandedView
                      logId={l.id}
                      cached={detailByLogId.get(l.id)}
                      onLoaded={(d) => cacheDetail(l.id, d)}
                      fallback={{
                        teamName: l.teamName,
                        subject: l.subject,
                        content: l.content,
                        date: l.date,
                        startTime: l.startTime,
                        endTime: l.endTime,
                        durationMin: l.durationMin,
                        recipient: l.recipient,
                        menteeNames: l.menteeNames,
                        programName: l.programName,
                        mentorName: staff.name,
                        mentorAffiliation: staff.affiliation,
                      }}
                    />
                  )}

                  {/* 활동 일지는 다음 계획만 펼침 표시 */}
                  {expanded && l.kind === 'activity' && l.nextPlan && (
                    <p className="mt-2 text-xs text-slate-600">
                      <span className="font-bold text-slate-700">다음 계획:</span> {l.nextPlan}
                    </p>
                  )}

                  <div className="flex justify-end items-center gap-2 mt-2">
                    {/* 박경수님 2026-05-26 — 멘토링 일지 [수정] 버튼 (draft / rejected 만) */}
                    {canEdit && (
                      <button type="button" onClick={() => setEditingLogId(l.id)}
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-semibold text-amber-700 border border-amber-200 hover:bg-amber-50">
                        <Pencil size={11} aria-hidden="true" /> 수정
                      </button>
                    )}
                    {l.kind === 'mentoring' && (
                      <button type="button" onClick={() => void handleDownloadPdf(l.id)}
                        disabled={downloadingId === l.id}
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-semibold text-violet-700 border border-violet-200 hover:bg-violet-50 disabled:opacity-50">
                        {downloadingId === l.id ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} aria-hidden="true" />}
                        PDF
                      </button>
                    )}
                    <button type="button" onClick={() => setExpandedId(expanded ? null : l.id)}
                      className="inline-flex items-center gap-0.5 text-xs text-violet-600 hover:underline">
                      {expanded ? <><ChevronUp size={12} /> 접기</> : <><ChevronDown size={12} /> 상세 보기</>}
                    </button>
                  </div>
                </li>
              );
            })}
          </ul>
        )}
      </section>
    </div>
  );
}
