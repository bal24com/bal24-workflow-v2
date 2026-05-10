// bal24 v2 — 결과보고서 빌더 · 단일 섹션 카드
// 체크박스(표시/숨김) + 드래그 핸들 + AI 버튼(placeholder) + 본문 편집.

import { useEffect, useState } from 'react';
import {
  GripVertical, Sparkles, Trash2, Check, X, RefreshCw, Loader2,
} from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { supabase } from '../../../../lib/supabase';
import type { CurriculumType, ReportSection } from '../../../../types/database';
import { aggregateSection, type AutoSectionKey } from './reportAggregator';
import { textareaClass } from '../../edit/cards/CardShell';

interface Props {
  section: ReportSection;
  programId: string;
  onToggleVisible: (next: boolean) => Promise<void>;
  onSaveContent: (content: string | null) => Promise<void>;
  onDelete?: () => Promise<void>;
  onDragStart: () => void;
  onDragEnter: () => void;
  onDragEnd: () => void;
  onDragOver: (e: React.DragEvent) => void;
  isDragging: boolean;
}

export default function ReportSectionCard({
  section, programId, onToggleVisible, onSaveContent, onDelete,
  onDragStart, onDragEnter, onDragEnd, onDragOver, isDragging,
}: Props) {
  const toast = useToast();
  const [editing, setEditing] = useState(false);
  const [draft, setDraft] = useState(section.content ?? '');
  const [aiOpen, setAiOpen] = useState(false);
  const [aiText, setAiText] = useState<string | null>(null);
  const [aiLoading, setAiLoading] = useState(false);
  const [aggLoading, setAggLoading] = useState(false);

  const isAuto = section.section_type === 'auto';
  const isVisible = section.is_visible;
  const isCurriculumSection = section.section_key === 'curriculum';

  // STEP-CURRICULUM-FULL — 결과보고서 커리큘럼 섹션에서 planned/actual 선택
  const [reportType, setReportType] = useState<CurriculumType>('planned');
  useEffect(() => {
    if (!isCurriculumSection) return;
    let cancelled = false;
    void (async () => {
      const r = await supabase.from('programs').select('report_curriculum_type').eq('id', programId).maybeSingle();
      if (cancelled) return;
      const t = (r.data as { report_curriculum_type?: CurriculumType } | null)?.report_curriculum_type;
      if (t) setReportType(t);
    })();
    return () => { cancelled = true; };
  }, [isCurriculumSection, programId]);

  async function changeReportType(next: CurriculumType) {
    setReportType(next);
    const { error } = await supabase.from('programs').update({ report_curriculum_type: next }).eq('id', programId);
    if (error) {
      console.error('[report-section] report_curriculum_type 저장 실패:', error.message);
      toast.error('선택을 저장하지 못했어요.');
      return;
    }
    toast.success(next === 'planned' ? '제안 커리큘럼으로 표시합니다.' : '실제 운영 커리큘럼으로 표시합니다.');
  }

  async function handleAggregate() {
    if (!isAuto) return;
    setAggLoading(true);
    try {
      const md = await aggregateSection(section.section_key as AutoSectionKey, programId);
      setDraft(md);
      setEditing(true);
      toast.success('자동 집계 결과를 불러왔어요. 검토 후 저장해 주세요.');
    } finally {
      setAggLoading(false);
    }
  }

  async function handleSave() {
    await onSaveContent(draft.trim() || null);
    setEditing(false);
  }

  function handleAiClick() {
    setAiOpen(true);
    setAiLoading(true);
    // STEP-AI-PREP placeholder — 실제 callClaude 연결은 후속
    setTimeout(() => {
      setAiText(
        '🛈 AI 분석은 STEP-AI-PREP 완료 후 활성화 예정입니다.\n\n' +
        '활성화되면 이 섹션 데이터를 바탕으로 보고서 초안 텍스트를 자동 생성하고 [적용] 버튼으로 본문에 반영할 수 있어요.',
      );
      setAiLoading(false);
    }, 400);
  }

  function applyAiText() {
    if (!aiText) return;
    setDraft(aiText);
    setEditing(true);
    setAiOpen(false);
    toast.success('AI 결과를 본문 초안에 반영했어요.');
  }

  return (
    <section
      draggable
      onDragStart={onDragStart}
      onDragEnter={onDragEnter}
      onDragEnd={onDragEnd}
      onDragOver={onDragOver}
      className={`rounded-2xl border ${
        isVisible ? 'border-violet-100' : 'border-slate-200 opacity-60'
      } bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-col gap-3 transition-opacity ${
        isDragging ? 'ring-2 ring-violet-300' : ''
      }`}
    >
      <header className="flex items-center gap-2">
        <button
          type="button"
          aria-label="순서 변경 핸들"
          className="cursor-grab active:cursor-grabbing inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-slate-100 hover:text-slate-600"
        >
          <GripVertical size={14} aria-hidden="true" />
        </button>
        <input
          type="checkbox"
          checked={isVisible}
          onChange={(e) => void onToggleVisible(e.target.checked)}
          aria-label={`${section.title} 표시 여부`}
          className="w-4 h-4 rounded border-violet-200 text-violet-600 focus:ring-violet-300 cursor-pointer"
        />
        <h3 className={`flex-1 min-w-0 truncate text-sm font-bold ${
          isVisible ? 'text-[#1E1B4B]' : 'text-slate-400 line-through'
        }`}>
          {section.title}
        </h3>
        <span className={`shrink-0 inline-flex items-center px-1.5 py-0.5 rounded-md text-[10px] font-bold ${
          isAuto ? 'bg-violet-100 text-violet-700' : 'bg-orange-100 text-orange-700'
        }`}>
          {isAuto ? '자동' : '직접'}
        </span>

        {isAuto && (
          <button
            type="button"
            onClick={handleAggregate}
            disabled={aggLoading}
            title="자동 집계 다시 불러오기"
            className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-violet-600 hover:bg-violet-50 transition-colors"
          >
            {aggLoading ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : <RefreshCw size={11} aria-hidden="true" />}
            집계
          </button>
        )}

        <button
          type="button"
          onClick={handleAiClick}
          title="AI 분석 (STEP-AI-PREP 완료 후 활성화)"
          className="shrink-0 inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-violet-500 hover:bg-violet-50 transition-colors"
        >
          <Sparkles size={11} aria-hidden="true" />
          AI
        </button>

        {!isAuto && onDelete && (
          <button
            type="button"
            onClick={() => void onDelete()}
            title="항목 삭제"
            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500 transition-colors"
          >
            <Trash2 size={12} aria-hidden="true" />
          </button>
        )}
      </header>

      {/* STEP-CURRICULUM-FULL — 커리큘럼 섹션에서 planned/actual 라디오 선택 */}
      {isCurriculumSection && (
        <div className="flex items-center gap-3 text-xs px-1">
          <span className="font-bold text-slate-500">📋 표시할 커리큘럼:</span>
          {(['planned', 'actual'] as CurriculumType[]).map((t) => (
            <label key={t} className="inline-flex items-center gap-1 cursor-pointer">
              <input type="radio" name={`rct-${section.id}`} checked={reportType === t}
                onChange={() => void changeReportType(t)}
                className="accent-violet-600" />
              <span className={reportType === t ? 'font-bold text-violet-700' : 'text-slate-600'}>
                {t === 'planned' ? '제안' : '실제 운영'}
              </span>
            </label>
          ))}
        </div>
      )}

      <div className="flex flex-col gap-2">
        {editing ? (
          <>
            <textarea
              value={draft}
              onChange={(e) => setDraft(e.target.value)}
              placeholder="섹션 본문을 작성하세요. (markdown 가능)"
              className={`${textareaClass} min-h-[140px]`}
            />
            <div className="flex items-center justify-end gap-2">
              <button
                type="button"
                onClick={() => { setDraft(section.content ?? ''); setEditing(false); }}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
              >
                <X size={12} aria-hidden="true" />
                취소
              </button>
              <button
                type="button"
                onClick={() => void handleSave()}
                className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl text-xs font-semibold bg-violet-600 text-white hover:bg-violet-700 transition-colors"
              >
                <Check size={12} aria-hidden="true" />
                저장
              </button>
            </div>
          </>
        ) : section.content ? (
          <div
            onClick={() => { setDraft(section.content ?? ''); setEditing(true); }}
            className="rounded-xl border border-violet-100 bg-violet-50/30 px-3 py-2.5 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed cursor-text hover:bg-violet-50/60 transition-colors"
          >
            {section.content}
          </div>
        ) : (
          <button
            type="button"
            onClick={() => { setDraft(''); setEditing(true); }}
            className="self-start inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-violet-50/40 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
          >
            본문 작성{isAuto && ' (자동 집계 추천)'}
          </button>
        )}
      </div>

      {aiOpen && (
        <div className="rounded-xl border border-violet-100 bg-gradient-to-br from-violet-50/40 to-orange-50/40 px-3 py-2.5">
          <div className="flex items-start gap-2">
            <Sparkles size={14} className="shrink-0 mt-0.5 text-violet-500" aria-hidden="true" />
            <div className="flex-1 min-w-0">
              <p className="text-[11px] font-bold text-[#1E1B4B] mb-1">AI 분석 결과</p>
              {aiLoading ? (
                <p className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                  <Loader2 size={11} className="animate-spin" aria-hidden="true" />
                  분석 중…
                </p>
              ) : (
                <p className="text-[11px] text-slate-600 whitespace-pre-wrap leading-relaxed">{aiText}</p>
              )}
              <div className="mt-2 flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAiOpen(false)}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold text-slate-500 hover:bg-slate-100 transition-colors"
                >
                  닫기
                </button>
                <button
                  type="button"
                  onClick={applyAiText}
                  disabled={aiLoading || !aiText}
                  className="inline-flex items-center px-2.5 py-1 rounded-md text-[11px] font-semibold bg-violet-600 text-white hover:bg-violet-700 disabled:opacity-50 transition-colors"
                >
                  적용
                </button>
              </div>
            </div>
          </div>
        </div>
      )}
    </section>
  );
}
