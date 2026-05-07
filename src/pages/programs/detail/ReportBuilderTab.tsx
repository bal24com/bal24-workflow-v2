// bal24 v2 — 결과보고서 빌더 탭 (Stage 2)
// 진입 시 8 auto 섹션 default seeding → 단일 페이지 섹션 목록.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Sparkles, FileDown } from 'lucide-react';
import { useToast } from '../../../contexts/ToastContext';
import { supabase } from '../../../lib/supabase';
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

  function showPlaceholder(label: string) {
    toast.info(`${label}은 STEP-AI-PREP / STEP-EXPORT 완료 후 활성화 예정이에요.`);
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
            onClick={() => showPlaceholder('전체 AI 초안')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-violet-50/40 text-xs font-semibold text-violet-700 hover:bg-violet-100 transition-colors"
          >
            <Sparkles size={12} aria-hidden="true" />
            전체 AI 초안
          </button>
          <button
            type="button"
            onClick={() => showPlaceholder('PDF 내보내기')}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl border border-violet-100 bg-white text-xs font-semibold text-violet-700 hover:bg-violet-50 transition-colors"
          >
            <FileDown size={12} aria-hidden="true" />
            PDF 내보내기
          </button>
        </div>
      </header>

      {sections.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-8">
          섹션이 없어요. "+ 항목 추가"로 시작하세요.
        </p>
      ) : (
        <div className="flex flex-col gap-3">
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
