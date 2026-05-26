// bal24 v2 — STEP-MENTORING-LOG-UX / STEP-MENTORING-P1
// 멘토링 일지 작성 폼 (StaffMentoringTab에서 분리, V-1 400줄 유지용)
// P1 추가: subject·recipient 필드, duration_min 저장, draft/submitted 모드 분리.

import { useEffect, useMemo, useState } from 'react';
import { Clock, Loader2, Save, Send, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { calcDurationMin, formatDuration } from '../../../types/mentoring';
import TimeSelect from './TimeSelect';
import MentoringFileUpload, { type UploadedFile } from './MentoringFileUpload';

interface AssignmentRow {
  id: string;
  mentee_ids: string[] | null;
  program: { id: string; name: string } | null;
}
interface MenteeLite { id: string; name: string; organization: string | null }

interface Props {
  assignment: AssignmentRow;
  mentees: MenteeLite[];
  programName: string;
  mentorName: string;
  userId: string | null;
  onSaved: () => void;
  onCancel: () => void;
}

interface FormState {
  subject: string;       // STEP-MENTORING-P1 — 주제
  log_date: string;
  start_time: string;
  end_time: string;
  location: string;
  content: string;
  next_plan: string;
  recipient: string;     // STEP-MENTORING-P1 — 제출처
}

const INPUT_CLASS =
  'w-full h-[42px] border border-gray-200 rounded-[10px] px-3 text-sm ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-slate-50';

const TEXTAREA_CLASS =
  'w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm resize-y ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 disabled:bg-slate-50';

const READONLY_CLASS =
  'w-full h-[42px] border border-gray-200 rounded-[10px] px-3 text-sm bg-slate-50 text-slate-600';

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

export default function MentoringLogForm({
  assignment, mentees, programName, mentorName, userId, onSaved, onCancel,
}: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>({
    subject: '',
    log_date: todayIso(),
    start_time: '09:00',
    end_time: '11:00',
    location: '',
    content: '',
    next_plan: '',
    recipient: '',
  });
  // STEP-MENTORING-LOG-UX — 멘티 기본 체크 해제 (빈 배열)
  const [selectedMentees, setSelectedMentees] = useState<string[]>([]);
  // STEP-MENTORING-LOG-UX — 첨부 파일 (일지 저장 후 일괄 INSERT)
  const [pendingFiles, setPendingFiles] = useState<UploadedFile[]>([]);
  const [saving, setSaving] = useState(false);
  // 2026-05-26 박경수님 — 주관기관 자동 채움 (programs → projects → clients.name)
  const [defaultRecipient, setDefaultRecipient] = useState<string>('');

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const programId = assignment.program?.id;
      if (!programId) return;
      const { data, error } = await supabase
        .from('programs')
        .select('project:projects(client:clients(name))')
        .eq('id', programId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.warn('[mentoring-log-form] 주관기관 조회 경고:', error.message);
        return;
      }
      type ProjectClient = { client?: { name?: string | null } | { name?: string | null }[] | null };
      const proj = (data as { project?: ProjectClient | ProjectClient[] | null } | null)?.project ?? null;
      const projRow = Array.isArray(proj) ? proj[0] : proj;
      const cli = projRow?.client ?? null;
      const cliRow = Array.isArray(cli) ? cli[0] : cli;
      const name = cliRow?.name ?? '';
      if (name) {
        setDefaultRecipient(name);
        // 사용자가 아직 손대지 않았다면 자동 채움
        setForm((prev) => prev.recipient ? prev : { ...prev, recipient: name });
      }
    })();
    return () => { cancelled = true; };
  }, [assignment.program?.id]);

  const durationLabel = useMemo(
    () => formatDuration(calcDurationMin(form.start_time, form.end_time)),
    [form.start_time, form.end_time],
  );

  function toggleMentee(id: string) {
    setSelectedMentees((prev) => prev.includes(id) ? prev.filter((x) => x !== id) : [...prev, id]);
  }

  async function handleSave(mode: 'draft' | 'submitted') {
    // STEP-MENTORING-P1 — 제출 모드는 주제·내용 필수, 임시저장은 관대하게 허용
    if (mode === 'submitted') {
      if (!form.subject.trim()) { toast.error('주제를 입력해 주세요.'); return; }
      if (!form.content.trim()) { toast.error('멘토링 내용을 입력해 주세요.'); return; }
    }
    if (calcDurationMin(form.start_time, form.end_time) <= 0) {
      toast.error('종료 시간이 시작 시간보다 늦어야 해요.'); return;
    }
    setSaving(true);
    const durationMin = calcDurationMin(form.start_time, form.end_time);
    const { data: savedLog, error } = await supabase.from('mentoring_logs').insert({
      assignment_id: assignment.id,
      program_id: assignment.program?.id ?? null,
      log_date: form.log_date,
      start_time: form.start_time,
      end_time: form.end_time,
      duration_min: durationMin,
      location: form.location.trim() || null,
      mentee_ids: selectedMentees,
      subject: form.subject.trim() || null,
      content: form.content.trim(),
      next_plan: form.next_plan.trim() || null,
      recipient: form.recipient.trim() || null,
      status: mode,
      submitted_at: mode === 'submitted' ? new Date().toISOString() : null,
    }).select('id').single();
    if (error || !savedLog) {
      setSaving(false);
      console.error('[mentoring-log-form] 일지 저장 실패:', error?.message);
      toast.error('일지 저장에 실패했어요.');
      return;
    }
    if (pendingFiles.length > 0) {
      const fileRows = pendingFiles.map((f) => ({
        log_id: (savedLog as { id: string }).id,
        created_by: userId,
        file_name: f.file_name,
        file_url: f.file_url,
        file_type: f.file_type,
        file_size: f.file_size ?? null,
      }));
      const { error: fileErr } = await supabase.from('mentoring_log_files').insert(fileRows);
      if (fileErr) {
        const m = (fileErr.message ?? '').toLowerCase();
        if (m.includes('does not exist') || m.includes('pgrst205')) {
          toast.error('일지는 저장됐지만 파일 기능이 활성화되지 않았어요.');
        } else {
          console.error('[mentoring-log-form] 파일 저장 실패:', fileErr.message);
          toast.error('일지는 저장됐지만 파일 저장 중 오류가 발생했어요.');
        }
      }
    }
    setSaving(false);
    toast.success(mode === 'submitted' ? '멘토링 일지를 제출했어요. PM 승인 대기 중.' : '임시저장됐어요.');
    onSaved();
  }

  return (
    <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-4 space-y-4">
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">사업명</label>
        <div className={READONLY_CLASS + ' flex items-center truncate'}>{programName}</div>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">상담일시</label>
        <div className="flex items-center gap-2 flex-wrap">
          <input type="date" value={form.log_date} disabled={saving}
            onChange={(e) => setForm({ ...form, log_date: e.target.value })}
            className={INPUT_CLASS + ' max-w-[180px]'} />
          <TimeSelect value={form.start_time} disabled={saving} ariaLabel="시작"
            onChange={(v) => setForm({ ...form, start_time: v })} />
          <span className="text-sm text-slate-500">~</span>
          <TimeSelect value={form.end_time} disabled={saving} ariaLabel="종료"
            onChange={(v) => setForm({ ...form, end_time: v })} />
        </div>
        <p className="mt-1.5 text-xs text-slate-500 inline-flex items-center gap-1">
          <Clock size={11} aria-hidden="true" /> 진행시간:
          <span className="font-semibold text-violet-600">{durationLabel}</span>
        </p>
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">장소</label>
        <input type="text" value={form.location} disabled={saving}
          onChange={(e) => setForm({ ...form, location: e.target.value })}
          placeholder="예) 지엔스튜디오, 온라인(Zoom) 등"
          className={INPUT_CLASS} />
      </div>

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

      {/* STEP-MENTORING-P1 — 주제 (제출 시 필수) */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">주제 <span className="text-rose-500">*</span></label>
        <input type="text" value={form.subject} disabled={saving}
          onChange={(e) => setForm({ ...form, subject: e.target.value })}
          placeholder="예) 프로젝트 주제 선정 및 현장조사 준비"
          className={INPUT_CLASS} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">멘토링 내용 <span className="text-rose-500">*</span></label>
        <textarea value={form.content} disabled={saving} rows={6}
          placeholder="멘토링 중 논의한 내용, 진행 방식, 컨설팅 내용을 구체적으로 작성하세요"
          onChange={(e) => setForm({ ...form, content: e.target.value })}
          className={TEXTAREA_CLASS} />
      </div>

      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">다음 멘토링 계획 (선택)</label>
        <textarea value={form.next_plan} disabled={saving} rows={3}
          placeholder="다음 회차 주제·과제·목표"
          onChange={(e) => setForm({ ...form, next_plan: e.target.value })}
          className={TEXTAREA_CLASS} />
      </div>

      <MentoringFileUpload
        files={pendingFiles}
        onChange={setPendingFiles}
        userId={userId}
        disabled={saving} />

      {/* 2026-05-26 박경수님 — 제출처: 주관기관 자동 채움 + 직접 수정 가능 */}
      <div>
        <label className="text-xs font-semibold text-slate-700 block mb-1">제출처</label>
        <div className="flex items-stretch gap-2">
          <input type="text" value={form.recipient} disabled={saving}
            onChange={(e) => setForm({ ...form, recipient: e.target.value })}
            placeholder={defaultRecipient || '예) 국립순천대학교'}
            className={INPUT_CLASS + ' flex-1'} />
          {defaultRecipient && form.recipient !== defaultRecipient && (
            <button type="button" disabled={saving}
              onClick={() => setForm({ ...form, recipient: defaultRecipient })}
              title="주관기관으로 채우기"
              className="px-3 rounded-[10px] border border-violet-200 text-violet-700 text-xs font-semibold hover:bg-violet-50 disabled:opacity-50">
              주관기관 자동
            </button>
          )}
        </div>
        <p className="text-[11px] text-slate-400 mt-1">
          {defaultRecipient
            ? <>기본값은 주관기관 <span className="font-semibold text-slate-600">{defaultRecipient}</span>. 직접 입력해도 돼요.</>
            : '비워두면 PDF 출력 시 제출처 표시가 생략돼요.'}
          {' '}PDF 출력 시 "OO 귀하" 형태로 표시돼요.
        </p>
      </div>

      {/* STEP-MENTORING-P1 — 임시저장 / 제출 분리 */}
      <div className="flex items-center justify-end gap-2 pt-1">
        <button type="button" onClick={onCancel} disabled={saving} className={BTN_GHOST}>
          <X size={14} /> 취소
        </button>
        <button type="button" onClick={() => void handleSave('draft')} disabled={saving}
          className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-slate-700 border border-slate-300 rounded-[10px] hover:bg-slate-50 transition-all duration-200 disabled:opacity-50">
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 임시저장
        </button>
        <button type="button" onClick={() => void handleSave('submitted')} disabled={saving} className={BTN_PRIMARY}>
          {saving ? <Loader2 size={14} className="animate-spin" /> : <Send size={14} />} 제출하기
        </button>
      </div>
    </div>
  );
}
