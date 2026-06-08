// 박경수님 2026-06-02 STEP-SURVEY-MULTI-TARGET — 설문 정의 생성·수정 모달.
// 박경수님 2026-06-08 — 선택지·월 칩 방식 추가 UI, 예시 placeholder, description 안내문.

import { useEffect, useRef, useState } from 'react';
import { Plus, Save, X, Trash2, Loader2, Sparkles, Upload, Edit3, ArrowUp, ArrowDown } from 'lucide-react';
import SurveyFormPreviewPanel from './SurveyFormPreviewPanel';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import {
  SURVEY_FORM_KIND_LABEL,
  type ProgramSurveyForm, type SurveyFormKind, type SurveyFormQuestion, type SurveyFormQuestionType,
} from '../../../types/database';
import { importSurveyFromFile } from './surveyAiImport';

interface Props {
  programId: string;
  form?: ProgramSurveyForm | null;
  onClose: () => void;
  onSaved: () => void;
}

const KIND_VALUES: SurveyFormKind[] = ['pre-demand', 'mid', 'satisfaction', 'custom'];
const QUESTION_TYPE_VALUES: SurveyFormQuestionType[] = ['text', 'textarea', 'select', 'checkbox', 'number', 'date', 'date-schedule', 'club-autofill'];
const QUESTION_TYPE_LABEL: Record<SurveyFormQuestionType, string> = {
  text: '단답형', textarea: '서술형', select: '선택형 (1개)', checkbox: '다중 선택',
  number: '숫자', date: '날짜', 'date-schedule': '월별 일정 수요조사', 'club-autofill': '동아리 선택+자동완성',
};

const TARGET_AUDIENCES = [
  { key: 'supporter', label: '지원기관' },
  { key: 'beneficiary', label: '수혜기관' },
  { key: 'team', label: '참여팀(개인)' },
  { key: 'staff', label: '강사/멘토' },
] as const;

function genId(): string {
  return `q_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
}

export default function SurveyFormCreateModal({ programId, form, onClose, onSaved }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(form?.title ?? '');
  const [description, setDescription] = useState(form?.description ?? '');
  const [footer, setFooter] = useState(form?.footer_note ?? '');
  const [kind, setKind] = useState<SurveyFormKind>(form?.kind ?? 'custom');
  const [questions, setQuestions] = useState<SurveyFormQuestion[]>(form?.questions ?? []);
  const [targets, setTargets] = useState<string[]>(form?.target_audiences ?? []);
  const [isActive, setIsActive] = useState<boolean>(form?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const mouseDownRef = useRef(false);

  // 문항 추가/편집 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<SurveyFormQuestionType>('text');
  const [newRequired, setNewRequired] = useState(false);
  const [editingId, setEditingId] = useState<string | null>(null);

  // 선택지 (select / checkbox) — 칩 방식
  const [optList, setOptList] = useState<string[]>([]);
  const [optInput, setOptInput] = useState('');

  // 월별 일정 (date-schedule) — 칩 방식
  const [monthList, setMonthList] = useState<string[]>([]);
  const [monthInput, setMonthInput] = useState('');   // 예: "6월"
  const [monthSub, setMonthSub] = useState('');       // 예: "2차 교육&멘토링"
  const [priorities, setPriorities] = useState<number>(2);

  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAiImport(file: File) {
    setAiLoading(true);
    try {
      const parsed = await importSurveyFromFile(file);
      if (!title.trim()) setTitle(parsed.title);
      setKind(parsed.kind);
      setQuestions((prev) => [...prev, ...parsed.questions]);
      toast.success(`${parsed.questions.length}개 문항을 자동 추출했어요. 검토 후 저장해 주세요.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 분석 중 오류가 발생했어요.';
      console.error('[SurveyFormCreateModal] AI 자동 생성 실패:', msg);
      toast.error(msg);
    } finally {
      setAiLoading(false);
      if (fileInputRef.current) fileInputRef.current.value = '';
    }
  }

  useEffect(() => {
    setTitle(form?.title ?? '');
    setDescription(form?.description ?? '');
    setFooter(form?.footer_note ?? '');
    setKind(form?.kind ?? 'custom');
    setQuestions(form?.questions ?? []);
    setTargets(form?.target_audiences ?? []);
    setIsActive(form?.is_active ?? true);
  }, [form]);

  function resetForm() {
    setNewLabel(''); setNewType('text'); setNewRequired(false); setEditingId(null);
    setOptList([]); setOptInput(''); setMonthList([]); setMonthInput(''); setMonthSub(''); setPriorities(2);
    setShowForm(false);
  }

  function addOpt() {
    const v = optInput.trim();
    if (!v) return;
    if (optList.includes(v)) { toast.error('이미 추가된 선택지예요.'); return; }
    setOptList((p) => [...p, v]);
    setOptInput('');
  }

  function addMonth() {
    const m = monthInput.trim();
    if (!m) return;
    const label = monthSub.trim() ? `${m} (${monthSub.trim()})` : m;
    if (monthList.includes(label)) { toast.error('이미 추가된 월이에요.'); return; }
    setMonthList((p) => [...p, label]);
    setMonthInput(''); setMonthSub('');
  }

  function commitQuestion() {
    const label = newLabel.trim();
    if (!label) { toast.error('문항 내용을 입력해 주세요.'); return; }

    const needsOpts = newType === 'select' || newType === 'checkbox';
    if (needsOpts && optList.length === 0) {
      toast.error('선택지를 1개 이상 추가해 주세요.'); return;
    }
    if (newType === 'date-schedule' && monthList.length === 0) {
      toast.error('월을 1개 이상 추가해 주세요.'); return;
    }

    const newQ: SurveyFormQuestion = {
      id: editingId ?? genId(), label, type: newType, required: newRequired,
      options: needsOpts ? optList : newType === 'date-schedule' ? monthList : undefined,
      priorities: newType === 'date-schedule' ? priorities : undefined,
    };

    if (editingId) {
      setQuestions((prev) => prev.map((q) => q.id === editingId ? newQ : q));
    } else {
      setQuestions((prev) => [...prev, newQ]);
    }
    resetForm();
  }

  function startEdit(q: SurveyFormQuestion) {
    setNewLabel(q.label); setNewType(q.type); setNewRequired(q.required); setEditingId(q.id);
    const isOpts = q.type === 'select' || q.type === 'checkbox';
    setOptList(isOpts ? (q.options ?? []) : []);
    setMonthList(q.type === 'date-schedule' ? (q.options ?? []) : []);
    setPriorities(q.priorities ?? 2);
    setOptInput(''); setMonthInput(''); setMonthSub('');
    setShowForm(true);
  }

  function removeQuestion(id: string) {
    if (!window.confirm('이 문항을 삭제할까요?')) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  // 박경수님 2026-06-08 — 문항 순서 위/아래 이동
  function moveQuestion(index: number, dir: -1 | 1) {
    setQuestions((prev) => {
      const next = [...prev];
      const target = index + dir;
      if (target < 0 || target >= next.length) return prev;
      [next[index], next[target]] = [next[target], next[index]];
      return next;
    });
  }

  async function handleSave() {
    if (!title.trim()) { toast.error('설문 제목을 입력해 주세요.'); return; }
    if (questions.length === 0) { toast.error('문항을 1개 이상 추가해 주세요.'); return; }
    if (targets.length === 0) { toast.error('응답 대상 역할을 1개 이상 선택해 주세요.'); return; }
    setSaving(true);
    const payload = {
      program_id: programId, title: title.trim(), description: description.trim() || null,
      footer_note: footer.trim() || null,
      kind, questions, target_audiences: targets, is_active: isActive,
      updated_at: new Date().toISOString(),
    };
    const { error } = form
      ? await supabase.from('program_survey_forms').update(payload).eq('id', form.id)
      : await supabase.from('program_survey_forms').insert(payload);
    setSaving(false);
    if (error) { console.error('[SurveyFormCreateModal] 저장 실패:', error.message); toast.error('설문 저장에 실패했어요.'); return; }
    toast.success(form ? '설문을 수정했어요.' : '설문을 등록했어요.');
    onSaved(); onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => { mouseDownRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownRef.current && e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <header className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-base font-bold text-[#1E1B4B]">{form ? '설문 수정' : '새 설문 만들기'}</h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded hover:bg-slate-100">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* AI 자동 생성 */}
          {!form && (
            <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-bold text-violet-700 inline-flex items-center gap-1">
                  <Sparkles size={12} aria-hidden="true" /> AI 자동 생성 (PDF·이미지)
                </p>
                <button type="button" disabled={aiLoading} onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
                  {aiLoading ? <><Loader2 size={12} className="animate-spin" /> 분석 중…</> : <><Upload size={12} /> 파일 첨부</>}
                </button>
              </div>
              <p className="text-[10px] text-slate-500">기존 설문 양식(PDF·JPG·PNG)을 첨부하면 AI 가 문항을 추출해 자동 입력해요. 검토 후 저장하세요.</p>
              <input ref={fileInputRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp" className="hidden"
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleAiImport(f); }} />
            </div>
          )}

          {/* 제목·종류 */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">설문 제목 *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="예) 2026 나주창업학교 사전 수요조사"
                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">종류 *</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as SurveyFormKind)}
                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white outline-none focus:border-violet-500">
                {KIND_VALUES.map((k) => <option key={k} value={k}>{SURVEY_FORM_KIND_LABEL[k]}</option>)}
              </select>
            </div>
          </div>

          {/* 상단 안내문 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              상단 안내문 <span className="text-slate-400 font-normal">(선택) — 응답자 화면 상단에 표시돼요</span>
            </label>
            <textarea value={description} onChange={(e) => setDescription(e.target.value)} rows={2}
              placeholder="예) 멘토링 일정 및 프로그램 선호도 조사 · 지도교사 대상&#10;※ 희망 일자는 1학기 2회, 2학기 3회로 신청 바랍니다."
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 resize-none leading-relaxed" />
          </div>

          {/* 응답 대상 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">응답 대상 역할 * (중복 선택 가능)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TARGET_AUDIENCES.map((t) => {
                const checked = targets.includes(t.key);
                return (
                  <label key={t.key} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-xs ${
                    checked ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleTarget(t.key)} className="rounded text-violet-600" />
                    <span className="font-semibold">{t.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 문항 목록 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">문항 ({questions.length})</label>
            {questions.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-4 border border-dashed border-slate-200 rounded-lg">
                아직 문항이 없어요. 아래 [+ 문항 추가] 로 시작하세요.
              </p>
            ) : (
              <div className="space-y-1">
                {questions.map((q, i) => (
                  <div key={q.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50">
                    <span className="text-[10px] font-bold text-slate-400 w-5 tabular-nums">{i + 1}</span>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-semibold text-[#1E1B4B] truncate">{q.label}</span>
                        <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                          {QUESTION_TYPE_LABEL[q.type]}
                        </span>
                        {q.required && <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">필수</span>}
                      </div>
                      {(q.type === 'select' || q.type === 'checkbox' || q.type === 'date-schedule') && q.options && q.options.length > 0 && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{q.options.join(' · ')}</p>
                      )}
                    </div>
                    <div className="flex flex-col">
                      <button type="button" onClick={() => moveQuestion(i, -1)} disabled={i === 0}
                        title="위로" className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30">
                        <ArrowUp size={11} aria-hidden="true" />
                      </button>
                      <button type="button" onClick={() => moveQuestion(i, 1)} disabled={i === questions.length - 1}
                        title="아래로" className="p-0.5 rounded hover:bg-slate-200 text-slate-400 disabled:opacity-30">
                        <ArrowDown size={11} aria-hidden="true" />
                      </button>
                    </div>
                    <button type="button" onClick={() => startEdit(q)} className="p-1 rounded hover:bg-violet-50 text-violet-500">
                      <Edit3 size={12} aria-hidden="true" />
                    </button>
                    <button type="button" onClick={() => removeQuestion(q.id)} className="p-1 rounded hover:bg-rose-50 text-rose-500">
                      <Trash2 size={12} aria-hidden="true" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 문항 추가/편집 폼 */}
          {showForm ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2.5">
              {/* 문항 내용 + 타입 */}
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_130px] gap-2">
                <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="문항 내용을 입력하세요 (예: 희망 방문 분기를 선택해 주세요)"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
                <select value={newType} onChange={(e) => {
                  setNewType(e.target.value as SurveyFormQuestionType);
                  setOptList([]); setMonthList([]); setOptInput(''); setMonthInput(''); setMonthSub('');
                }} className="h-9 rounded-lg border border-slate-200 px-2 text-sm bg-white outline-none focus:border-violet-500">
                  {QUESTION_TYPE_VALUES.map((t) => <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>)}
                </select>
              </div>

              {/* 선택지 (select / checkbox) — 칩 방식 */}
              {(newType === 'select' || newType === 'checkbox') && (
                <div className="space-y-2">
                  <p className="text-[11px] font-bold text-slate-600">
                    선택지 목록 <span className="text-slate-400 font-normal">— 항목을 하나씩 추가하세요</span>
                  </p>
                  {/* 추가된 칩 */}
                  {optList.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {optList.map((o, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-violet-200 text-xs text-violet-800 font-semibold">
                          {o}
                          <button type="button" onClick={() => setOptList((p) => p.filter((_, idx) => idx !== i))}
                            className="hover:text-rose-500 ml-0.5"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 입력 */}
                  <div className="flex gap-1.5">
                    <input type="text" value={optInput} onChange={(e) => setOptInput(e.target.value)}
                      placeholder="예) 사업계획서(아래한글·워드)"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addOpt(); } }}
                      className="flex-1 h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-violet-500" />
                    <button type="button" onClick={addOpt}
                      className="px-3 h-9 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold hover:bg-violet-200 shrink-0 inline-flex items-center gap-1">
                      <Plus size={12} /> 추가
                    </button>
                  </div>
                </div>
              )}

              {/* 월별 일정 (date-schedule) — 칩 방식 */}
              {newType === 'date-schedule' && (
                <div className="space-y-2">
                  <div className="flex items-center gap-2 flex-wrap">
                    <p className="text-[11px] font-bold text-slate-600">
                      월 목록 <span className="text-slate-400 font-normal">— 차수별 월을 추가하세요</span>
                    </p>
                    <div className="ml-auto flex items-center gap-1.5">
                      <label className="text-[11px] text-slate-600">희망 순위</label>
                      <select value={priorities} onChange={(e) => setPriorities(Number(e.target.value))}
                        className="h-7 rounded-lg border border-slate-200 px-2 text-xs bg-white outline-none focus:border-violet-500">
                        <option value={1}>1순위만</option>
                        <option value={2}>1·2순위</option>
                      </select>
                    </div>
                  </div>
                  {/* 추가된 월 칩 */}
                  {monthList.length > 0 && (
                    <div className="flex flex-wrap gap-1">
                      {monthList.map((m, i) => (
                        <span key={i} className="inline-flex items-center gap-1 px-2 py-1 rounded-lg bg-white border border-violet-200 text-xs text-violet-800 font-semibold">
                          📅 {m}
                          <button type="button" onClick={() => setMonthList((p) => p.filter((_, idx) => idx !== i))}
                            className="hover:text-rose-500 ml-0.5"><X size={10} /></button>
                        </span>
                      ))}
                    </div>
                  )}
                  {/* 월 추가 입력 */}
                  <div className="grid grid-cols-[80px_1fr_auto] gap-1.5">
                    <input type="text" value={monthInput} onChange={(e) => setMonthInput(e.target.value)}
                      placeholder="6월"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMonth(); } }}
                      className="h-9 px-2 rounded-lg border border-slate-200 text-sm outline-none focus:border-violet-500" />
                    <input type="text" value={monthSub} onChange={(e) => setMonthSub(e.target.value)}
                      placeholder="선택) 예: 2차 교육&멘토링"
                      onKeyDown={(e) => { if (e.key === 'Enter') { e.preventDefault(); addMonth(); } }}
                      className="h-9 px-3 rounded-lg border border-slate-200 text-sm outline-none focus:border-violet-500" />
                    <button type="button" onClick={addMonth}
                      className="px-3 h-9 rounded-lg bg-violet-100 text-violet-700 text-xs font-bold hover:bg-violet-200 shrink-0 inline-flex items-center gap-1">
                      <Plus size={12} /> 추가
                    </button>
                  </div>
                  {/* 응답 화면 미리보기 힌트 */}
                  {monthList.length > 0 && (
                    <div className="rounded-lg border border-violet-100 bg-white p-2.5 space-y-1">
                      <p className="text-[10px] font-bold text-violet-600">응답자 화면 (참고)</p>
                      {monthList.map((m, i) => (
                        <div key={i} className="rounded-lg bg-violet-50/50 px-3 py-2">
                          <p className="text-xs font-bold text-violet-700">📅 {m}</p>
                          {Array.from({ length: priorities }, (_, pi) => (
                            <div key={pi} className="flex gap-2 mt-1 text-[11px] text-slate-500">
                              <span className="font-bold w-10">{pi + 1}순위</span>
                              <span className="flex-1 border-b border-dashed border-slate-200">날짜  예) 6월 10일(화)</span>
                              <span className="flex-1 border-b border-dashed border-slate-200">시작시간  예) 14:00</span>
                              <span className="flex-1 border-b border-dashed border-slate-200">진행시간  예) 2시간</span>
                            </div>
                          ))}
                        </div>
                      ))}
                    </div>
                  )}
                </div>
              )}

              {/* 동아리 자동완성 안내 */}
              {newType === 'club-autofill' && (
                <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                  응답자가 동아리(팀)를 선택하면 지도교사명·연락처를 프로그램 동아리 목록에서 자동으로 불러와요.
                  동아리 탭에서 먼저 동아리를 등록해야 목록이 표시돼요.
                </p>
              )}

              {/* 필수 + 버튼 */}
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)}
                    className="rounded text-violet-600" />
                  필수 응답
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={resetForm}
                    className="px-3 h-8 rounded-lg text-xs text-slate-600 hover:bg-slate-100">취소</button>
                  <button type="button" onClick={commitQuestion}
                    className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
                    <Plus size={12} /> {editingId ? '수정 완료' : '문항 추가'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowForm(true)}
              className="w-full inline-flex items-center justify-center gap-1 px-3 h-9 rounded-lg border border-dashed border-violet-300 text-violet-700 text-xs font-bold hover:bg-violet-50">
              <Plus size={12} /> 문항 추가
            </button>
          )}

          {/* 하단 안내문 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              하단 안내문 <span className="text-slate-400 font-normal">(선택) — 문항 아래·제출 버튼 위에 표시돼요</span>
            </label>
            <textarea value={footer} onChange={(e) => setFooter(e.target.value)} rows={2}
              placeholder="예) 제출 후 수정이 어려우니 신중히 작성해 주세요.&#10;문의: 운영사무국 010-0000-0000"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 resize-none leading-relaxed" />
          </div>

          {/* 응답자 미리보기 */}
          <SurveyFormPreviewPanel questions={questions} description={description} footer={footer} />

          {/* 활성 토글 */}
          <label className="flex items-center gap-2 px-3 py-2 rounded-lg border border-slate-200 bg-white cursor-pointer text-xs">
            <input type="checkbox" checked={isActive} onChange={(e) => setIsActive(e.target.checked)}
              className="rounded text-violet-600" />
            <span className="text-slate-700 font-semibold">활성 (외부 토큰 페이지에서 응답 수집)</span>
          </label>
        </div>

        <footer className="sticky bottom-0 bg-white px-5 py-4 border-t border-slate-100 flex items-center justify-end gap-2 rounded-b-2xl">
          <button type="button" onClick={onClose} disabled={saving}
            className="px-4 h-10 rounded-lg text-sm text-slate-600 hover:bg-slate-100">취소</button>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />}
            {form ? '수정 저장' : '설문 등록'}
          </button>
        </footer>
      </div>
    </div>
  );

  function toggleTarget(key: string) {
    setTargets((prev) => prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]);
  }
}
