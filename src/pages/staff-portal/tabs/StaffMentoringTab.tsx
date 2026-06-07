// bal24 v2 — STEP-STAFF-PORTAL-P3 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 포털 · 멘토링 탭 — 프로그램별 그룹핑 + 멘티 + 일지 작성 + 최근 5건.
// mentoring_logs 테이블 미적용(PGRST205) 안전 처리.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users2, BookOpen, Plus, Clock, FileDown, Sparkles } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import { type MentoringLog } from '../../../types/mentoring';
import type { StaffPortalIdentity } from '../staffPortalUtils';
import MentoringLogForm from './MentoringLogForm';
import MentoringAIFileModal from '../MentoringAIFileModal';
import { fetchLogForPdf } from '../../programs/detail/mentoringLogPdfFetch';
import { downloadMentoringLogPdf, type MentoringLogForPdf } from '../../programs/detail/mentoringLogPdf';
import SignaturePad from '../../../components/ui/SignaturePad';
import SignatureUploadSection from '../SignatureUploadSection';

interface Props {
  staff: StaffPortalIdentity;
  selectedProgramId: string | null;
  /** 박경수님 2026-05-26 — 멘티 카운트 클릭 시 [일지] 탭으로 이동 콜백 */
  onNavigateToLogTab?: () => void;
}

interface AssignmentRow {
  id: string;
  mentee_ids: string[] | null;
  program: { id: string; name: string } | null;
}
interface MenteeLite { id: string; name: string; organization: string | null }

const CARD_CLASS =
  'bg-white rounded-2xl border border-violet-100 shadow-[0_4px_16px_rgba(124,58,237,0.08)] p-5';

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-violet-600 ' +
  'rounded-[10px] hover:bg-violet-700 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100';

export default function StaffMentoringTab({ staff, selectedProgramId, onNavigateToLogTab }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [mentees, setMentees] = useState<MenteeLite[]>([]);
  const [logs, setLogs] = useState<MentoringLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [formOpenId, setFormOpenId] = useState<string | null>(null);
  // 박경수님 2026-05-26 PART F — AI 파일 일지 생성 모달
  const [aiTargetAsnId, setAiTargetAsnId] = useState<string | null>(null);
  const [prefillContent, setPrefillContent] = useState<string>('');
  // STEP-MENTORING-P2-PDF — PDF 다운로드 진행 중인 일지 id
  const [downloadingId, setDownloadingId] = useState<string | null>(null);
  // STEP-MENTORING-P3-APPROVE — SignaturePad 모달 (서명 미등록 시)
  const [pendingPdfData, setPendingPdfData] = useState<MentoringLogForPdf | null>(null);

  async function executePdfDownload(data: MentoringLogForPdf) {
    setDownloadingId(data.id);
    try {
      await downloadMentoringLogPdf(data);
      toast.success('PDF 다운로드가 시작됐어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[staff-portal/mentoring] PDF 생성 실패:', raw);
      toast.error('PDF 생성 중 오류가 발생했어요.');
    } finally {
      setDownloadingId(null);
    }
  }

  async function handleDownloadPdf(logId: string) {
    setDownloadingId(logId);
    const data = await fetchLogForPdf(logId);
    setDownloadingId(null);
    if (!data) { toast.error('일지 정보를 불러오지 못했어요.'); return; }
    // STEP-MENTORING-P3 — signature_url 없으면 SignaturePad 모달로 임시 서명
    if (!data.mentor_signature_url) {
      setPendingPdfData(data);
      return;
    }
    await executePdfDownload(data);
  }

  function handleSignatureConfirm(dataUrl: string) {
    if (!pendingPdfData) return;
    const merged = { ...pendingPdfData, mentor_signature_url: dataUrl };
    setPendingPdfData(null);
    void executePdfDownload(merged);
  }

  const fetchData = useCallback(async () => {
    if (!selectedProgramId) { setAssignments([]); setMentees([]); setLogs([]); setLoading(false); return; }
    setLoading(true);
    const col = staff.sourceType === 'staff_pool' ? 'mentor_pool_id' : 'mentor_profile_id';
    const { data: asn, error: asnErr } = await supabase
      .from('mentoring_assignments')
      .select('id, mentee_ids, program:programs!mentoring_assignments_program_id_fkey(id, name)')
      .eq(col, staff.id)
      .eq('program_id', selectedProgramId);
    if (asnErr) {
      console.error('[staff-portal/mentoring] 배정 조회 실패:', asnErr.message);
      toast.error('멘토링 배정을 불러오지 못했어요.');
      setAssignments([]); setLoading(false); return;
    }
    const rows = ((asn ?? []) as unknown) as AssignmentRow[];
    setAssignments(rows);

    const allMenteeIds = Array.from(new Set(rows.flatMap((r) => r.mentee_ids ?? [])));
    if (allMenteeIds.length > 0) {
      const { data: mn, error: mnErr } = await supabase.from('program_participants')
        .select('id, name, organization').in('id', allMenteeIds);
      if (mnErr) {
        console.warn('[staff-portal/mentoring] 멘티 조회 경고:', mnErr.message);
      } else {
        setMentees((mn ?? []) as MenteeLite[]);
      }
    } else setMentees([]);

    const asnIds = rows.map((r) => r.id);
    if (asnIds.length > 0) {
      const { data: lg, error: lgErr } = await supabase.from('mentoring_logs')
        .select('*').in('assignment_id', asnIds).order('log_date', { ascending: false });
      if (lgErr) {
        const m = (lgErr.message ?? '').toLowerCase();
        if (m.includes('does not exist') || m.includes('pgrst205')) {
          setTableMissing(true); setLogs([]);
        } else {
          console.warn('[staff-portal/mentoring] 일지 조회 경고:', lgErr.message);
          setLogs([]);
        }
      } else {
        setLogs(lg ?? []);
      }
    } else setLogs([]);

    // 박경수님 2026-05-26 — [최근 일지] 간략화 후 mentoring_log_files fetch 불필요. (상세는 [일지] 탭에서.)
    setLoading(false);
  }, [staff.id, staff.sourceType, selectedProgramId, toast]);

  useEffect(() => { void fetchData(); }, [fetchData]);

  const menteeMap = useMemo(() => new Map(mentees.map((m) => [m.id, m])), [mentees]);
  const logsByAsn = useMemo(() => {
    const m = new Map<string, MentoringLog[]>();
    logs.forEach((l) => {
      if (!l.assignment_id) return;
      const arr = m.get(l.assignment_id) ?? [];
      arr.push(l);
      m.set(l.assignment_id, arr);
    });
    return m;
  }, [logs]);

  // 박경수님 2026-05-26 — 멘티별 일지 카운트 (mentee_ids 포함 일지 수)
  const menteeLogCount = useMemo(() => {
    const m = new Map<string, number>();
    logs.forEach((l) => {
      (l.mentee_ids ?? []).forEach((id) => m.set(id, (m.get(id) ?? 0) + 1));
    });
    return m;
  }, [logs]);

  if (!selectedProgramId) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState emoji="🎯" title="먼저 개요 탭에서 프로그램을 선택해 주세요."
          description="선택된 프로그램의 멘토링 배정과 일지가 표시돼요." />
      </div>
    );
  }
  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 size={20} className="animate-spin text-violet-400" /></div>;
  }
  if (assignments.length === 0) {
    return (
      <div className={CARD_CLASS}>
        <EmptyState emoji="🤝" title="선택한 프로그램에 배정된 멘토링이 없어요."
          description="PM이 멘토 배정을 추가하면 여기에 표시돼요." />
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* 2026-05-26 박경수님 — 도장/사인 등록 카드 상단 노출 (staff_pool 강사만). PDF 출력 시 자동 적용. */}
      {staff.sourceType === 'staff_pool' && (
        <SignatureUploadSection staffId={staff.id} />
      )}

      {tableMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          멘토링 일지 기능이 아직 활성화되지 않았어요. PM에게 마이그레이션 실행을 요청해 주세요.
        </div>
      )}
      {/* STEP-MENTORING-P3-APPROVE — SignaturePad 모달 (서명 미등록 강사용) */}
      {pendingPdfData && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
          onClick={() => setPendingPdfData(null)} role="dialog" aria-modal="true">
          <div className="bg-white w-full max-w-md rounded-2xl shadow-xl p-6" onClick={(e) => e.stopPropagation()}>
            <h3 className="text-base font-bold text-[#1E1B4B] mb-2">서명 입력</h3>
            <p className="text-xs text-slate-500 mb-4">
              등록된 서명이 없어요. 아래에 서명하면 <strong>이번 PDF에만</strong> 사용돼요.
              <br />영구 등록하려면 헤더의 <strong>[내 정보 수정]</strong> → 도장/사인 등록을 이용해 주세요.
            </p>
            <SignaturePad onConfirm={handleSignatureConfirm} onCancel={() => setPendingPdfData(null)}
              confirmLabel="이 서명으로 PDF 생성" />
          </div>
        </div>
      )}

      {assignments.map((a) => {
        const programName = a.program?.name ?? '(프로그램 미지정)';
        const menteeList = (a.mentee_ids ?? []).map((id) => menteeMap.get(id)).filter(Boolean) as MenteeLite[];
        const asnLogs = logsByAsn.get(a.id) ?? [];
        return (
          <section key={a.id} className={CARD_CLASS}>
            <h2 className="text-base font-bold text-[#1E1B4B] mb-4">{programName}</h2>
            <div className="space-y-4">
              {/* 2026-05-26 박경수님 — 담당 멘티 chip + 멘토링 횟수 카운트 + 클릭 시 [일지] 탭 이동 */}
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                  <Users2 size={12} aria-hidden="true" /> 담당 멘티 ({menteeList.length}명)
                </p>
                {menteeList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">배정된 멘티가 없어요.</p>
                ) : (
                  <div className="rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-2.5">
                    <div className="flex flex-wrap gap-1.5">
                      {menteeList.map((m) => {
                        const cnt = menteeLogCount.get(m.id) ?? 0;
                        const clickable = cnt > 0 && !!onNavigateToLogTab;
                        return (
                          <span key={m.id}
                            className={`inline-flex items-center gap-1 px-2.5 py-1 rounded-full bg-white border border-violet-200 text-xs text-slate-700 ${clickable ? 'hover:bg-violet-50 hover:border-violet-400 transition-colors' : ''}`}>
                            <span className="font-semibold">{m.name}</span>
                            {m.organization && (
                              <span className="text-[10px] text-slate-400">{m.organization}</span>
                            )}
                            {clickable ? (
                              <button type="button" onClick={() => onNavigateToLogTab?.()}
                                title={`${m.name}님 멘토링 ${cnt}회 — 일지 탭으로 이동`}
                                className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-violet-600 text-white text-[10px] font-bold tabular-nums hover:bg-violet-700 cursor-pointer">
                                {cnt}회
                              </button>
                            ) : (
                              <span className="ml-0.5 inline-flex items-center justify-center min-w-[1.25rem] h-5 px-1.5 rounded-full bg-slate-100 text-slate-400 text-[10px] font-semibold tabular-nums">
                                0
                              </span>
                            )}
                          </span>
                        );
                      })}
                    </div>
                    {onNavigateToLogTab && (
                      <p className="text-[10px] text-slate-400 mt-1.5">멘티 이름 옆 횟수 배지를 누르면 [일지] 탭으로 이동해요.</p>
                    )}
                  </div>
                )}
              </div>

              {/* 일지 작성 폼 (분리된 파일) */}
              {!tableMissing && (
                formOpenId === a.id ? (
                  <MentoringLogForm assignment={a} mentees={menteeList}
                    programName={programName} mentorName={staff.name}
                    userId={user?.id ?? null}
                    prefillContent={prefillContent || undefined}
                    onSaved={() => { setFormOpenId(null); setPrefillContent(''); void fetchData(); }}
                    onCancel={() => { setFormOpenId(null); setPrefillContent(''); }} />
                ) : (
                  <div className="flex items-center gap-1.5 flex-wrap">
                    <button type="button" onClick={() => setFormOpenId(a.id)} className={BTN_PRIMARY}>
                      <Plus size={14} aria-hidden="true" /> 일지 작성
                    </button>
                    {/* 박경수님 2026-05-26 PART F — 파일로 AI 일지 생성 */}
                    <button type="button" onClick={() => setAiTargetAsnId(a.id)}
                      className="inline-flex items-center gap-1.5 px-3 py-2 text-sm font-semibold text-violet-700 border border-violet-300 rounded-[10px] hover:bg-violet-50 transition-colors">
                      <Sparkles size={13} aria-hidden="true" /> 📎 파일로 일지 작성 🤖
                    </button>
                  </div>
                )
              )}

              {/* AI 파일 모달 (해당 assignment 만 활성) */}
              {aiTargetAsnId === a.id && (
                <MentoringAIFileModal
                  open={true}
                  onClose={() => setAiTargetAsnId(null)}
                  onApply={(content) => {
                    setPrefillContent(content);
                    setAiTargetAsnId(null);
                    setFormOpenId(a.id);
                  }}
                  programName={programName}
                  mentorName={staff.name}
                  menteeNames={menteeList.map((m) => m.name)}
                  sessionNo={(asnLogs[0]?.session_no ?? asnLogs.length) + 1} />
              )}

              {/* 박경수님 2026-05-26 — [최근 일지] 간략화. 멘티(차수)·날짜·시간만. 상세는 [일지] 탭에서. */}
              {!tableMissing && asnLogs.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <div className="flex items-center justify-between gap-2 mb-2">
                    <p className="text-xs font-semibold text-slate-500 uppercase flex items-center gap-1.5">
                      <BookOpen size={12} aria-hidden="true" /> 최근 일지 ({asnLogs.length}건)
                    </p>
                    {onNavigateToLogTab && (
                      <button type="button" onClick={() => onNavigateToLogTab()}
                        className="text-[11px] text-violet-600 hover:underline font-semibold">
                        일지 탭에서 전체 보기 →
                      </button>
                    )}
                  </div>
                  <ul className="space-y-1">
                    {asnLogs.slice(0, 8).map((l) => {
                      const timeRange = (l.start_time && l.end_time)
                        ? `${l.start_time.slice(0, 5)}~${l.end_time.slice(0, 5)}` : null;
                      const menteeNames = (l.mentee_ids ?? [])
                        .map((id) => menteeMap.get(id)?.name).filter(Boolean) as string[];
                      const menteeStr = menteeNames.length > 0
                        ? menteeNames.length <= 2
                          ? menteeNames.join(', ')
                          : `${menteeNames[0]} 외 ${menteeNames.length - 1}명`
                        : null;
                      return (
                        <li key={l.id}
                          className="flex items-center gap-2 text-xs rounded-lg border border-violet-100 bg-violet-50/30 px-2.5 py-1.5 hover:bg-violet-50 transition-colors">
                          {l.session_no != null && (
                            <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold text-[10px] tabular-nums shrink-0">
                              {l.session_no}회차
                            </span>
                          )}
                          <span className="font-semibold text-slate-700 tabular-nums shrink-0">{formatDateKo(l.log_date)}</span>
                          {timeRange && (
                            <span className="inline-flex items-center gap-0.5 text-[11px] text-slate-500 tabular-nums shrink-0">
                              <Clock size={9} aria-hidden="true" />{timeRange}
                            </span>
                          )}
                          {menteeStr && (
                            <span className="text-[11px] text-slate-500 truncate flex-1 min-w-0">· {menteeStr}</span>
                          )}
                          <button type="button" onClick={() => void handleDownloadPdf(l.id)}
                            disabled={downloadingId === l.id}
                            title="PDF 다운로드"
                            className="ml-auto inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded text-violet-600 hover:bg-violet-100 text-[10px] shrink-0 disabled:opacity-50">
                            {downloadingId === l.id ? <Loader2 size={10} className="animate-spin" /> : <FileDown size={10} aria-hidden="true" />}
                            PDF
                          </button>
                        </li>
                      );
                    })}
                  </ul>
                </div>
              )}
            </div>
          </section>
        );
      })}
    </div>
  );
}
