// bal24 v2 — STEP-CURRICULUM-ATTEND-SURVEY-FULL 만족도 분석 결과 카드
//   STEP-SURVEY-AI — [AI 분석] 버튼 → 항목별·전체 인사이트 (Claude 호출 → satisfaction_surveys UPDATE)

import { useState } from 'react';
import { Star, FileText, ChevronDown, ChevronUp, Trash2, MessageSquare, Sparkles, Loader2, Download, FileBarChart } from 'lucide-react';
import { BarChart, Bar, XAxis, YAxis, Tooltip, ResponsiveContainer, Cell } from 'recharts';
import { supabase } from '../../../lib/supabase';
import { callAi } from '../../../lib/aiClient';
import { useToast } from '../../../contexts/ToastContext';
import type { SatisfactionSurvey } from '../../../types/database';

interface Props {
  survey: SatisfactionSurvey;
  onDelete?: () => void;
  /** AI 분석 완료 후 부모(SurveyFileUploadSection) 새로고침 */
  onAnalyzed?: () => void;
  /** STEP-PROGRAM-ENHANCE-FULL — 결과보고서 탭으로 전송 (program_report_sections.satisfaction) */
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

export default function SurveyResultCard({ survey, onDelete, onAnalyzed, programId }: Props) {
  const toast = useToast();
  const [expanded, setExpanded] = useState(true);
  const [analyzing, setAnalyzing] = useState(false);
  const items = Object.entries(survey.summary_json ?? {});
  const overall = survey.avg_overall != null ? Number(survey.avg_overall) : null;
  const hasAi = Boolean(survey.ai_overall || (survey.ai_per_question && Object.keys(survey.ai_per_question).length > 0));

  // STEP-PROGRAM-ENHANCE-FULL — recharts 가로 막대 데이터
  const chartData = items
    .filter(([, v]) => typeof v === 'number' && (v as number) <= 5)
    .map(([key, value]) => ({
      name: key.length > 24 ? `${key.slice(0, 22)}…` : key,
      score: Math.round((value as number) * 100) / 100,
    }));

  // STEP-PROGRAM-ENHANCE-FULL — 텍스트 리포트 다운로드
  function handleDownloadReport() {
    const lines = [
      '=== 만족도 조사 분석 리포트 ===',
      `파일: ${survey.file_name ?? '(이름 없음)'}`,
      `총 응답: ${survey.total_count}명`,
      `전반적 만족도: ${overall != null ? `${overall.toFixed(2)}/5.0` : '-'}`,
      '',
      '[항목별 평균]',
      ...items.filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k}: ${(v as number).toFixed(2)}`),
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

  // STEP-PROGRAM-ENHANCE-FULL — 결과보고서 탭으로 전송 (program_report_sections.satisfaction)
  async function handleSendToReport() {
    if (!programId) { toast.error('프로그램 정보가 없어요.'); return; }
    const summary = [
      `만족도 조사 결과 (${survey.total_count}명 응답)`,
      `전반적 만족도: ${overall != null ? `${overall.toFixed(2)}/5.0` : '-'}`,
      '',
      '[항목별 평균]',
      ...items.filter(([, v]) => typeof v === 'number').map(([k, v]) => `${k}: ${(v as number).toFixed(2)}`),
      '',
      survey.ai_overall ? `[AI 분석]\n${survey.ai_overall}` : '',
    ].join('\n');
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
      // JSON 추출
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
      const raw = err instanceof Error ? err.message : '';
      console.error('[survey-ai] 분석 실패:', raw);
      toast.error('AI 분석 중 오류가 발생했어요.');
    } finally {
      setAnalyzing(false);
    }
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <div className="min-w-0">
          <p className="text-sm font-bold text-[#1E1B4B] flex items-center gap-1.5">
            <FileText size={14} className="text-violet-500" aria-hidden="true" />
            {survey.file_name ?? '만족도 응답'}
          </p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {formatDateTime(survey.uploaded_at)} · 응답 <strong className="text-slate-700">{survey.total_count}</strong>건
          </p>
        </div>
        <div className="flex items-center gap-3 shrink-0">
          {overall != null && (
            <div className="text-right">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">전반 평균</p>
              <p className="text-2xl font-bold text-orange-600 tabular-nums inline-flex items-center gap-1">
                <Star size={20} className="text-orange-500 fill-orange-400" aria-hidden="true" /> {overall.toFixed(2)}
              </p>
            </div>
          )}
          {/* STEP-SURVEY-AI — AI 분석 버튼 (박경수님 명시 클릭) */}
          <button type="button" onClick={() => void handleAiAnalyze()} disabled={analyzing}
            title={hasAi ? 'AI 분석 다시 실행' : 'AI로 항목별·전체 분석'}
            className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-bold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 disabled:opacity-50">
            {analyzing ? <Loader2 size={11} className="animate-spin" /> : <Sparkles size={11} />}
            {analyzing ? '분석 중…' : hasAi ? 'AI 재분석' : 'AI 분석'}
          </button>
          {/* STEP-PROGRAM-ENHANCE-FULL — 리포트 다운로드 + 결과보고서 전송 */}
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
          <button type="button" onClick={() => setExpanded((v) => !v)} aria-label={expanded ? '접기' : '펼치기'}
            className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-violet-50 hover:text-violet-600">
            {expanded ? <ChevronUp size={14} /> : <ChevronDown size={14} />}
          </button>
          {onDelete && (
            <button type="button" onClick={onDelete} aria-label="삭제"
              className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500">
              <Trash2 size={12} />
            </button>
          )}
        </div>
      </header>

      {expanded && (
        <>
          {/* STEP-PROGRAM-ENHANCE-FULL — recharts 가로 막대 차트 */}
          {chartData.length > 0 && (
            <div className="rounded-lg border border-slate-100 bg-white p-2">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide mb-1">항목별 평균 (그래프)</p>
              <ResponsiveContainer width="100%" height={chartData.length * 32 + 30}>
                <BarChart data={chartData} layout="vertical" margin={{ left: 8, right: 24, top: 4, bottom: 4 }}>
                  <XAxis type="number" domain={[0, 5]} tickCount={6} tick={{ fontSize: 10, fill: '#64748B' }} />
                  <YAxis type="category" dataKey="name" width={140} tick={{ fontSize: 10, fill: '#1E1B4B' }} />
                  <Tooltip formatter={(v) => (typeof v === 'number' ? v.toFixed(2) : String(v))} />
                  <Bar dataKey="score" radius={[0, 4, 4, 0]}>
                    {chartData.map((_, i) => (<Cell key={i} fill="#7C3AED" fillOpacity={0.75} />))}
                  </Bar>
                </BarChart>
              </ResponsiveContainer>
            </div>
          )}
          {items.length > 0 && (
            <div className="space-y-1.5">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">항목별 평균</p>
              {items.map(([label, avg]) => {
                const pct = Math.max(0, Math.min(100, (avg / 5) * 100));
                return (
                  <div key={label} className="grid grid-cols-[minmax(0,1fr)_minmax(120px,180px)_44px] items-center gap-2 text-xs">
                    <span className="text-slate-700 truncate" title={label}>{label}</span>
                    <span className="h-2 rounded-full bg-slate-100 overflow-hidden">
                      <span className="block h-full bg-gradient-to-r from-violet-400 to-orange-400" style={{ width: `${pct}%` }} aria-hidden="true" />
                    </span>
                    <span className="font-bold tabular-nums text-orange-600 text-right">{Number(avg).toFixed(2)}</span>
                  </div>
                );
              })}
            </div>
          )}
          {survey.comments && survey.comments.length > 0 && (
            <div className="space-y-1">
              <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide flex items-center gap-1">
                <MessageSquare size={11} aria-hidden="true" /> 자유서술 ({survey.comments.length})
              </p>
              <ul className="space-y-1 max-h-[240px] overflow-y-auto rounded-lg bg-slate-50/60 p-2">
                {survey.comments.map((c, i) => (
                  <li key={i} className="text-xs text-slate-700 px-2 py-1 rounded bg-white border border-slate-100">
                    · {c}
                  </li>
                ))}
              </ul>
            </div>
          )}
          {items.length === 0 && (!survey.comments || survey.comments.length === 0) && (
            <p className="text-xs text-slate-400 italic text-center py-2">분석할 데이터가 없어요.</p>
          )}

          {/* STEP-SURVEY-AI — AI 분석 결과 (항목별 + 전체) */}
          {hasAi && (
            <div className="mt-2 space-y-2 rounded-lg bg-violet-50/60 border border-violet-100 p-3">
              <p className="text-[11px] font-bold text-violet-700 flex items-center gap-1">
                <Sparkles size={11} aria-hidden="true" /> AI 분석
                {survey.ai_analyzed_at && (
                  <span className="text-[10px] text-slate-400 ml-1">
                    ({new Date(survey.ai_analyzed_at).toLocaleString('ko-KR')})
                  </span>
                )}
              </p>
              {survey.ai_overall && (
                <div className="space-y-0.5">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">전체 인사이트</p>
                  <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{survey.ai_overall}</p>
                </div>
              )}
              {survey.ai_per_question && Object.keys(survey.ai_per_question).length > 0 && (
                <div className="space-y-1">
                  <p className="text-[10px] font-bold text-slate-500 uppercase tracking-wide">항목별 분석</p>
                  <ul className="space-y-1">
                    {Object.entries(survey.ai_per_question).map(([q, insight]) => (
                      <li key={q} className="text-xs">
                        <span className="font-bold text-violet-700">{q}</span>
                        <span className="text-slate-700"> — {insight}</span>
                      </li>
                    ))}
                  </ul>
                </div>
              )}
            </div>
          )}
        </>
      )}
    </section>
  );
}
