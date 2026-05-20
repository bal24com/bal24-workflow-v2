// bal24 v2 — STEP-STAFF-PORTAL-P3 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 포털 · 멘토링 탭 — 프로그램별 그룹핑 + 멘티 + 일지 작성 + 최근 5건.
// mentoring_logs 테이블 미적용(PGRST205) 안전 처리.

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Users2, BookOpen, Plus, Save, X, Clock } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import { calcDurationMin, formatDuration, type MentoringLog } from '../../../types/mentoring';
import type { StaffPortalIdentity } from '../staffPortalUtils';

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

const INPUT_CLASS =
  'w-full h-[42px] border border-gray-200 rounded-[10px] px-3 text-sm ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-slate-50';

const TEXTAREA_CLASS =
  'w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm resize-y ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-slate-50';

const BTN_PRIMARY =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-violet-600 ' +
  'rounded-[10px] hover:bg-violet-700 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100';

const BTN_GHOST =
  'inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-600 ' +
  'hover:bg-slate-100 rounded-[10px] transition-all duration-200';

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function StaffMentoringTab({ staff, selectedProgramId }: Props) {
  const toast = useToast();
  const [assignments, setAssignments] = useState<AssignmentRow[]>([]);
  const [mentees, setMentees] = useState<MenteeLite[]>([]);
  const [logs, setLogs] = useState<MentoringLog[]>([]);
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
      } else setLogs((lg ?? []) as MentoringLog[]);
    } else setLogs([]);

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

              {/* 일지 작성 폼 */}
              {!tableMissing && (
                formOpenId === a.id ? (
                  <LogForm assignment={a} mentees={menteeList}
                    programName={programName} mentorName={staff.name}
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
                          </div>
                          <p className="mt-1.5 text-sm text-slate-700 line-clamp-2 whitespace-pre-wrap">{l.content}</p>
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

interface LogFormProps {
  assignment: AssignmentRow;
  mentees: MenteeLite[];
  programName: string;
  mentorName: string;
  onSaved: () => void;
  onCancel: () => void;
}

interface LogFormState {
  log_date: string;     // 상담 날짜
  start_time: string;   // HH:MM
  end_time: string;     // HH:MM
  location: string;     // 장소
  content: string;      // 주요 내용
  next_plan: string;    // 다음 멘토링 계획 (선택)
}

const READONLY_CLASS =
  'w-full h-[42px] border border-gray-200 rounded-[10px] px-3 text-sm bg-slate-50 text-slate-600';

function LogForm({ assignment, mentees, programName, mentorName, onSaved, onCancel }: LogFormProps) {
  const toast = useToast();
  const [form, setForm] = useState<LogFormState>({
    log_date: todayIso(),
    start_time: '09:00',
    end_time: '11:00',
    location: '',
    content: '',
    next_plan: '',
  });
  const [selectedMentees, setSelectedMentees] = useState<string[]>(mentees.map((m) => m.id));
  const [saving, setSaving] = useState(false);

  const durationLabel = useMemo(
    () => formatDuration(calcDurationMin(form.start_time, form.end_time)),
    [form.start_time, form.end_time],
  );

  function toggleMentee(id: string) {
    setSelectedMentees((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (!form.content.trim()) { toast.error('주요 내용을 입력해 주세요.'); return; }
    if (calcDurationMin(form.start_time, form.end_time) <= 0) {
      toast.error('종료 시간이 시작 시간보다 늦어야 해요.'); return;
    }
    setSaving(true);
    const { error } = await supabase.from('mentoring_logs').insert({
      assignment_id: assignment.id,
      program_id: assignment.program?.id ?? null,
      log_date: form.log_date,
      start_time: form.start_time,
      end_time: form.end_time,
      location: form.location.trim() || null,
      mentee_ids: selectedMentees,
      content: form.content.trim(),
      next_plan: form.next_plan.trim() || null,
    });
    setSaving(false);
    if (error) {
      console.error('[staff-portal/mentoring] 일지 저장 실패:', error.message);
      toast.error('일지 저장에 실패했어요.');
      return;
    }
    toast.success('일지를 저장했어요.');
    onSaved();
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-4">
      {/* 사업명 — 자동 표시 */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">사업명</label>
        <div className={READONLY_CLASS + ' flex items-center truncate'}>{programName}</div>
      </div>

      {/* 상담일시 — 날짜 + 시작/종료 시간 */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">상담일시</label>
        <div className="grid grid-cols-[1fr_auto_auto_auto] gap-2 items-center">
          <input type="date" value={form.log_date} disabled={saving}
            onChange={(e) => setForm({ ...form, log_date: e.target.value })}
            className={INPUT_CLASS} />
          <input type="time" value={form.start_time} disabled={saving}
            onChange={(e) => setForm({ ...form, start_time: e.target.value })}
            className="w-28 h-[42px] border border-gray-200 rounded-[10px] px-3 text-sm tabular-nums focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-slate-50" />
          <span className="text-sm text-slate-500">~</span>
          <input type="time" value={form.end_time} disabled={saving}
            onChange={(e) => setForm({ ...form, end_time: e.target.value })}
            className="w-28 h-[42px] border border-gray-200 rounded-[10px] px-3 text-sm tabular-nums focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-slate-50" />
        </div>
        <p className="mt-1.5 text-xs text-slate-500 inline-flex items-center gap-1">
          <Clock size={11} aria-hidden="true" /> 진행시간: <span className="font-semibold text-violet-600">{durationLabel}</span>
        </p>
      </div>

      {/* 장소 */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">장소</label>
        <input type="text" value={form.location} disabled={saving}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="예) 지엔스튜디오, 온라인(Zoom) 등"
          className={INPUT_CLASS} />
      </div>

      {/* 멘티 + 멘토 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1.5">
            멘티 ({selectedMentees.length}/{mentees.length})
          </label>
          {mentees.length === 0 ? (
            <div className={READONLY_CLASS + ' italic flex items-center text-slate-400'}>배정된 멘티가 없어요.</div>
          ) : (
            <div className="flex flex-wrap gap-1.5">
              {mentees.map((m) => (
                <label key={m.id} className="inline-flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border border-violet-200 bg-white cursor-pointer hover:bg-violet-50">
                  <input type="checkbox" checked={selectedMentees.includes(m.id)} onChange={() => toggleMentee(m.id)}
                    disabled={saving} className="rounded text-violet-600 w-3.5 h-3.5" />
                  <span className="text-xs text-slate-700">{m.name}</span>
                </label>
              ))}
            </div>
          )}
        </div>
        <div>
          <label className="text-xs font-semibold text-slate-700 block mb-1">멘토</label>
          <div className={READONLY_CLASS + ' flex items-center truncate'}>{mentorName}</div>
        </div>
      </div>

      {/* 주요 내용 */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">주요 내용</label>
        <textarea value={form.content} disabled={saving} rows={6}
          placeholder="멘토링 중 논의한 내용, 진행 방식, 컨설팅 내용을 구체적으로 작성하세요"
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          className={TEXTAREA_CLASS} />
      </div>

      {/* 다음 멘토링 계획 (선택) */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">다음 멘토링 계획 (선택)</label>
        <textarea value={form.next_plan} disabled={saving} rows={3}
          placeholder="다음 회차 주제·과제·목표"
          onChange={(e) => setForm({ ...form, next_plan: e.target.value })}
          className={TEXTAREA_CLASS} />
      </div>

      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className={BTN_GHOST}>
          <X size={14} /> 취소
        </button>
        <button type="button" onClick={() => void handleSave()} disabled={saving} className={BTN_PRIMARY}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장하기
        </button>
      </div>
    </div>
  );
}
