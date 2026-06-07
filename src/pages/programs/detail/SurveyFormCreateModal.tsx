// 박경수님 2026-06-02 STEP-SURVEY-MULTI-TARGET — 설문 정의 생성·수정 모달.
// 제목·종류·문항(text/select/number/date/textarea) + 4역할 응답 대상 선택.

import { useEffect, useRef, useState } from 'react';
import { Plus, Save, X, Trash2, Loader2, Sparkles, Upload, Edit3 } from 'lucide-react';
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
  /** 편집 모드 (없으면 신규) */
  form?: ProgramSurveyForm | null;
  onClose: () => void;
  onSaved: () => void;
}

const KIND_VALUES: SurveyFormKind[] = ['pre-demand', 'mid', 'satisfaction', 'custom'];
const QUESTION_TYPE_VALUES: SurveyFormQuestionType[] = ['text', 'textarea', 'select', 'checkbox', 'number', 'date', 'date-schedule', 'club-autofill'];
const QUESTION_TYPE_LABEL: Record<SurveyFormQuestionType, string> = {
  text:          '단답형',
  textarea:      '서술형',
  select:        '선택형 (1개)',
  checkbox:      '다중 선택',
  number:        '숫자',
  date:          '날짜',
  'date-schedule':  '월별 일정 수요조사',
  'club-autofill':  '동아리 선택 + 자동완성',
};

const TARGET_AUDIENCES = [
  { key: 'supporter',   label: '지원기관' },
  { key: 'beneficiary', label: '수혜기관' },
  { key: 'team',        label: '참여팀(개인)' },
  { key: 'staff',       label: '강사/멘토' },
] as const;

function genId(): string {
  return `q_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
}

export default function SurveyFormCreateModal({ programId, form, onClose, onSaved }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(form?.title ?? '');
  const [description, setDescription] = useState(form?.description ?? '');
  const [kind, setKind] = useState<SurveyFormKind>(form?.kind ?? 'custom');
  const [questions, setQuestions] = useState<SurveyFormQuestion[]>(form?.questions ?? []);
  const [targets, setTargets] = useState<string[]>(form?.target_audiences ?? []);
  const [isActive, setIsActive] = useState<boolean>(form?.is_active ?? true);
  const [saving, setSaving] = useState(false);
  const mouseDownOnBackdropRef = useRef(false);

  // 새 문항 폼
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<SurveyFormQuestionType>('text');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);
  const [newMonths, setNewMonths] = useState('');
  const [newPriorities, setNewPriorities] = useState<number>(2);
  // 편집 중인 문항 id (null이면 신규 추가 모드)
  const [editingQuestionId, setEditingQuestionId] = useState<string | null>(null);

  // 박경수님 2026-06-02 STEP-SURVEY-AI-IMPORT — AI 자동 생성
  const [aiLoading, setAiLoading] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  async function handleAiImport(file: File) {
    setAiLoading(true);
    try {
      const parsed = await importSurveyFromFile(file);
      // 박경수님이 직접 검토할 수 있도록 — 기존 입력값은 비어 있으면 채우고, 문항은 합치기
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
    setKind(form?.kind ?? 'custom');
    setQuestions(form?.questions ?? []);
    setTargets(form?.target_audiences ?? []);
    setIsActive(form?.is_active ?? true);
  }, [form]);

  function toggleTarget(key: string) {
    setTargets((prev) => prev.includes(key) ? prev.filter((t) => t !== key) : [...prev, key]);
  }

  function addQuestion() {
    const label = newLabel.trim();
    if (!label) { toast.error('문항 레이블을 입력해 주세요.'); return; }
    // 박경수님 2026-06-02 — select·checkbox 둘 다 옵션 필요
    const needsOptions = newType === 'select' || newType === 'checkbox';
    const opts = needsOptions
      ? newOptions.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    if (needsOptions && (!opts || opts.length === 0)) {
      toast.error('선택형·다중 선택은 선택지를 1개 이상 입력해 주세요. (쉼표 구분)');
      return;
    }
    // date-schedule 전용: options = 월 목록
    const monthOpts = newType === 'date-schedule'
      ? newMonths.split(',').map((s) => s.trim()).filter(Boolean) : undefined;
    if (newType === 'date-schedule' && (!monthOpts || monthOpts.length === 0)) {
      toast.error('월별 수요조사는 월 목록을 1개 이상 입력해 주세요. (예: 6월, 9월, 10월)');
      return;
    }
    const newQ = {
      id: editingQuestionId ?? genId(), label, type: newType,
      options: opts ?? monthOpts,
      required: newRequired,
      priorities: newType === 'date-schedule' ? newPriorities : undefined,
    };
    if (editingQuestionId) {
      setQuestions((prev) => prev.map((q) => q.id === editingQuestionId ? newQ : q));
    } else {
      setQuestions((prev) => [...prev, newQ]);
    }
    setNewLabel(''); setNewType('text'); setNewOptions(''); setNewRequired(false);
    setNewMonths(''); setNewPriorities(2); setEditingQuestionId(null);
    setShowForm(false);
  }

  function startEditQuestion(q: SurveyFormQuestion) {
    setNewLabel(q.label);
    setNewType(q.type);
    setNewOptions(q.type === 'select' || q.type === 'checkbox' ? (q.options ?? []).join(', ') : '');
    setNewMonths(q.type === 'date-schedule' ? (q.options ?? []).join(', ') : '');
    setNewPriorities(q.priorities ?? 2);
    setNewRequired(q.required);
    setEditingQuestionId(q.id);
    setShowForm(true);
  }

  function removeQuestion(id: string) {
    if (!window.confirm('이 문항을 삭제할까요?')) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function handleSave() {
    if (!title.trim()) { toast.error('설문 제목을 입력해 주세요.'); return; }
    if (questions.length === 0) { toast.error('문항을 1개 이상 추가해 주세요.'); return; }
    if (targets.length === 0) { toast.error('응답 대상 역할을 1개 이상 선택해 주세요.'); return; }
    setSaving(true);
    const payload = {
      program_id: programId,
      title: title.trim(),
      description: description.trim() || null,
      kind,
      questions,
      target_audiences: targets,
      is_active: isActive,
      updated_at: new Date().toISOString(),
    };
    const { error } = form
      ? await supabase.from('program_survey_forms').update(payload).eq('id', form.id)
      : await supabase.from('program_survey_forms').insert(payload);
    setSaving(false);
    if (error) {
      console.error('[SurveyFormCreateModal] 저장 실패:', error.message);
      toast.error('설문 저장에 실패했어요.');
      return;
    }
    toast.success(form ? '설문을 수정했어요.' : '설문을 등록했어요.');
    onSaved();
    onClose();
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50"
      onMouseDown={(e) => { mouseDownOnBackdropRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) onClose(); }}>
      <div className="bg-white rounded-2xl w-full max-w-2xl max-h-[90vh] overflow-y-auto shadow-xl">
        <header className="sticky top-0 bg-white px-5 py-4 border-b border-slate-100 flex items-center justify-between rounded-t-2xl z-10">
          <h3 className="text-base font-bold text-[#1E1B4B]">
            {form ? '설문 수정' : '새 설문 만들기'}
          </h3>
          <button type="button" onClick={onClose} aria-label="닫기" className="p-1 rounded hover:bg-slate-100">
            <X size={16} aria-hidden="true" />
          </button>
        </header>

        <div className="p-5 space-y-4">
          {/* 박경수님 2026-06-02 STEP-SURVEY-AI-IMPORT — AI 자동 생성 영역 */}
          {!form && (
            <div className="rounded-xl border border-dashed border-violet-300 bg-violet-50/50 p-3 space-y-2">
              <div className="flex items-center justify-between gap-2 flex-wrap">
                <p className="text-xs font-bold text-violet-700 inline-flex items-center gap-1">
                  <Sparkles size={12} aria-hidden="true" /> AI 자동 생성 (PDF·이미지)
                </p>
                <button type="button" disabled={aiLoading}
                  onClick={() => fileInputRef.current?.click()}
                  className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
                  {aiLoading
                    ? (<><Loader2 size={12} className="animate-spin" aria-hidden="true" /> 분석 중…</>)
                    : (<><Upload size={12} aria-hidden="true" /> 파일 첨부</>)}
                </button>
              </div>
              <p className="text-[10px] text-slate-500 leading-relaxed">
                기존 설문 양식(PDF·JPG·PNG)을 첨부하면 AI 가 문항을 추출해 자동 입력해요.
                추출 후 문항을 검토·수정한 뒤 [설문 등록] 을 눌러 주세요.
              </p>
              <input ref={fileInputRef} type="file" accept=".pdf,image/jpeg,image/png,image/webp"
                className="hidden"
                onChange={(e) => {
                  const f = e.target.files?.[0];
                  if (f) void handleAiImport(f);
                }} />
            </div>
          )}

          {/* 제목·종류 */}
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_140px] gap-2">
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">설문 제목 *</label>
              <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
                placeholder="예) 2026 사전 수요조사"
                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
            </div>
            <div className="space-y-1">
              <label className="text-xs font-bold text-slate-700">종류 *</label>
              <select value={kind} onChange={(e) => setKind(e.target.value as SurveyFormKind)}
                className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm bg-white outline-none focus:border-violet-500">
                {KIND_VALUES.map((k) => (
                  <option key={k} value={k}>{SURVEY_FORM_KIND_LABEL[k]}</option>
                ))}
              </select>
            </div>
          </div>

          {/* 상단 안내문 */}
          <div className="space-y-1">
            <label className="text-xs font-bold text-slate-700">
              상단 안내문 <span className="text-slate-400 font-normal">(선택) — 응답자 화면 상단에 표시돼요</span>
            </label>
            <textarea
              value={description}
              onChange={(e) => setDescription(e.target.value)}
              rows={3}
              placeholder="예) 안녕하세요! 멘토링 사전 수요조사입니다. 팀별로 1명이 응답해 주세요. 작성 기한: 6월 20일"
              className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 resize-none leading-relaxed"
            />
          </div>

          {/* 응답 대상 4역할 */}
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-700">응답 대상 역할 * (중복 선택 가능)</label>
            <div className="grid grid-cols-2 sm:grid-cols-4 gap-1.5">
              {TARGET_AUDIENCES.map((t) => {
                const checked = targets.includes(t.key);
                return (
                  <label key={t.key} className={`flex items-center gap-1.5 px-3 py-2 rounded-lg border cursor-pointer text-xs ${
                    checked ? 'border-violet-200 bg-violet-50 text-violet-700' : 'border-slate-200 bg-white text-slate-500 hover:bg-slate-50'
                  }`}>
                    <input type="checkbox" checked={checked} onChange={() => toggleTarget(t.key)}
                      className="rounded text-violet-600" />
                    <span className="font-semibold">{t.label}</span>
                  </label>
                );
              })}
            </div>
          </div>

          {/* 문항 목록 */}
          <div className="space-y-1.5">
            <div className="flex items-center justify-between">
              <label className="text-xs font-bold text-slate-700">문항 ({questions.length})</label>
            </div>
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
                        {q.required && (
                          <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">필수</span>
                        )}
                      </div>
                      {(q.type === 'select' || q.type === 'checkbox') && q.options && (
                        <p className="text-[11px] text-slate-500 mt-0.5 truncate">{q.options.join(' · ')}</p>
                      )}
                    </div>
                    <button type="button" onClick={() => startEditQuestion(q)}
                      className="p-1 rounded hover:bg-violet-50 text-violet-500"><Edit3 size={12} aria-hidden="true" /></button>
                    <button type="button" onClick={() => removeQuestion(q.id)}
                      className="p-1 rounded hover:bg-rose-50 text-rose-500"><Trash2 size={12} aria-hidden="true" /></button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* 새 문항 추가 */}
          {showForm ? (
            <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
              <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
                <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
                  placeholder="문항 (예: 희망 분야)"
                  className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
                <select value={newType} onChange={(e) => setNewType(e.target.value as SurveyFormQuestionType)}
                  className="h-9 rounded-lg border border-slate-200 px-2 text-sm bg-white outline-none focus:border-violet-500">
                  {QUESTION_TYPE_VALUES.map((t) => (
                    <option key={t} value={t}>{QUESTION_TYPE_LABEL[t]}</option>
                  ))}
                </select>
              </div>
              {(newType === 'select' || newType === 'checkbox') && (
                <input type="text" value={newOptions} onChange={(e) => setNewOptions(e.target.value)}
                  placeholder="선택지 (쉼표 구분) — 예: AI, 데이터분석, 마케팅"
                  className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
              )}
              {newType === 'date-schedule' && (
                <div className="grid grid-cols-[1fr_120px] gap-2">
                  <input type="text" value={newMonths} onChange={(e) => setNewMonths(e.target.value)}
                    placeholder="월 목록 (쉼표 구분) — 예: 6월, 9월, 10월"
                    className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
                  <select value={newPriorities} onChange={(e) => setNewPriorities(Number(e.target.value))}
                    className="h-9 rounded-lg border border-slate-200 px-2 text-sm bg-white outline-none focus:border-violet-500">
                    <option value={1}>1순위만</option>
                    <option value={2}>1·2순위</option>
                  </select>
                </div>
              )}
              {newType === 'club-autofill' && (
                <p className="text-[11px] text-violet-700 bg-violet-50 border border-violet-100 rounded-lg px-3 py-2">
                  동아리 선택 시 지도교사명·연락처를 프로그램 동아리 목록에서 자동으로 불러와요.
                </p>
              )}
              <div className="flex items-center justify-between gap-2">
                <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
                  <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)}
                    className="rounded text-violet-600" />
                  필수 응답
                </label>
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => { setShowForm(false); setNewLabel(''); setEditingQuestionId(null); }}
                    className="px-3 h-8 rounded-lg text-xs text-slate-600 hover:bg-slate-100">취소</button>
                  <button type="button" onClick={addQuestion}
                    className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
                    <Plus size={12} aria-hidden="true" /> {editingQuestionId ? '수정 완료' : '문항 추가'}
                  </button>
                </div>
              </div>
            </div>
          ) : (
            <button type="button" onClick={() => setShowForm(true)}
              className="w-full inline-flex items-center justify-center gap-1 px-3 h-9 rounded-lg border border-dashed border-violet-300 text-violet-700 text-xs font-bold hover:bg-violet-50">
              <Plus size={12} aria-hidden="true" /> 문항 추가
            </button>
          )}

          {/* 응답자 미리보기 — 항상 표시 */}
          <SurveyFormPreviewPanel questions={questions} description={description} />

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
            {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} aria-hidden="true" />}
            {form ? '수정 저장' : '설문 등록'}
          </button>
        </footer>
      </div>
    </div>
  );
}
