// PM 내부 설문 관리 — 프로그램별 설문 생성·문항 추가·활성화 토글·결과 보기.
// 박경수님 2026-05-28 STEP-SCHOOL-PORTAL PART D-5.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Power, BarChart3, Trash2 } from 'lucide-react';
import {
  getSurveysByProgram, createSurvey, toggleSurveyActive, addQuestion, deleteQuestion,
} from '../../../hooks/portal/useSurvey';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import SurveyResultsView from './SurveyResultsView';
import type { Survey, SurveyQuestion, SurveyType, QuestionType } from '../../../types/schoolPortal';

interface Props { programId: string; projectId?: string | null }

const TYPE_OPTIONS: Array<{ v: SurveyType; label: string }> = [
  { v: 'satisfaction', label: '만족도' },
  { v: 'schedule',     label: '일정' },
  { v: 'general',      label: '일반' },
];

const QUESTION_TYPES: Array<{ v: QuestionType; label: string }> = [
  { v: 'rating', label: '별점 1~5' },
  { v: 'choice', label: '선택지' },
  { v: 'text',   label: '주관식' },
];

export default function ProgramSurveyManagerTab({ programId, projectId }: Props) {
  const { user } = useAuth();
  const [surveys, setSurveys] = useState<Survey[]>([]);
  const [loading, setLoading] = useState(true);
  const [showCreate, setShowCreate] = useState(false);
  const [newTitle, setNewTitle] = useState('');
  const [newDesc, setNewDesc] = useState('');
  const [newType, setNewType] = useState<SurveyType>('satisfaction');
  const [newDue, setNewDue] = useState('');
  const [expandedId, setExpandedId] = useState<string | null>(null);
  const [resultsId, setResultsId] = useState<{ id: string; title: string } | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    setSurveys(await getSurveysByProgram(programId));
    setLoading(false);
  }, [programId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleCreate = async () => {
    if (!newTitle.trim()) { alert('제목을 입력해 주세요.'); return; }
    const res = await createSurvey({
      project_id: projectId ?? null,
      program_id: programId,
      title: newTitle.trim(),
      description: newDesc.trim() || null,
      target_scope: 'team',
      survey_type: newType,
      due_date: newDue || null,
      created_by: user?.id ?? null,
      is_active: true,
    });
    if (res.error) { alert(res.error); return; }
    setNewTitle(''); setNewDesc(''); setNewType('satisfaction'); setNewDue('');
    setShowCreate(false);
    void refresh();
  };

  const handleToggle = async (s: Survey) => {
    const res = await toggleSurveyActive(s.id, !s.is_active);
    if (res.error) { alert(res.error); return; }
    void refresh();
  };

  if (loading) {
    return <div className="flex justify-center py-12"><Loader2 className="animate-spin text-violet-500" size={24} /></div>;
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h2 className="text-base font-bold text-slate-800">설문 관리 ({surveys.length})</h2>
        <button type="button" onClick={() => setShowCreate((p) => !p)}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold bg-violet-600 text-white hover:bg-violet-700">
          <Plus size={12} /> 새 설문
        </button>
      </div>

      {showCreate && (
        <section className="bg-white rounded-2xl border border-violet-200 p-4 space-y-2">
          <input value={newTitle} onChange={(e) => setNewTitle(e.target.value)}
            placeholder="설문 제목" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <textarea value={newDesc} onChange={(e) => setNewDesc(e.target.value)}
            rows={2} placeholder="설명 (선택)" className="w-full border border-slate-300 rounded-lg px-3 py-2 text-sm outline-none focus:border-violet-500 resize-none" />
          <div className="grid grid-cols-2 gap-2">
            <select value={newType} onChange={(e) => setNewType(e.target.value as SurveyType)}
              className="border border-slate-300 rounded-lg px-3 py-2 text-sm">
              {TYPE_OPTIONS.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
            </select>
            <input type="date" value={newDue} onChange={(e) => setNewDue(e.target.value)}
              placeholder="마감일" className="border border-slate-300 rounded-lg px-3 py-2 text-sm" />
          </div>
          <button type="button" onClick={() => void handleCreate()}
            className="w-full px-3 py-2 rounded-md text-sm font-bold bg-violet-600 text-white hover:bg-violet-700">
            저장
          </button>
        </section>
      )}

      {surveys.length === 0 ? (
        <p className="bg-white rounded-2xl text-sm text-slate-400 italic text-center py-10">
          등록된 설문이 없어요. [새 설문] 버튼으로 추가하세요.
        </p>
      ) : (
        <ul className="space-y-2">
          {surveys.map((s) => (
            <li key={s.id} className="bg-white rounded-xl border border-slate-200 overflow-hidden">
              <div className="flex items-center gap-2 px-4 py-3">
                <div className="flex-1 min-w-0">
                  <div className="font-semibold text-sm truncate">{s.title}</div>
                  <div className="text-xs text-slate-500">
                    {TYPE_OPTIONS.find((t) => t.v === s.survey_type)?.label ?? s.survey_type}
                    {s.due_date && ` · 마감 ${s.due_date}`}
                    {!s.is_active && ' · 비활성'}
                  </div>
                </div>
                <button type="button" onClick={() => void handleToggle(s)}
                  className={`inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded ${
                    s.is_active ? 'bg-emerald-50 text-emerald-700' : 'bg-slate-100 text-slate-500'
                  }`}>
                  <Power size={12} /> {s.is_active ? '활성' : '비활성'}
                </button>
                <button type="button" onClick={() => setResultsId({ id: s.id, title: s.title })}
                  className="inline-flex items-center gap-1 text-xs font-bold px-2 py-1 rounded bg-slate-100 hover:bg-slate-200">
                  <BarChart3 size={12} /> 결과
                </button>
                <button type="button" onClick={() => setExpandedId(expandedId === s.id ? null : s.id)}
                  className="text-xs font-bold px-2 py-1 rounded bg-violet-50 text-violet-700">
                  문항 관리
                </button>
              </div>
              {expandedId === s.id && <QuestionEditor surveyId={s.id} />}
            </li>
          ))}
        </ul>
      )}

      {resultsId && (
        <div className="fixed inset-0 z-50 bg-slate-900/40 flex items-center justify-center p-4"
          onClick={(e) => { if (e.target === e.currentTarget) setResultsId(null); }}>
          <div className="bg-white rounded-2xl shadow-xl max-w-2xl w-full max-h-[85vh] overflow-y-auto">
            <header className="px-5 py-3 border-b flex items-center justify-between sticky top-0 bg-white">
              <h3 className="font-bold">{resultsId.title} — 결과</h3>
              <button type="button" onClick={() => setResultsId(null)} className="text-slate-400 hover:text-slate-700">✕</button>
            </header>
            <div className="px-5 py-4">
              <SurveyResultsView surveyId={resultsId.id} surveyTitle={resultsId.title} viewScope="school" />
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

// ─── 문항 추가/삭제 ─────────────────────────
function QuestionEditor({ surveyId }: { surveyId: string }) {
  const [questions, setQuestions] = useState<SurveyQuestion[]>([]);
  const [loading, setLoading] = useState(true);
  const [text, setText] = useState('');
  const [type, setType] = useState<QuestionType>('rating');
  const [opts, setOpts] = useState('');
  const [required, setRequired] = useState(true);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data } = await supabase
      .from('survey_questions').select('*').eq('survey_id', surveyId).order('order_index');
    setQuestions((data ?? []) as SurveyQuestion[]);
    setLoading(false);
  }, [surveyId]);

  useEffect(() => { void refresh(); }, [refresh]);

  const handleAdd = async () => {
    if (!text.trim()) { alert('문항 내용을 입력해 주세요.'); return; }
    const options = type === 'choice' ? opts.split('\n').map((s) => s.trim()).filter(Boolean) : [];
    const res = await addQuestion(surveyId, {
      question_text: text, question_type: type, options, is_required: required,
      order_index: questions.length,
    });
    if (res.error) { alert(res.error); return; }
    setText(''); setOpts(''); setType('rating'); setRequired(true);
    void refresh();
  };

  const handleDelete = async (qId: string) => {
    if (!window.confirm('문항을 삭제할까요?')) return;
    const res = await deleteQuestion(qId);
    if (res.error) { alert(res.error); return; }
    void refresh();
  };

  return (
    <div className="bg-slate-50 px-4 py-3 border-t space-y-3">
      {loading ? (
        <div className="flex justify-center py-2"><Loader2 className="animate-spin text-violet-400" size={16} /></div>
      ) : (
        <ul className="space-y-1.5 text-sm">
          {questions.map((q, i) => (
            <li key={q.id} className="flex items-center gap-2 bg-white border border-slate-200 rounded px-2 py-1.5">
              <span className="text-xs text-slate-400 w-5 tabular-nums">{i + 1}</span>
              <span className="text-[10px] bg-violet-100 text-violet-700 rounded px-1.5 py-0.5 font-bold shrink-0">
                {QUESTION_TYPES.find((t) => t.v === q.question_type)?.label}
              </span>
              <span className="flex-1 truncate">{q.question_text}</span>
              <button type="button" onClick={() => void handleDelete(q.id)} className="text-rose-500 hover:bg-rose-50 p-1 rounded">
                <Trash2 size={12} />
              </button>
            </li>
          ))}
          {questions.length === 0 && <li className="text-xs text-slate-400 italic text-center py-2">문항이 없어요.</li>}
        </ul>
      )}

      <div className="bg-white border border-slate-200 rounded p-2 space-y-2">
        <input value={text} onChange={(e) => setText(e.target.value)}
          placeholder="문항 내용" className="w-full border border-slate-300 rounded px-2 py-1.5 text-sm outline-none focus:border-violet-500" />
        <div className="grid grid-cols-3 gap-2 items-center">
          <select value={type} onChange={(e) => setType(e.target.value as QuestionType)}
            className="border border-slate-300 rounded px-2 py-1.5 text-xs">
            {QUESTION_TYPES.map((t) => <option key={t.v} value={t.v}>{t.label}</option>)}
          </select>
          <label className="text-xs text-slate-600 inline-flex items-center gap-1">
            <input type="checkbox" checked={required} onChange={(e) => setRequired(e.target.checked)} className="accent-violet-600" />
            필수
          </label>
          <button type="button" onClick={() => void handleAdd()}
            className="text-xs font-bold px-2 py-1.5 rounded bg-violet-600 text-white hover:bg-violet-700">
            <Plus size={10} className="inline" /> 문항 추가
          </button>
        </div>
        {type === 'choice' && (
          <textarea value={opts} onChange={(e) => setOpts(e.target.value)}
            rows={3} placeholder="보기 (줄바꿈으로 구분)"
            className="w-full border border-slate-300 rounded px-2 py-1.5 text-xs outline-none focus:border-violet-500 resize-none" />
        )}
      </div>
    </div>
  );
}
