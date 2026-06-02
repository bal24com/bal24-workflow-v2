// 박경수님 2026-06-02 STEP-RECRUIT-CUSTOM-QUESTIONS — 신청 폼 추가 질문 에디터.
// PM 이 프로그램별로 (희망 일정·동기·기타) 자유 질문을 추가·수정·삭제하는 카드.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Trash2, Save, Loader2, MessageSquarePlus } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import {
  APP_QUESTION_TYPE_LABEL,
  type AppQuestion,
  type AppQuestionType,
} from '../../../../types/application';

interface Props {
  /** 프로그램 ID — 비어 있으면(신규 프로그램 작성 마법사) 안내문만 노출 */
  programId: string | null;
}

interface DraftQuestion extends AppQuestion {
  /** 새로 추가된 행 식별 (저장 후에는 의미 없음) */
  isNew?: boolean;
}

const TYPE_VALUES: AppQuestionType[] = ['text', 'select', 'number', 'date'];

function genId(): string {
  return `q_${Math.random().toString(36).slice(2, 8)}_${Date.now().toString(36).slice(-4)}`;
}

export default function RecruitQuestionEditor({ programId }: Props) {
  const toast = useToast();
  const [questions, setQuestions] = useState<DraftQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // 새 질문 인라인 폼 상태
  const [showForm, setShowForm] = useState(false);
  const [newLabel, setNewLabel] = useState('');
  const [newType, setNewType] = useState<AppQuestionType>('text');
  const [newOptions, setNewOptions] = useState('');
  const [newRequired, setNewRequired] = useState(false);

  const reload = useCallback(async () => {
    if (!programId) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase
      .from('programs')
      .select('application_questions')
      .eq('id', programId)
      .maybeSingle();
    if (error) {
      console.error('[RecruitQuestionEditor] 조회 실패:', error.message);
      toast.error('추가 질문을 불러오지 못했어요.');
      setLoading(false);
      return;
    }
    const raw = (data?.application_questions ?? []) as unknown;
    const list = Array.isArray(raw) ? (raw as AppQuestion[]) : [];
    setQuestions(list.map((q) => ({ ...q })));
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  function resetForm() {
    setNewLabel(''); setNewType('text'); setNewOptions(''); setNewRequired(false);
    setShowForm(false);
  }

  function addQuestion() {
    const label = newLabel.trim();
    if (!label) { toast.error('질문 레이블을 입력해 주세요.'); return; }
    const opts = newType === 'select'
      ? newOptions.split(',').map((s) => s.trim()).filter(Boolean)
      : undefined;
    if (newType === 'select' && (!opts || opts.length === 0)) {
      toast.error('선택형은 선택지를 최소 1개 입력해 주세요. (쉼표 구분)');
      return;
    }
    const q: DraftQuestion = {
      id: genId(),
      label,
      type: newType,
      options: opts,
      required: newRequired,
      isNew: true,
    };
    setQuestions((prev) => [...prev, q]);
    resetForm();
  }

  function removeQuestion(id: string) {
    if (!window.confirm('이 질문을 삭제할까요? 저장 후에는 되돌릴 수 없어요.')) return;
    setQuestions((prev) => prev.filter((q) => q.id !== id));
  }

  async function handleSave() {
    if (!programId) { toast.error('프로그램을 먼저 저장한 뒤 추가 질문을 등록해 주세요.'); return; }
    setSaving(true);
    // isNew 플래그 제거 후 저장 (DB에는 AppQuestion 형태만)
    const payload: AppQuestion[] = questions.map((q) => ({
      id: q.id, label: q.label, type: q.type, options: q.options, required: q.required,
    }));
    const { error } = await supabase
      .from('programs')
      .update({ application_questions: payload, updated_at: new Date().toISOString() })
      .eq('id', programId);
    setSaving(false);
    if (error) {
      console.error('[RecruitQuestionEditor] 저장 실패:', error.message);
      toast.error('추가 질문 저장 중 오류가 발생했어요.');
      return;
    }
    toast.success('추가 질문을 저장했어요.');
    void reload();
  }

  // 프로그램 신규 생성 단계 — programId 가 아직 없는 경우 안내문만
  if (!programId) {
    return (
      <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 text-xs text-slate-600 leading-relaxed">
        <p className="font-bold text-violet-700 mb-0.5 inline-flex items-center gap-1">
          <MessageSquarePlus size={12} aria-hidden="true" /> 신청 폼 추가 질문
        </p>
        프로그램을 먼저 저장하고 [수정]에 다시 들어오면 희망 일정·동기 같은 자유 질문을 추가할 수 있어요.
      </div>
    );
  }

  return (
    <div className="rounded-xl border border-violet-100 bg-white p-4 space-y-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
          <MessageSquarePlus size={14} aria-hidden="true" />
          신청 폼 추가 질문 ({questions.length})
        </h3>
        <button type="button" onClick={() => void handleSave()} disabled={saving || loading}
          className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} aria-hidden="true" />}
          저장하기
        </button>
      </div>

      <p className="text-[11px] text-slate-500">
        외부 신청자가 답변할 자유 질문이에요. 예) 희망 참가 일정·동기·소속 부서 등. 신청 폼에서 함께 노출돼요.
      </p>

      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : (
        <div className="space-y-1.5">
          {questions.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">아직 추가된 질문이 없어요.</p>
          ) : questions.map((q, i) => (
            <div key={q.id} className="flex items-center gap-2 p-2 rounded-lg border border-slate-100 bg-slate-50">
              <span className="text-[10px] font-bold text-slate-400 w-5 tabular-nums">{i + 1}</span>
              <div className="flex-1 min-w-0">
                <div className="flex items-center gap-1.5 flex-wrap">
                  <span className="text-sm font-semibold text-[#1E1B4B] truncate">{q.label}</span>
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-violet-100 text-violet-700">
                    {APP_QUESTION_TYPE_LABEL[q.type]}
                  </span>
                  {q.required && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-rose-100 text-rose-700">필수</span>
                  )}
                  {q.isNew && (
                    <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-amber-100 text-amber-700">미저장</span>
                  )}
                </div>
                {q.type === 'select' && q.options && q.options.length > 0 && (
                  <p className="text-[11px] text-slate-500 mt-0.5 truncate">선택지 — {q.options.join(' · ')}</p>
                )}
              </div>
              <button type="button" onClick={() => removeQuestion(q.id)}
                className="p-1 rounded hover:bg-rose-50 text-rose-500" aria-label="질문 삭제">
                <Trash2 size={12} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      {/* 인라인 추가 폼 */}
      {showForm ? (
        <div className="rounded-xl border border-violet-200 bg-violet-50/40 p-3 space-y-2">
          <div className="grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2">
            <input type="text" value={newLabel} onChange={(e) => setNewLabel(e.target.value)}
              placeholder="질문 레이블 (예: 희망 참가 일정)"
              className="h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
            <select value={newType} onChange={(e) => setNewType(e.target.value as AppQuestionType)}
              className="h-9 rounded-lg border border-slate-200 px-2 text-sm bg-white outline-none focus:border-violet-500">
              {TYPE_VALUES.map((t) => (
                <option key={t} value={t}>{APP_QUESTION_TYPE_LABEL[t]}</option>
              ))}
            </select>
          </div>
          {newType === 'select' && (
            <input type="text" value={newOptions} onChange={(e) => setNewOptions(e.target.value)}
              placeholder="선택지 (쉼표 구분) — 예: 1회차(6/10), 2회차(6/17), 모두 가능"
              className="w-full h-9 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
          )}
          <div className="flex items-center justify-between gap-2 flex-wrap">
            <label className="inline-flex items-center gap-1.5 text-xs text-slate-600 cursor-pointer">
              <input type="checkbox" checked={newRequired} onChange={(e) => setNewRequired(e.target.checked)}
                className="rounded text-violet-600" />
              필수 응답
            </label>
            <div className="flex items-center gap-2">
              <button type="button" onClick={resetForm}
                className="px-3 h-8 rounded-lg text-xs text-slate-600 hover:bg-slate-100">취소</button>
              <button type="button" onClick={addQuestion}
                className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
                <Plus size={12} aria-hidden="true" /> 질문 추가
              </button>
            </div>
          </div>
          <p className="text-[10px] text-slate-400">
            추가 후에도 상단 [저장하기] 를 눌러야 외부 신청 폼에 반영돼요.
          </p>
        </div>
      ) : (
        <button type="button" onClick={() => setShowForm(true)}
          className="w-full inline-flex items-center justify-center gap-1 px-3 h-9 rounded-lg border border-dashed border-violet-300 text-violet-700 text-xs font-bold hover:bg-violet-50">
          <Plus size={12} aria-hidden="true" /> 질문 추가
        </button>
      )}
    </div>
  );
}
