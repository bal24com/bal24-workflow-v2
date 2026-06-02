// 박경수님 2026-06-02 STEP-SURVEY-RESULTS-A — 설문 응답 상세 보기 슬라이드 패널 (PM 측).
// 응답자별 행 + 문항별 답변 + 종류별 집계 + CSV 다운로드.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { Loader2, X, Download, BarChart3, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import type { ProgramSurveyForm, SurveyFormQuestion } from '../../../types/database';

interface Props {
  form: ProgramSurveyForm;
  onClose: () => void;
}

interface ResponseRow {
  id: string;
  respondent_token: string | null;
  respondent_role: string | null;
  question_id: string | null;
  answer_text: string | null;
  answer_score: number | null;
  created_at: string;
  phase: string | null;
}

const ROLE_LABEL: Record<string, string> = {
  supporter:   '지원기관',
  beneficiary: '수혜기관',
  team:        '참여팀(개인)',
  staff:       '강사/멘토',
};

function fmtDate(iso: string): string {
  const d = new Date(iso);
  if (isNaN(d.getTime())) return iso;
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  const hh = String(d.getHours()).padStart(2, '0');
  const mm = String(d.getMinutes()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day} ${hh}:${mm}`;
}

export default function SurveyResponsesPanel({ form, onClose }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<ResponseRow[]>([]);
  const [loading, setLoading] = useState(true);
  const mouseDownOnBackdropRef = useRef(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('survey_responses')
      .select('id, respondent_token, respondent_role, question_id, answer_text, answer_score, created_at, phase')
      .eq('form_id', form.id)
      .order('created_at', { ascending: false });
    if (error) {
      console.error('[SurveyResponsesPanel] 응답 조회 실패:', error.message);
      toast.error('응답을 불러오지 못했어요.');
      setRows([]);
      setLoading(false);
      return;
    }
    setRows((data ?? []) as ResponseRow[]);
    setLoading(false);
  }, [form.id, toast]);

  useEffect(() => { void reload(); }, [reload]);

  // 응답자 단위 그룹핑 — 같은 token+같은 created_at 분 단위 묶음 = 한 응답 세트
  const responseSets = useMemo(() => {
    const map = new Map<string, ResponseRow[]>();
    rows.forEach((r) => {
      const key = `${r.respondent_token ?? 'anon'}_${r.created_at.slice(0, 16)}`;
      const list = map.get(key) ?? [];
      list.push(r);
      map.set(key, list);
    });
    return Array.from(map.entries()).map(([key, list]) => ({
      key,
      token: list[0].respondent_token ?? 'anon',
      role: list[0].respondent_role ?? '미지정',
      created_at: list[0].created_at,
      answers: list,
    }));
  }, [rows]);

  // 문항 인덱스 매핑 — survey_responses 는 question_id 가 null 일 수 있어서 form.questions 순서 기준
  const questions = useMemo(() => form.questions ?? [], [form]);

  function handleCsvDownload() {
    if (responseSets.length === 0) { toast.error('내보낼 응답이 없어요.'); return; }
    const header = ['응답일시', '응답자 역할', ...questions.map((q) => q.label)];
    const rowsCsv = responseSets.map((set) => {
      const cols = [fmtDate(set.created_at), ROLE_LABEL[set.role] ?? set.role];
      questions.forEach((_q, idx) => {
        const a = set.answers[idx];
        const v = a?.answer_text ?? (a?.answer_score != null ? String(a.answer_score) : '');
        cols.push(v);
      });
      return cols;
    });
    const csv = [header, ...rowsCsv]
      .map((r) => r.map((v) => `"${(v ?? '').replace(/"/g, '""')}"`).join(','))
      .join('\n');
    const blob = new Blob([`﻿${csv}`], { type: 'text/csv;charset=utf-8;' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = `${form.title}_응답.csv`;
    a.click();
    URL.revokeObjectURL(url);
    toast.success('CSV 다운로드를 시작했어요.');
  }

  return (
    <div className="fixed inset-0 z-50 flex"
      onMouseDown={(e) => { mouseDownOnBackdropRef.current = e.target === e.currentTarget; }}
      onMouseUp={(e) => { if (mouseDownOnBackdropRef.current && e.target === e.currentTarget) onClose(); }}>
      <div className="absolute inset-0 bg-black/30" aria-hidden="true" />
      <div className="relative ml-auto w-full max-w-3xl bg-white h-full overflow-y-auto shadow-xl">
        <header className="sticky top-0 bg-white border-b border-slate-100 px-5 py-4 flex items-center justify-between z-10">
          <div className="min-w-0">
            <h2 className="text-base font-bold text-[#1E1B4B] truncate">{form.title}</h2>
            <p className="text-[11px] text-slate-500 mt-0.5">
              응답 {responseSets.length}건 · 문항 {questions.length}개
            </p>
          </div>
          <div className="flex items-center gap-1">
            <button type="button" onClick={handleCsvDownload}
              className="inline-flex items-center gap-1 px-3 h-8 rounded-lg border border-violet-200 text-violet-700 text-xs font-bold hover:bg-violet-50">
              <Download size={12} aria-hidden="true" /> CSV
            </button>
            <button type="button" onClick={onClose} aria-label="닫기"
              className="p-1.5 rounded hover:bg-slate-100"><X size={16} aria-hidden="true" /></button>
          </div>
        </header>

        <div className="p-5 space-y-4">
          {loading ? (
            <div className="flex justify-center py-10">
              <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
            </div>
          ) : responseSets.length === 0 ? (
            <p className="text-sm text-slate-400 italic text-center py-10">
              아직 응답이 없어요. 외부 토큰 페이지에서 응답이 들어오면 여기에 나타나요.
            </p>
          ) : (
            <>
              <SummaryRow questions={questions} responseSets={responseSets} />
              <ResponsesTable questions={questions} responseSets={responseSets} />
            </>
          )}
        </div>
      </div>
    </div>
  );
}

interface ResponseSet { key: string; token: string; role: string; created_at: string; answers: ResponseRow[] }

function SummaryRow({ questions, responseSets }: { questions: SurveyFormQuestion[]; responseSets: ResponseSet[] }) {
  // select / checkbox 문항만 집계
  const aggregates = questions.map((q, idx) => {
    if (q.type !== 'select' && q.type !== 'checkbox') return null;
    const tally: Record<string, number> = {};
    responseSets.forEach((set) => {
      const ans = set.answers[idx]?.answer_text ?? '';
      if (!ans) return;
      ans.split(',').map((s) => s.trim()).filter(Boolean).forEach((v) => {
        tally[v] = (tally[v] ?? 0) + 1;
      });
    });
    return { q, tally };
  }).filter((x): x is { q: SurveyFormQuestion; tally: Record<string, number> } => x !== null);

  if (aggregates.length === 0) return null;
  return (
    <section className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2">
      <h4 className="text-xs font-bold text-violet-700 inline-flex items-center gap-1">
        <BarChart3 size={12} aria-hidden="true" /> 선택형 응답 집계
      </h4>
      {aggregates.map(({ q, tally }) => {
        const entries = Object.entries(tally).sort((a, b) => b[1] - a[1]);
        return (
          <div key={q.id} className="flex items-center gap-2 text-xs flex-wrap">
            <span className="text-slate-700 font-semibold w-40 shrink-0 truncate">{q.label}</span>
            {entries.length === 0 ? (
              <span className="text-slate-300 italic">응답 없음</span>
            ) : entries.map(([ans, n]) => (
              <span key={ans} className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md bg-white border border-violet-100 text-violet-700">
                {ans} <strong className="tabular-nums">{n}</strong>
              </span>
            ))}
          </div>
        );
      })}
    </section>
  );
}

function ResponsesTable({ questions, responseSets }: { questions: SurveyFormQuestion[]; responseSets: ResponseSet[] }) {
  return (
    <section className="space-y-2">
      <h4 className="text-xs font-bold text-slate-700 inline-flex items-center gap-1">
        <FileText size={12} aria-hidden="true" /> 응답 상세 ({responseSets.length})
      </h4>
      <ul className="space-y-2">
        {responseSets.map((set) => (
          <li key={set.key} className="rounded-xl border border-slate-200 bg-white p-3 space-y-2">
            <div className="flex items-center gap-2 text-[11px] text-slate-500 flex-wrap">
              <span className="font-bold text-[#1E1B4B]">{ROLE_LABEL[set.role] ?? set.role}</span>
              <span>·</span>
              <span>{fmtDate(set.created_at)}</span>
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-1.5 text-xs">
              {questions.map((q, idx) => {
                const a = set.answers[idx];
                const v = a?.answer_text ?? (a?.answer_score != null ? String(a.answer_score) : '');
                return (
                  <div key={q.id} className="flex gap-2">
                    <span className="text-slate-500 font-semibold shrink-0 w-32 truncate">{q.label}</span>
                    <span className={`flex-1 min-w-0 break-words ${v ? 'text-slate-700' : 'text-slate-300 italic'}`}>
                      {v || '미응답'}
                    </span>
                  </div>
                );
              })}
            </div>
          </li>
        ))}
      </ul>
    </section>
  );
}
