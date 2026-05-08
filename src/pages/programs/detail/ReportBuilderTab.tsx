// bal24 v2 — 결과보고서 빌더 탭 (Stage 2)
// 진입 시 8 auto 섹션 default seeding → 단일 페이지 섹션 목록.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Plus, Sparkles, FileDown, FileText } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
import { elementToPdfBlob, downloadBlob } from '../../../lib/certificatePdf';
import { generateReportDocx } from '../../../lib/reportDocx';
import type { ReportSection } from '../../../types/database';
import ReportSectionCard from './report/ReportSectionCard';
import CustomSectionAddModal from './report/CustomSectionAddModal';
import { AUTO_SECTIONS } from './report/reportAggregator';

interface Props {
  programId: string;
}

export default function ReportBuilderTab({ programId }: Props) {
  const toast = useToast();
  const [sections, setSections] = useState<ReportSection[]>([]);
  const [loading, setLoading] = useState(true);
  const [seeding, setSeeding] = useState(false);
  const [addOpen, setAddOpen] = useState(false);
  const [dragId, setDragId] = useState<string | null>(null);
  const [aiDraftLoading, setAiDraftLoading] = useState(false);
  const [aiDraft, setAiDraft] = useState<string | null>(null);
  const [programName, setProgramName] = useState<string>('프로그램');
  const [pdfLoading, setPdfLoading] = useState(false);
  const [docxLoading, setDocxLoading] = useState(false);
  const reportRef = useRef<HTMLDivElement>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('report_sections')
      .select('*')
      .eq('program_id', programId)
      .order('sort_order', { ascending: true });
    if (error) {
      console.error('[report-builder] 조회 실패:', error.message);
      toast.error('결과보고서 섹션을 불러오지 못했어요.');
      return;
    }
    setSections((data as ReportSection[] | null) ?? []);
  }, [programId, toast]);

  // 진입 시 fetch + 비어 있으면 8 auto 섹션 seeding
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('report_sections')
        .select('*')
        .eq('program_id', programId)
        .order('sort_order', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[report-builder] 초기 조회 실패:', error.message);
        toast.error('결과보고서 섹션을 불러오지 못했어요.');
        setLoading(false);
        return;
      }
      const rows = (data as ReportSection[] | null) ?? [];
      if (rows.length === 0) {
        setSeeding(true);
        const seedRows = AUTO_SECTIONS.map((s, i) => ({
          program_id: programId,
          section_key: s.key,
          title: s.title,
          content: null,
          is_visible: true,
          sort_order: (i + 1) * 10,
          section_type: 'auto' as const,
        }));
        const insertRes = await supabase.from('report_sections').insert(seedRows).select('*');
        if (cancelled) return;
        if (insertRes.error) {
          console.error('[report-builder] 기본 섹션 생성 실패:', insertRes.error.message);
          toast.error('기본 섹션 생성에 실패했어요.');
        } else {
          setSections((insertRes.data as ReportSection[] | null) ?? []);
        }
        setSeeding(false);
      } else {
        setSections(rows);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId, toast]);

  async function toggleVisible(id: string, next: boolean) {
    const { error } = await supabase
      .from('report_sections')
      .update({ is_visible: next, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[report-builder] 표시 여부 수정 실패:', error.message);
      toast.error('표시 여부 변경에 실패했어요.');
      return;
    }
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, is_visible: next } : s)));
  }

  async function saveContent(id: string, content: string | null) {
    const { error } = await supabase
      .from('report_sections')
      .update({ content, updated_at: new Date().toISOString() })
      .eq('id', id);
    if (error) {
      console.error('[report-builder] 본문 저장 실패:', error.message);
      toast.error('본문 저장에 실패했어요.');
      return;
    }
    setSections((prev) => prev.map((s) => (s.id === id ? { ...s, content } : s)));
    toast.success('섹션 본문을 저장했어요.');
  }

  async function deleteSection(id: string) {
    if (!window.confirm('이 항목을 삭제할까요?')) return;
    const { error } = await supabase.from('report_sections').delete().eq('id', id);
    if (error) {
      console.error('[report-builder] 삭제 실패:', error.message);
      toast.error('항목 삭제에 실패했어요.');
      return;
    }
    setSections((prev) => prev.filter((s) => s.id !== id));
    toast.success('항목을 삭제했어요.');
  }

  async function persistOrder(reordered: ReportSection[]) {
    const updates = reordered.map((s, idx) => ({
      id: s.id,
      sort_order: (idx + 1) * 10,
    }));
    setSections(reordered.map((s, idx) => ({ ...s, sort_order: (idx + 1) * 10 })));
    for (const u of updates) {
      const { error } = await supabase
        .from('report_sections')
        .update({ sort_order: u.sort_order, updated_at: new Date().toISOString() })
        .eq('id', u.id);
      if (error) {
        console.error('[report-builder] 순서 저장 실패:', error.message);
        toast.error('순서 저장에 실패했어요.');
        void refresh();
        return;
      }
    }
  }

  function handleDragEnter(targetId: string) {
    if (!dragId || dragId === targetId) return;
    setSections((prev) => {
      const fromIdx = prev.findIndex((s) => s.id === dragId);
      const toIdx = prev.findIndex((s) => s.id === targetId);
      if (fromIdx < 0 || toIdx < 0) return prev;
      const next = [...prev];
      const [moved] = next.splice(fromIdx, 1);
      next.splice(toIdx, 0, moved);
      return next;
    });
  }

  async function handleDragEnd() {
    setDragId(null);
    await persistOrder(sections);
  }

  // 프로그램 이름 fetch — export 파일명·표지용 (1회)
  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    void (async () => {
      const { data, error } = await supabase.from('programs').select('name').eq('id', programId).maybeSingle();
      if (cancelled || error || !data?.name) {
        if (error) console.error('[report-builder] 프로그램명 조회 실패:', error.message);
        return;
      }
      setProgramName(data.name);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  const buildFilename = (ext: 'pdf' | 'docx') =>
    `결과보고서_${programName}_${new Date().toISOString().slice(0, 10)}.${ext}`;

  async function handlePdfExport() {
    if (!reportRef.current) { toast.error('보고서 영역을 찾을 수 없어요.'); return; }
    setPdfLoading(true);
    const blob = await elementToPdfBlob(reportRef.current, { orientation: 'portrait' });
    if (blob) {
      downloadBlob(blob, buildFilename('pdf'));
      toast.success('PDF를 다운로드했어요.');
    } else {
      toast.error('PDF 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
    }
    setPdfLoading(false);
  }

  async function handleDocxExport() {
    if (sections.length === 0) { toast.error('내보낼 보고서 내용이 없어요.'); return; }
    setDocxLoading(true);
    try {
      const blob = await generateReportDocx(programName, sections);
      downloadBlob(blob, buildFilename('docx'));
      toast.success('Word 파일을 다운로드했어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[report-docx] 생성 실패:', raw);
      toast.error('Word 파일 생성 중 오류가 발생했어요.');
    } finally {
      setDocxLoading(false);
    }
  }

  async function handleAiFullDraft() {
    setAiDraftLoading(true);
    setAiDraft(null);
    try {
      const { data: prog, error: progErr } = await supabase
        .from('programs')
        .select('name, type, status, start_date, end_date, description')
        .eq('id', programId)
        .maybeSingle();
      if (progErr) {
        console.error('[report-full] 프로그램 조회 실패:', progErr.message);
        toast.error('프로그램 정보를 불러오지 못했어요.');
        return;
      }

      const p = prog as {
        name?: string | null;
        type?: string | null;
        start_date?: string | null;
        end_date?: string | null;
        description?: string | null;
      } | null;
      const context = p
        ? `프로그램명: ${p.name ?? '미정'}\n유형: ${p.type ?? ''}\n기간: ${p.start_date ?? ''} ~ ${p.end_date ?? ''}\n설명: ${p.description ?? '없음'}`
        : '프로그램 정보 없음';

      const { data, error } = await supabase.functions.invoke('ai-chat', {
        body: {
          preset: 'report-full',
          systemOverride: '당신은 교육 프로그램 결과보고서 작성 전문가입니다. 아래 정보를 바탕으로 결과보고서 전체 초안을 작성해 주세요. 각 섹션을 ### 제목 형식으로 구분하여 상세히 작성하세요.',
          messages: [{ role: 'user', content: context }],
          maxTokens: 4096,
        },
      });
      if (error) throw new Error(error.message);
      const body = data as { ok?: boolean; text?: string; error?: string } | null;
      if (!body?.ok) throw new Error(body?.error ?? 'AI 오류');
      setAiDraft(body.text ?? '');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[report-full] AI 초안 실패:', raw);
      toast.error('AI 초안 생성에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setAiDraftLoading(false);
    }
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
        {seeding && <span className="ml-2 text-xs text-slate-500">기본 섹션 생성 중…</span>}
      </div>
    );
  }

  const maxSort = sections.reduce((m, s) => (s.sort_order > m ? s.sort_order : m), 0);

  return (
    <div className="flex flex-col gap-4">
      <header className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)] flex flex-wrap items-center justify-between gap-3">
        <div>
          <p className="text-sm font-bold text-[#1E1B4B]">결과보고서 빌더</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            8개 자동집계 섹션 + 사용자 정의 항목. 체크박스로 표시/숨김, ≡ 핸들로 순서 변경.
          </p>
        </div>
        <div className="flex items-center gap-2">
          <button
            type="button"
            onClick={() => void handleAiFullDraft()}
            disabled={aiDraftLoading}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-violet-50/40 text-xs font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {aiDraftLoading
              ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              : <Sparkles size={12} aria-hidden="true" />}
            {aiDraftLoading ? 'AI 작성 중…' : '전체 AI 초안'}
          </button>
          <button
            type="button"
            onClick={() => void handleDocxExport()}
            disabled={docxLoading || sections.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-slate-200 bg-white text-xs font-semibold text-slate-700 hover:bg-slate-50 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {docxLoading
              ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              : <FileText size={12} aria-hidden="true" />}
            {docxLoading ? '생성 중…' : 'Word'}
          </button>
          <button
            type="button"
            onClick={() => void handlePdfExport()}
            disabled={pdfLoading || sections.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {pdfLoading
              ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
              : <FileDown size={12} aria-hidden="true" />}
            {pdfLoading ? '생성 중…' : 'PDF'}
          </button>
        </div>
      </header>

      {aiDraft && (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-4 flex flex-col gap-3">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-1.5">
              <Sparkles size={14} className="text-violet-500" aria-hidden="true" />
              <span className="text-sm font-bold text-slate-800">AI 결과보고서 초안</span>
            </div>
            <button
              type="button"
              onClick={() => setAiDraft(null)}
              className="text-[10px] text-slate-400 hover:text-slate-600 transition-colors"
            >
              닫기
            </button>
          </div>
          <div className="rounded-xl bg-white border border-violet-100 p-4 text-xs text-slate-700 whitespace-pre-wrap leading-relaxed max-h-72 overflow-y-auto">
            {aiDraft}
          </div>
          <p className="text-[10px] text-slate-400">💡 위 내용을 각 섹션 편집창에 복사하여 붙여넣으세요.</p>
        </div>
      )}

      {sections.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">
          섹션이 없어요. "+ 항목 추가"로 시작하세요.
        </p>
      ) : (
        <div ref={reportRef} className="flex flex-col gap-3 bg-white">
          {/* PDF 캡처용 표지 — 섹션 카드들과 함께 캔버스에 포함 */}
          <header className="rounded-2xl border border-violet-100 bg-white p-5">
            <p className="text-[10px] font-bold text-slate-400 uppercase tracking-[0.3em]">결과보고서</p>
            <h2 className="mt-2 text-xl font-bold text-[#1E1B4B]">{programName}</h2>
            <p className="mt-1 text-xs text-slate-500">발행일 · {new Date().toLocaleDateString('ko-KR')}</p>
            <div className="mt-3 w-12 h-0.5 bg-violet-300" aria-hidden="true" />
          </header>

          {sections.map((s) => (
            <ReportSectionCard
              key={s.id}
              section={s}
              programId={programId}
              onToggleVisible={(next) => toggleVisible(s.id, next)}
              onSaveContent={(c) => saveContent(s.id, c)}
              onDelete={s.section_type === 'custom' ? () => deleteSection(s.id) : undefined}
              onDragStart={() => setDragId(s.id)}
              onDragEnter={() => handleDragEnter(s.id)}
              onDragEnd={() => void handleDragEnd()}
              onDragOver={(e) => e.preventDefault()}
              isDragging={dragId === s.id}
            />
          ))}
        </div>
      )}

      <button
        type="button"
        onClick={() => setAddOpen(true)}
        className="self-start inline-flex items-center gap-1 px-4 py-2 rounded-xl border-2 border-dashed border-violet-200 bg-violet-50/30 text-sm font-semibold text-violet-700 hover:bg-violet-100 hover:border-violet-300 transition-colors"
      >
        <Plus size={14} aria-hidden="true" />
        항목 추가
      </button>

      <CustomSectionAddModal
        open={addOpen}
        onClose={() => setAddOpen(false)}
        programId={programId}
        maxSortOrder={maxSort}
        onAdded={() => void refresh()}
      />
    </div>
  );
}
