// bal24 v2 — STEP-CURRICULUM-ATTEND-SURVEY-FULL 만족도 분석 결과 카드
//   STEP-SURVEY-AI — [AI 분석] 버튼 → 항목별·전체 인사이트 (Claude 호출 → satisfaction_surveys UPDATE)
//   STEP-SURVEY-ACCORDION-UI — 문항별 아코디언 + 차트 유형 선택

import { useEffect, useMemo, useState } from 'react';
import {
  Star, FileText, Trash2, Sparkles, Loader2, Download, FileBarChart,
  BarChart3, BarChartHorizontal, PieChart as PieIcon,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { callAi } from '../../../lib/aiClient';
import { useToast } from '../../../contexts/ToastContext';
import SurveyAiAnalysisPanel from './SurveyAiAnalysisPanel';
import SurveyQuestionAccordion, {
  type AccordionQuestion, type AccordionResponse,
} from './SurveyQuestionAccordion';
import { type ChartType } from './SurveyChartPanel';
import type { SatisfactionSurvey } from '../../../types/database';

interface Props {
  survey: SatisfactionSurvey;
  onDelete?: () => void;
  onAnalyzed?: () => void;
  /** 결과보고서 전송 + survey_questions/responses fetch에 사용 */
  programId?: string;
}

const AI_SYSTEM = `너는 교육·캠프 만족도 설문 분석가야. 응답 데이터를 받아 JSON으로만 반환해.
형식: { "per_question": { "문항명": "1-2문장 인사이트" }, "overall": "전체 5문장 이내 핵심 요약" }
- 평균이 낮은 항목·자유서술 부정 의견을 강조하고, 개선 방향 1줄 포함
- 모든 텍스트 한글. 마크다운 금지. JSON 외 출력 금지.`;

function formatDateTime(iso: string): string {
  try {
    const d = new Date(iso);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')} ${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
  } catch { return iso; }
}

const CHART_TYPES: { value: ChartType; label: string; Icon: typeof BarChart3 }[] = [
  { value: 'bar',        label: '세로 막대', Icon: BarChart3 },
  { value: 'horizontal', label: '가로 막대', Icon: BarChartHorizontal },
  { value: 'pie',        label: '원형',      Icon: PieIcon },
];

export default function SurveyResultCard({ survey, onDelete, onAnalyzed, programId }: Props) {
  const toast = useToast();
  const [analyzing, setAnalyzing] = useState(false);
  const [chartType, setChartType] = useState<ChartType>('bar');
  const [questions, setQuestions] = useState<AccordionQuestion[]>([]);
  const [responses, setResponses] = useState<AccordionResponse[]>([]);
  const overall = survey.avg_overall != null ? Number(survey.avg_overall) : null;
  const hasAi = Boolean(survey.ai_overall || (survey.ai_per_question && Object.keys(survey.ai_per_question).length > 0));

  // STEP-SURVEY-ACCORDION-UI — 문항·응답 fetch (program 단위)
  useEffect(() => {
    if (!programId) { setQuestions([]); setResponses([]); return; }
    let cancelled = false;
    void (async () => {
      const [qRes, rRes] = await Promise.all([
        supabase.from('survey_questions').select('id, question_text, question_type, order_index')
          .eq('program_id', programId).order('order_index'),
        supabase.from('survey_responses').select('question_id, answer_score, answer_text')
          .eq('program_id', programId),
      ]);
      if (cancelled) return;
      if (qRes.error) console.warn('[survey-card] survey_questions 조회 경고:', qRes.error.message);
      if (rRes.error) console.warn('[survey-card] survey_responses 조회 경고:', rRes.error.message);
      setQuestions((qRes.data ?? []) as AccordionQuestion[]);
      setResponses((rRes.data ?? []) as AccordionResponse[]);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  // 문항별 분포·평균 (한 번에 묶음)
  const perQuestion = useMemo(() => {
    const map = new Map<string, { count: number; avg: number | null }>();
    for (const q of questions) {
      const rs = responses.filter((r) => r.question_id === q.id);
      const scores = rs.map((r) => r.answer_score).filter((v): v is number => typeof v === 'number');
      const avg = scores.length > 0 ? scores.reduce((a, b) => a + b, 0) / scores.length : null;
      map.set(q.id, { count: rs.length, avg });
    }
    return map;
  }, [questions, responses]);

  // 결과보고서 전송용 — items (star 평균 목록)
  const items: Array<[string, number]> = useMemo(() => {
    return questions
      .filter((q) => q.question_type === 'star')
      .map((q): [string, number | null] => [q.question_text, perQuestion.get(q.id)?.avg ?? null])
      .filter((e): e is [string, number] => typeof e[1] === 'number');
  }, [questions, perQuestion]);

  function handleDownloadReport() {
    const lines = [
      '=== 만족도 조사 분석 리포트 ===',
      `파일: ${survey.file_name ?? '(이름 없음)'}`,
      `총 응답: ${survey.total_count}명`,
      `전반적 만족도: ${overall != null ? `${overall.toFixed(2)}/5.0` : '-'}`,
      '',
      '[항목별 평균]',
      ...items.map(([k, v]) => `${k}: ${v.toFixed(2)}`),
      '',
      '[AI 분석 리포트]',
      survey.ai_overall ?? '(아직 생성되지 않음)',
      '',
      ...(survey.ai_per_question ? ['[항목별 AI 분석]', ...Object.entries(survey.ai_per_question).map(([q, ins]) => `- ${q}: ${ins}`)] : []),
      '',
      '[자유서술]',
      ...(survey.comments ?? []).map((c) => `· ${c}`),
    ];
    const blob = new Blob([lines.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `satisfaction_${survey.id.slice(0, 8)}.txt`;
    a.click(); URL.revokeObjectURL(url);
  }

  async function handleSendToReport() {
    if (!programId) { toast.error('프로그램 정보가 없어요.'); return; }
    const aa = survey.ai_analysis;
    const summary = [
      `만족도 조사 결과 (${survey.total_count}명 응답)`,
      `전반적 만족도: ${overall != null ? `${overall.toFixed(2)}/5.0` : '-'}`,
      '',
      '[항목별 평균]',
      ...items.map(([k, v]) => `${k}: ${v.toFixed(2)}`),
      '',
      aa ? '[AI 종합 분석]' : '',
      aa ? aa.overall : '',
      aa ? '[잘된 점]' : '',
      ...(aa ? aa.strengths.map((s) => `· ${s}`) : []),
      aa ? '[개선 필요]' : '',
      ...(aa ? aa.improvements.map((s) => `· ${s}`) : []),
      aa ? `[핵심 키워드] ${aa.keywords.map((k) => `#${k}`).join(' ')}` : '',
      aa ? `[운영 제언]\n${aa.recommendation}` : '',
      !aa && survey.ai_overall ? `[AI 분석]\n${survey.ai_overall}` : '',
    ].filter(Boolean).join('\n');
    const { error } = await supabase.from('program_report_sections').upsert({
      program_id: programId, section_key: 'satisfaction', content: summary,
      updated_at: new Date().toISOString(),
    }, { onConflict: 'program_id,section_key' });
    if (error) { console.error('[survey→report]', error.message); toast.error('결과보고서 전송에 실패했어요.'); return; }
    toast.success('결과보고서 탭에 반영했어요.');
  }

  async function handleAiAnalyze() {
    setAnalyzing(true);
    try {
      const payload = {
        total_count: survey.total_count, avg_overall: survey.avg_overall,
        per_item_average: survey.summary_json,
        free_comments: (survey.comments ?? []).slice(0, 50),
      };
      const res = await callAi({
        preset: 'chat', systemOverride: AI_SYSTEM,
        messages: [{ role: 'user', content: JSON.stringify(payload) }],
        maxTokens: 2048,
      });
      if (!res.ok || !res.text) { toast.error('AI 분석 응답을 받지 못했어요.'); return; }
      const cleaned = res.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
      let parsed: { per_question?: Record<string, string>; overall?: string } | null = null;
      try { parsed = JSON.parse(cleaned); }
      catch {
        const i = cleaned.indexOf('{');
        if (i >= 0) { try { parsed = JSON.parse(cleaned.slice(i)); } catch { /* noop */ } }
      }
      if (!parsed) { toast.error('AI 응답 JSON 파싱 실패.'); return; }
      const { error } = await supabase.from('satisfaction_surveys').update({
        ai_per_question: parsed.per_question ?? {},
        ai_overall: parsed.overall ?? null,
        ai_analyzed_at: new Date().toISOString(),
      }).eq('id', survey.id);
      if (error) { console.error('[survey-ai] UPDATE 실패:', error.message); toast.error('AI 분석 결과 저장에 실패했어요.'); return; }
      toast.success('AI 분석이 완료됐어요.');
      onAnalyzed?.();
    } catch (err) {
      console.error('[survey-ai] 분석 실패:', err instanceof Error ? err.message : '');
      toast.error('AI 분석 중 오류가 발생했어요.');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-4">
      <header className="flex items-start justify-between gap-3 flex-wrap">
        <div className="min-w-0 flex-1">
          <p className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <FileText size={14} className="text-violet-500" aria-hidden="true" />
            {survey.file_name ?? '만족도 응답'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {formatDateTime(survey.uploaded_at)} · 응답 <strong className="text-slate-700">{survey.total_count}</strong>건
            {overall != null && (
              <>
                {' · '}
                <span className="inline-flex items-center gap-0.5 text-orange-600 font-bold">
                  <Star size={11} className="text-orange-500 fill-orange-400" aria-hidden="true" />
                  평균 {overall.toFixed(2)}
                </span>
              </>
            )}
          </p>
        </div>
        <div className="flex items-center gap-1.5 shrink-0 flex-wrap">
          {/* STEP-SURVEY-ACCORDION-UI — 차트 유형 선택 */}
          <div className="inline-flex items-center gap-0.5 rounded-md border border-slate-200 bg-white p-0.5">
            {CHART_TYPES.map(({ value, label, Icon }) => (
              <button key={value} type="button" onClick={() => setChartType(value)}
                aria-pressed={chartType === value} title={label}
                className={`inline-flex items-center justify-center w-7 h-7 rounded transition-colors ${
                  chartType === value ? 'bg-violet-600 text-white' : 'text-slate-500 hover:bg-violet-50'
                }`}>
                <Icon size={12} aria-hidden="true" />
              </button>
            ))}
          </div>

          <button type="button" onClick={() => void handleAiAnalyze()} disabled={analyzing}
            title={hasAi ? 'AI 분석 다시 실행' : 'AI로 항목별·전체 분석'}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 disabled:opacity-50">
            {analyzing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {analyzing ? '분석 중…' : hasAi ? 'AI 재분석' : 'AI 분석'}
          </button>
          <button type="button" onClick={handleDownloadReport} title="텍스트 리포트 다운로드"
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-slate-600 bg-slate-50 hover:bg-slate-100 border border-slate-200">
            <Download size={11} /> 다운로드
          </button>
          {programId && (
            <button type="button" onClick={() => void handleSendToReport()} title="결과보고서 탭으로 전송"
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-emerald-700 bg-emerald-50 hover:bg-emerald-100 border border-emerald-200">
              <FileBarChart size={11} /> 보고서로
            </button>
          )}
          {onDelete && (
            <button type="button" onClick={onDelete} aria-label="삭제"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </header>

      {/* 문항별 아코디언 */}
      {questions.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-4">
          설문 문항이 없어요. 파일을 업로드하면 문항이 자동 등록돼요.
        </p>
      ) : (
        <div className="space-y-2">
          {questions.map((q, idx) => {
            const stats = perQuestion.get(q.id);
            const qResponses = responses.filter((r) => r.question_id === q.id);
            return (
              <SurveyQuestionAccordion
                key={q.id}
                index={idx}
                question={q}
                responses={qResponses}
                avg={stats?.avg ?? null}
                responseCount={stats?.count ?? 0}
                chartType={chartType}
              />
            );
          })}
        </div>
      )}

      {/* AI 종합 분석 (5필드 — Edge Function 자동 채움) */}
      {survey.ai_analysis && <SurveyAiAnalysisPanel analysis={survey.ai_analysis} />}

      {/* 기존 callAi 항목별 분석 (보조 — ai_analysis 없을 때만) */}
      {hasAi && !survey.ai_analysis && (
        <div className="space-y-2 rounded-lg bg-violet-50/60 border border-violet-100 p-3">
          <p className="text-[11px] font-bold text-violet-700 flex items-center gap-1">
            <Sparkles size={11} aria-hidden="true" /> AI 분석
          </p>
          {survey.ai_overall && (
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{survey.ai_overall}</p>
          )}
        </div>
      )}
    </section>
  );
}
