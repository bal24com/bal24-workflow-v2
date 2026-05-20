// bal24 v2 — STEP-STAFF-PORTAL-P3 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 포털 · 멘토링 탭 — 프로그램별 그룹핑 + 멘티 + 일지 작성 + 최근 5건.
// mentoring_logs 테이블 미적용(PGRST205) 안전 처리.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users2, BookOpen, Plus, Clock, Paperclip } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { useAuth } from '../../../contexts/AuthContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import { type MentoringLog, type MentoringLogFile } from '../../../types/mentoring';
import type { StaffPortalIdentity } from '../staffPortalUtils';
import MentoringLogForm from './MentoringLogForm';

interface Props {
  staff: StaffPortalIdentity;
  selectedProgramId: string | null;
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

export default function StaffMentoringTab({ staff, selectedProgramId }: Props) {
  const toast = useToast();
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [mentees, setMentees] = useState<MenteeLite[]>([]);
  const [logs, setLogs] = useState<MentoringLog[]>([]);
  // STEP-MENTORING-LOG-UX — log_id → 파일 목록
  const [filesByLog, setFilesByLog] = useState<Map<string, MentoringLogFile[]>>(new Map());
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [formOpenId, setFormOpenId] = useState<string | null>(null);

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
    let logRows: MentoringLog[] = [];
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
        logRows = (lg ?? []) as MentoringLog[];
        setLogs(logRows);
      }
    } else setLogs([]);

    // STEP-MENTORING-LOG-UX — 일지별 첨부 파일 fetch (마이그레이션 미적용 안전)
    const logIds = logRows.map((l) => l.id);
    const map = new Map<string, MentoringLogFile[]>();
    if (logIds.length > 0) {
      const { data: filesData, error: filesErr } = await supabase
        .from('mentoring_log_files').select('*').in('log_id', logIds)
        .order('created_at', { ascending: true });
      if (filesErr) {
        const m = (filesErr.message ?? '').toLowerCase();
        if (!m.includes('does not exist') && !m.includes('pgrst205')) {
          console.warn('[staff-portal/mentoring] 파일 조회 경고:', filesErr.message);
        }
      } else {
        (filesData ?? []).forEach((f) => {
          const row = f as MentoringLogFile;
          const arr = map.get(row.log_id) ?? [];
          arr.push(row); map.set(row.log_id, arr);
        });
      }
    }
    setFilesByLog(map);

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
      {tableMissing && (
        <div className="rounded-2xl border border-amber-200 bg-amber-50 px-4 py-3 text-xs text-amber-800">
          멘토링 일지 기능이 아직 활성화되지 않았어요. PM에게 마이그레이션 실행을 요청해 주세요.
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
              <div>
                <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                  <Users2 size={12} aria-hidden="true" /> 담당 멘티 ({menteeList.length}명)
                </p>
                {menteeList.length === 0 ? (
                  <p className="text-sm text-slate-400 italic">배정된 멘티가 없어요.</p>
                ) : (
                  <ul className="space-y-1">
                    {menteeList.map((m) => (
                      <li key={m.id} className="text-sm text-slate-700">
                        · {m.name}{m.organization && <span className="text-slate-400"> ({m.organization})</span>}
                      </li>
                    ))}
                  </ul>
                )}
              </div>

              {/* 일지 작성 폼 (분리된 파일) */}
              {!tableMissing && (
                formOpenId === a.id ? (
                  <MentoringLogForm assignment={a} mentees={menteeList}
                    programName={programName} mentorName={staff.name}
                    userId={user?.id ?? null}
                    onSaved={() => { setFormOpenId(null); void fetchData(); }}
                    onCancel={() => setFormOpenId(null)} />
                ) : (
                  <button type="button" onClick={() => setFormOpenId(a.id)} className={BTN_PRIMARY}>
                    <Plus size={14} aria-hidden="true" /> 일지 작성
                  </button>
                )
              )}

              {/* 최근 일지 5건 */}
              {!tableMissing && asnLogs.length > 0 && (
                <div className="pt-3 border-t border-slate-100">
                  <p className="text-xs font-semibold text-slate-500 uppercase mb-2 flex items-center gap-1.5">
                    <BookOpen size={12} aria-hidden="true" /> 최근 일지 ({asnLogs.length}건)
                  </p>
                  <ul className="space-y-2">
                    {asnLogs.slice(0, 5).map((l) => {
                      const timeRange = (l.start_time && l.end_time) ? `${l.start_time}~${l.end_time}` : null;
                      const logFiles = filesByLog.get(l.id) ?? [];
                      return (
                        <li key={l.id} className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2">
                          <div className="flex items-center gap-2 text-xs flex-wrap">
                            <span className="font-bold text-slate-700 tabular-nums">{formatDateKo(l.log_date)}</span>
                            {timeRange && (
                              <span className="inline-flex items-center gap-0.5 px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold text-[10px] tabular-nums">
                                <Clock size={9} aria-hidden="true" />{timeRange}
                              </span>
                            )}
                            {!timeRange && l.session_no != null && (
                              <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 font-semibold text-[10px]">
                                {l.session_no}회차
                              </span>
                            )}
                            {l.location && (
                              <span className="text-[10px] text-slate-500 truncate">· {l.location}</span>
                            )}
                            {logFiles.length > 0 && (
                              <span className="inline-flex items-center gap-0.5 text-[10px] text-violet-600 font-semibold">
                                <Paperclip size={9} aria-hidden="true" />{logFiles.length}
                              </span>
                            )}
                          </div>
                          <p className="mt-1.5 text-sm text-slate-700 line-clamp-2 whitespace-pre-wrap">{l.content}</p>
                          {/* 첨부 파일 미리보기 */}
                          {logFiles.length > 0 && (
                            <div className="mt-2 flex flex-wrap gap-1.5">
                              {logFiles.map((f) => (
                                f.file_type === 'image' ? (
                                  <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer">
                                    <img src={f.file_url} alt={f.file_name}
                                      className="w-12 h-12 object-cover rounded-md border border-violet-100 hover:opacity-80" />
                                  </a>
                                ) : (
                                  <a key={f.id} href={f.file_url} target="_blank" rel="noopener noreferrer"
                                    className="inline-flex items-center gap-1 text-[10px] text-violet-700 bg-violet-100 rounded-md px-2 py-1 hover:bg-violet-200 truncate max-w-[140px]">
                                    📎 {f.file_name}
                                  </a>
                                )
                              ))}
                            </div>
                          )}
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
