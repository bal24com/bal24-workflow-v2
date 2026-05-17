// bal24 v2 — STEP-MENTOR-PORTAL-FULL
// 멘토 포털 — 멘토링 일지 목록 + 작성 폼 (mentoring_logs)

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Loader2, Plus, Save, Trash2, BookOpen, ChevronDown, ChevronUp } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatDateKo } from '../../lib/utils';
import type { MentoringAssignment, MentoringLog } from '../../types/mentoring';

interface MenteeLite { id: string; name: string; organization: string | null }

interface Props {
  assignment: MentoringAssignment;
  mentees: MenteeLite[];
}

function todayIso(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}

export default function MentorPortalLogs({ assignment, mentees }: Props) {
  const toast = useToast();
  const [logs, setLogs] = useState<MentoringLog[]>([]);
  const [loading, setLoading] = useState(true);
  const [tableMissing, setTableMissing] = useState(false);
  const [formOpen, setFormOpen] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [expandedId, setExpandedId] = useState<string | null>(null);
  // 폼 state
  const [logDate, setLogDate] = useState(todayIso());
  const [sessionNo, setSessionNo] = useState('1');
  const [selectedMentees, setSelectedMentees] = useState<string[]>([]);
  const [content, setContent] = useState('');
  const [nextPlan, setNextPlan] = useState('');
  const [saving, setSaving] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('mentoring_logs')
      .select('*').eq('assignment_id', assignment.id).order('log_date', { ascending: false });
    if (error) {
      const m = (error.message ?? '').toLowerCase();
      if (m.includes('does not exist') || m.includes('pgrst205')) {
        console.warn('[mentor-portal] mentoring_logs 테이블 미적용:', error.message);
        setTableMissing(true); setLogs([]); setLoading(false); return;
      }
      console.error('[mentor-portal] 일지 조회 실패:', error.message);
      toast.error('일지를 불러오지 못했어요.');
      setLogs([]); setLoading(false); return;
    }
    setLogs((data ?? []) as MentoringLog[]);
    setLoading(false);
  }, [assignment.id, toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  function resetForm() {
    setLogDate(todayIso()); setSessionNo(String(logs.length + 1));
    setSelectedMentees([]); setContent(''); setNextPlan('');
    setEditingId(null);
  }

  function openNew() {
    resetForm();
    setSessionNo(String(logs.length + 1));
    setFormOpen(true);
  }

  function openEdit(log: MentoringLog) {
    setEditingId(log.id);
    setLogDate(log.log_date); setSessionNo(String(log.session_no ?? 1));
    setSelectedMentees(log.mentee_ids ?? []);
    setContent(log.content); setNextPlan(log.next_plan ?? '');
    setFormOpen(true);
  }

  function toggleMentee(id: string) {
    setSelectedMentees((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSave() {
    if (!content.trim()) { toast.error('주요 내용을 입력해 주세요.'); return; }
    setSaving(true);
    const payload = {
      assignment_id: assignment.id,
      program_id: assignment.program_id,
      log_date: logDate,
      session_no: Number(sessionNo) || 1,
      mentee_ids: selectedMentees,
      content: content.trim(),
      next_plan: nextPlan.trim() || null,
      updated_at: new Date().toISOString(),
    };
    const res = editingId
      ? await supabase.from('mentoring_logs').update(payload).eq('id', editingId)
      : await supabase.from('mentoring_logs').insert(payload);
    setSaving(false);
    if (res.error) {
      console.error('[mentor-portal] 일지 저장 실패:', res.error.message);
      toast.error('일지 저장에 실패했어요.');
      return;
    }
    toast.success(editingId ? '일지를 수정했어요.' : '일지를 저장했어요.');
    setFormOpen(false); resetForm();
    void refresh();
  }

  async function handleDelete(id: string) {
    if (!window.confirm('이 일지를 삭제할까요?')) return;
    const { error } = await supabase.from('mentoring_logs').delete().eq('id', id);
    if (error) { console.error('[mentor-portal] 일지 삭제 실패:', error.message); toast.error('삭제에 실패했어요.'); return; }
    toast.success('삭제했어요.');
    void refresh();
  }

  const menteeMap = useMemo(() => new Map(mentees.map((m) => [m.id, m])), [mentees]);

  if (tableMissing) {
    return (
      <section className="rounded-2xl border border-amber-200 bg-amber-50/40 p-5 text-center">
        <p className="text-sm font-bold text-amber-800">멘토링 일지 기능이 아직 준비되지 않았어요.</p>
        <p className="text-[11px] text-amber-700 mt-1">PM에게 마이그레이션 실행 요청을 알려 주세요.</p>
      </section>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-sm space-y-3">
      <header className="flex items-center justify-between gap-2">
        <p className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1">
          <BookOpen size={14} className="text-violet-500" aria-hidden="true" /> 멘토링 일지 ({logs.length})
        </p>
        {!formOpen && (
          <button type="button" onClick={openNew}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
            <Plus size={11} aria-hidden="true" /> 일지 작성
          </button>
        )}
      </header>

      {formOpen && (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_auto] gap-2">
            <div>
              <label className="text-[11px] font-bold text-slate-600">일지 날짜</label>
              <input type="date" value={logDate} onChange={(e) => setLogDate(e.target.value)} disabled={saving}
                className="w-full h-9 px-2 rounded-lg border border-violet-200 bg-white text-sm focus:outline-none focus:border-violet-400" />
            </div>
            <div>
              <label className="text-[11px] font-bold text-slate-600">회차</label>
              <input type="number" min={1} value={sessionNo} onChange={(e) => setSessionNo(e.target.value)} disabled={saving}
                className="w-20 h-9 px-2 rounded-lg border border-violet-200 bg-white text-sm tabular-nums focus:outline-none focus:border-violet-400" />
            </div>
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600">멘티 선택 ({selectedMentees.length}/{mentees.length})</label>
            {mentees.length === 0 ? (
              <p className="text-xs text-slate-400 italic py-2">배정된 멘티가 없어요.</p>
            ) : (
              <div className="flex flex-wrap gap-1.5 max-h-[100px] overflow-y-auto">
                {mentees.map((m) => (
                  <label key={m.id} className="inline-flex items-center gap-1 px-2 py-1 rounded border border-violet-200 bg-white cursor-pointer hover:bg-violet-50">
                    <input type="checkbox" checked={selectedMentees.includes(m.id)} onChange={() => toggleMentee(m.id)}
                      disabled={saving} className="rounded text-violet-600" />
                    <span className="text-xs text-slate-700">{m.name}</span>
                  </label>
                ))}
              </div>
            )}
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600">주요 내용</label>
            <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={4} disabled={saving}
              placeholder="멘토링 중 논의한 내용·진행 방식·피드백 등 (최소 3줄)"
              className="w-full px-2 py-1.5 rounded-lg border border-violet-200 bg-white text-sm focus:outline-none focus:border-violet-400 resize-y leading-relaxed" />
          </div>
          <div>
            <label className="text-[11px] font-bold text-slate-600">다음 멘토링 계획 (선택)</label>
            <textarea value={nextPlan} onChange={(e) => setNextPlan(e.target.value)} rows={2} disabled={saving}
              placeholder="다음 회차에서 다룰 주제·과제 등"
              className="w-full px-2 py-1.5 rounded-lg border border-violet-200 bg-white text-sm focus:outline-none focus:border-violet-400 resize-y" />
          </div>
          <div className="flex items-center justify-end gap-2 pt-1">
            <button type="button" onClick={() => { setFormOpen(false); resetForm(); }}
              className="px-3 py-1.5 rounded-md text-xs text-slate-600 hover:bg-slate-100">취소</button>
            <button type="button" onClick={() => void handleSave()} disabled={saving}
              className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
              {saving ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
              저장
            </button>
          </div>
        </div>
      )}

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
      ) : logs.length === 0 && !formOpen ? (
        <p className="text-xs text-slate-400 italic text-center py-4">작성된 일지가 없어요. 위 [일지 작성]을 눌러 시작해 주세요.</p>
      ) : (
        <ul className="space-y-2">
          {logs.map((log) => {
            const expanded = expandedId === log.id;
            const names = log.mentee_ids?.map((id) => menteeMap.get(id)?.name).filter(Boolean) ?? [];
            return (
              <li key={log.id} className="rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3">
                <div className="flex items-center justify-between gap-2 flex-wrap">
                  <div className="flex items-center gap-2 text-xs">
                    <span className="font-bold text-slate-700 tabular-nums">{formatDateKo(log.log_date)}</span>
                    <span className="px-1.5 py-0.5 rounded bg-violet-100 text-violet-700 text-[10px] font-semibold">{log.session_no ?? 1}회차</span>
                    {names.length > 0 && <span className="text-slate-500 truncate">{names.join(', ')}</span>}
                  </div>
                  <div className="flex items-center gap-1">
                    <button type="button" onClick={() => setExpandedId(expanded ? null : log.id)}
                      className="inline-flex items-center text-[11px] text-violet-600 hover:underline">
                      {expanded ? <><ChevronUp size={11} /> 접기</> : <><ChevronDown size={11} /> 상세 보기</>}
                    </button>
                    <button type="button" onClick={() => openEdit(log)}
                      className="text-[11px] text-slate-500 hover:text-violet-600">수정</button>
                    <button type="button" onClick={() => void handleDelete(log.id)} aria-label="삭제"
                      className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-400 hover:bg-rose-50 hover:text-rose-500">
                      <Trash2 size={11} />
                    </button>
                  </div>
                </div>
                <p className={`mt-1 text-xs text-slate-700 whitespace-pre-wrap ${expanded ? '' : 'line-clamp-2'}`}>{log.content}</p>
                {expanded && log.next_plan && (
                  <p className="mt-2 text-[11px] text-slate-600">
                    <span className="font-bold text-slate-700">다음 계획:</span> {log.next_plan}
                  </p>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
