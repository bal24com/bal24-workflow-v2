// bal24 v2 — STEP-PORTAL-LECTURE-LOG-REDESIGN (박경수님 2026-05-26)
// 강사 포털 · 일지 탭 — [멘토링 일지] / [강의일지] 서브탭 구조.
// 활동일지(activity_logs) UI 표기는 제거. 멘토링은 양식 표·수정 기능 유지.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, BookOpen, ChevronDown, ChevronUp, FileText, Pencil, FileDown } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
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
import { fetchStaffLogs, type UnifiedLog, type AssignmentLite, type MenteeLite } from './staffLogFetch';
import LectureLogSection from './LectureLogSection';
import PortalCommentView from '../../../components/portal/PortalCommentView';

interface Props {
  staff: StaffPortalIdentity;
  selectedProgramId: string | null;
}

type LogSubTab = 'mentoring' | 'lecture';

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

export default function StaffLogTab({ staff, selectedProgramId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [logs, setLogs] = useState<UnifiedLog[]>([]);
  const [loading, setLoading] = useState(true);
  // 박경수님 2026-05-26 — 일지 탭 서브탭 (멘토링 일지 / 강의일지)
  const [subTab, setSubTab] = useState<LogSubTab>('mentoring');
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

  // 박경수님 2026-05-26 — UI 표기에서 activity_logs 제외. 멘토링 일지만 표시.
  const mentoringLogs = useMemo(() => logs.filter((l) => l.kind === 'mentoring'), [logs]);

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

  // 박경수님 2026-05-26 — 서브탭 헤더 (멘토링 일지 | 강의일지)
  const SubTabHeader = (
    <nav role="tablist" aria-label="일지 서브탭"
      className="flex gap-1 border-b border-violet-100 mb-4">
      {([
        { key: 'mentoring' as const, label: '멘토링 일지', desc: `${mentoringLogs.length}건` },
        { key: 'lecture' as const,   label: '강의일지',   desc: '전체 커리큘럼' },
      ]).map((t) => {
        const active = subTab === t.key;
        return (
          <button key={t.key} type="button" role="tab" aria-selected={active}
            onClick={() => setSubTab(t.key)}
            className={`px-4 py-2 text-sm font-bold border-b-2 -mb-px transition-colors ${
              active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-violet-600'
            }`}>
            {t.label}
            <span className="text-[10px] text-slate-400 font-normal ml-1.5">{t.desc}</span>
          </button>
        );
      })}
    </nav>
  );

  // 강의일지 서브탭 — LectureLogSection 호출
  if (subTab === 'lecture') {
    return (
      <div className="space-y-4">
        <div className={CARD_CLASS + ' pb-0 pt-3'}>
          {SubTabHeader}
        </div>
        <LectureLogSection staff={staff} programId={selectedProgramId} />
      </div>
    );
  }

  // 멘토링 일지 서브탭 — 기존 멘토링 일지 목록 + 양식 표 + 수정
  return (
    <div className="space-y-4">
      <section className={CARD_CLASS}>
        {SubTabHeader}
        <header className="flex items-center justify-between gap-2 flex-wrap mb-3">
          <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-2">
            <FileText size={16} className="text-violet-500" aria-hidden="true" />
            멘토링 일지 ({mentoringLogs.length}건)
          </h2>
        </header>

        {mentoringLogs.length === 0 ? (
          <EmptyState emoji="📝" title="아직 작성된 멘토링 일지가 없어요." />
        ) : (
          <ul className="space-y-2">
            {mentoringLogs.map((l) => {
              const expanded = expandedId === l.id;
              const isEditing = editingLogId === l.id;
              const canEdit = l.status != null && canEditMentoringLog({ status: l.status });
              const asn = l.assignmentId ? assignmentsById.get(l.assignmentId) : null;
              const menteesForForm: MenteeLite[] = asn
                ? (asn.mentee_ids ?? []).map((id) => menteesById.get(id)).filter((m): m is MenteeLite => !!m)
                : [];

              if (isEditing && asn) {
                const initial: MentoringLogInitial = {
                  id: l.id, subject: l.subject ?? null, log_date: l.date,
                  start_time: l.startTime ?? null, end_time: l.endTime ?? null,
                  location: null, content: l.content, next_plan: l.nextPlan ?? null,
                  recipient: l.recipient ?? null, team_name: l.teamName ?? null,
                  mentee_ids: l.menteeIds ?? null,
                };
                return (
                  <li key={l.id} className="rounded-xl border border-amber-200 bg-amber-50/40 p-3">
                    <MentoringLogForm
                      assignment={{ id: asn.id, mentee_ids: asn.mentee_ids, program: asn.program }}
                      mentees={menteesForForm}
                      programName={asn.program?.name ?? '(프로그램 미지정)'}
                      mentorName={staff.name} userId={user?.id ?? null}
                      initialLog={initial}
                      onSaved={() => { setEditingLogId(null); void fetchData(); }}
                      onCancel={() => setEditingLogId(null)} />
                  </li>
                );
              }

              return (
                <li key={l.id} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">
                      <BookOpen size={10} aria-hidden="true" />멘토링
                    </span>
                    <span className="text-xs font-bold text-slate-700 tabular-nums">{formatDateKo(l.date)}</span>
                    {l.sessionNo != null && (
                      <span className="text-[10px] px-1 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold">{l.sessionNo}회차</span>
                    )}
                    {l.status && (
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

                  {expanded && (
                    <>
                      <MentoringLogExpandedView
                        logId={l.id} cached={detailByLogId.get(l.id)}
                        onLoaded={(d) => cacheDetail(l.id, d)}
                        fallback={{
                          teamName: l.teamName, subject: l.subject, content: l.content,
                          date: l.date, startTime: l.startTime, endTime: l.endTime,
                          durationMin: l.durationMin, recipient: l.recipient,
                          menteeNames: l.menteeNames, programName: l.programName,
                          mentorName: staff.name, mentorAffiliation: staff.affiliation,
                        }} />
                      {/* 박경수님 2026-05-26 PART G — PM 댓글 표시 (읽기 + 자동 read 처리) */}
                      <PortalCommentView targetType="mentoring_log" targetId={l.id} />
                    </>
                  )}

                  <div className="flex justify-end items-center gap-2 mt-2">
                    {canEdit && (
                      <button type="button" onClick={() => setEditingLogId(l.id)}
                        className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-semibold text-amber-700 border border-amber-200 hover:bg-amber-50">
                        <Pencil size={11} aria-hidden="true" /> 수정
                      </button>
                    )}
                    <button type="button" onClick={() => void handleDownloadPdf(l.id)}
                      disabled={downloadingId === l.id}
                      className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] font-semibold text-violet-700 border border-violet-200 hover:bg-violet-50 disabled:opacity-50">
                      {downloadingId === l.id ? <Loader2 size={11} className="animate-spin" /> : <FileDown size={11} aria-hidden="true" />}
                      PDF
                    </button>
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
