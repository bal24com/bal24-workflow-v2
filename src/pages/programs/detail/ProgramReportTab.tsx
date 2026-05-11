// bal24 v2 — STEP-PROGRAM-REPORT-TAB / STEP-PROGRAM-UX-B
// 결과보고서 탭 — 9 표준 섹션 + 자동집계 + 직접 편집 + 순서 변경 + 추가/삭제

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, FileText, ClipboardCheck, BookOpen, Users2, BarChart3, Award, Download, Plus,
  Target, Wallet, TrendingUp,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import ReportSectionCard from './ReportSectionCard';
import {
  fetchReportSections, saveReportSection, deleteReportSection, SECTION_GENERATORS,
  DEFAULT_REPORT_SECTIONS,
} from './programReportUtils';
import type { ProgramReportSectionKey } from '../../../types/database';

interface Props { programId: string }

interface SectionDef {
  key: ProgramReportSectionKey;
  label: string;
  Icon: LucideIcon;
  canGenerate: boolean;
}

const STANDARD_ICON: Record<string, LucideIcon> = {
  overview:     FileText,
  goals:        Target,
  curriculum:   BookOpen,
  participants: Users2,
  attendance:   ClipboardCheck,
  satisfaction: BarChart3,
  outcomes:     Award,
  budget:       Wallet,
  improvements: TrendingUp,
};

interface SectionState {
  content: string;
  updatedAt: string | null;
  baseline: string;
  generating: boolean;
  saving: boolean;
}

const EMPTY_STATE: SectionState = { content: '', updatedAt: null, baseline: '', generating: false, saving: false };

function buildDefs(keys: Array<{ key: ProgramReportSectionKey; label: string }>): SectionDef[] {
  return keys.map((k) => ({
    key: k.key, label: k.label,
    Icon: STANDARD_ICON[k.key] ?? FileText,
    canGenerate: SECTION_GENERATORS[k.key] != null,
  }));
}

export default function ProgramReportTab({ programId }: Props) {
  const toast = useToast();
  const [programName, setProgramName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [sections, setSections] = useState<SectionDef[]>([]);
  const [state, setState] = useState<Record<string, SectionState>>({});
  const [deletedKeys, setDeletedKeys] = useState<Set<string>>(new Set());
  const [addingLabel, setAddingLabel] = useState('');
  const [addOpen, setAddOpen] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    setDeletedKeys(new Set());
    const [rows, prog] = await Promise.all([
      fetchReportSections(programId),
      supabase.from('programs').select('name').eq('id', programId).maybeSingle(),
    ]);
    setProgramName(prog.data?.name ?? '');

    // DB에 있는 섹션 = 우선 순위 (sort_order), 표준에서 빠진 키는 default 순서로 보완
    const dbKeys = new Set(rows.map((r) => r.section_key));
    const merged: Array<{ key: ProgramReportSectionKey; label: string }> = [];
    // 1) DB 행 (sort_order 순) → 라벨은 DEFAULT에서 매칭, 없으면 key 그대로
    for (const r of rows) {
      const std = DEFAULT_REPORT_SECTIONS.find((d) => d.key === r.section_key);
      merged.push({ key: r.section_key, label: std?.label ?? r.section_key });
    }
    // 2) DEFAULT 중 DB에 없는 것 → 뒤에 추가
    for (const d of DEFAULT_REPORT_SECTIONS) {
      if (!dbKeys.has(d.key)) merged.push(d);
    }

    const defs = buildDefs(merged);
    setSections(defs);
    const next: Record<string, SectionState> = {};
    for (const def of defs) {
      const row = rows.find((r) => r.section_key === def.key);
      next[def.key] = { ...EMPTY_STATE, content: row?.content ?? '', baseline: row?.content ?? '', updatedAt: row?.updated_at ?? null };
    }
    setState(next);
    setLoading(false);
  }, [programId]);

  useEffect(() => { void refresh(); }, [refresh]);

  function patch(key: string, partial: Partial<SectionState>) {
    setState((prev) => ({ ...prev, [key]: { ...(prev[key] ?? EMPTY_STATE), ...partial } }));
  }

  async function handleGenerate(key: ProgramReportSectionKey) {
    const gen = SECTION_GENERATORS[key];
    if (!gen) return;
    patch(key, { generating: true });
    try {
      const text = await gen(programId);
      patch(key, { content: text, generating: false });
      toast.success('자동집계 완료. [저장]을 눌러 반영하세요.');
    } catch (err) {
      console.error('[program-report] 자동집계 실패:', err);
      toast.error('자동집계 중 오류가 발생했어요.');
      patch(key, { generating: false });
    }
  }

  async function handleSaveOne(key: ProgramReportSectionKey, sortOrder: number) {
    patch(key, { saving: true });
    try {
      const s = state[key];
      await saveReportSection(programId, key, s.content, sortOrder);
      patch(key, { saving: false, baseline: s.content, updatedAt: new Date().toISOString() });
      toast.success('섹션을 저장했어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[program-report] 저장 실패:', raw);
      toast.error('저장 중 오류가 발생했어요.');
      patch(key, { saving: false });
    }
  }

  function moveSection(idx: number, dir: 'up' | 'down') {
    setSections((prev) => {
      const next = [...prev];
      const j = dir === 'up' ? idx - 1 : idx + 1;
      if (j < 0 || j >= next.length) return prev;
      [next[idx], next[j]] = [next[j], next[idx]];
      return next;
    });
  }

  function handleAddSection() {
    const label = addingLabel.trim();
    if (!label) { toast.error('섹션 이름을 입력해 주세요.'); return; }
    const newKey: ProgramReportSectionKey = `custom_${Date.now()}`;
    setSections((prev) => [...prev, { key: newKey, label, Icon: FileText, canGenerate: false }]);
    setState((prev) => ({ ...prev, [newKey]: { ...EMPTY_STATE } }));
    setAddingLabel(''); setAddOpen(false);
    toast.success(`"${label}" 섹션을 추가했어요. [전체 저장]을 누르세요.`);
  }

  function handleDeleteSection(key: ProgramReportSectionKey) {
    if (!window.confirm('이 섹션을 삭제할까요? (전체 저장 시 DB 반영)')) return;
    setSections((prev) => prev.filter((s) => s.key !== key));
    setDeletedKeys((prev) => { const next = new Set(prev); next.add(String(key)); return next; });
  }

  const dirtyKeys = useMemo(
    () => sections.filter((s) => (state[s.key]?.content ?? '') !== (state[s.key]?.baseline ?? '')).map((s) => s.key),
    [state, sections],
  );

  async function handleSaveAll() {
    setSavingAll(true);
    try {
      // 1) 삭제된 섹션 DB 제거
      for (const k of deletedKeys) {
        await deleteReportSection(programId, k as ProgramReportSectionKey);
      }
      // 2) 남은 섹션 sort_order = index 로 upsert
      for (let i = 0; i < sections.length; i += 1) {
        const sec = sections[i];
        await saveReportSection(programId, sec.key, state[sec.key]?.content ?? '', i);
      }
      toast.success(`${sections.length}개 섹션 + 삭제 ${deletedKeys.size}건 반영했어요.`);
      await refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[program-report] 전체 저장 실패:', raw);
      toast.error('전체 저장 중 오류가 발생했어요.');
    } finally {
      setSavingAll(false);
    }
  }

  function handleDownload() {
    const parts: string[] = [`# ${programName || '프로그램'} 결과보고서`, ''];
    for (const sec of sections) {
      parts.push(`## ${sec.label}`, '');
      parts.push(state[sec.key]?.content || '(미입력)', '');
    }
    const blob = new Blob([parts.join('\n')], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url; a.download = `${programName || 'program'}_결과보고서.txt`;
    document.body.appendChild(a); a.click(); a.remove();
    URL.revokeObjectURL(url);
  }

  if (loading) {
    return (
      <div className="flex items-center justify-center py-16 text-sm text-slate-500">
        <Loader2 size={18} className="animate-spin mr-2" aria-hidden="true" />
        결과보고서를 불러오는 중…
      </div>
    );
  }

  const pendingCount = dirtyKeys.length + deletedKeys.size;

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2 flex-wrap rounded-2xl border border-violet-100 bg-white px-5 py-4 shadow-[0_4px_16px_rgba(124,58,237,0.04)]">
        <div className="flex items-center gap-2 min-w-0">
          <span className="shrink-0 inline-flex items-center justify-center w-9 h-9 rounded-xl bg-violet-100 text-violet-600">
            <FileText size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1E1B4B] truncate">결과보고서</p>
            <p className="text-[11px] text-slate-500">
              섹션 9개 표준 + ↑↓ 순서 변경 / + 추가 / × 삭제. {pendingCount > 0 ? `${pendingCount}건 대기 중.` : '모든 변경 저장됨.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={() => setAddOpen((v) => !v)}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-violet-700 text-xs font-bold hover:bg-violet-50">
            <Plus size={11} aria-hidden="true" /> 섹션 추가
          </button>
          <button type="button" onClick={handleDownload}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-violet-700 text-xs font-bold hover:bg-violet-50">
            <Download size={11} aria-hidden="true" /> 다운로드
          </button>
          <button type="button" onClick={() => void handleSaveAll()} disabled={savingAll}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
            {savingAll ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : null}
            전체 저장 {pendingCount > 0 ? `(${pendingCount})` : ''}
          </button>
        </div>
      </header>

      {addOpen && (
        <div className="flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50/40 px-4 py-2.5">
          <span className="text-xs font-bold text-violet-700 shrink-0">새 섹션</span>
          <input type="text" value={addingLabel} autoFocus
            onChange={(e) => setAddingLabel(e.target.value)}
            onKeyDown={(e) => { if (e.key === 'Enter') handleAddSection(); if (e.key === 'Escape') { setAddOpen(false); setAddingLabel(''); } }}
            placeholder="섹션 이름 입력 후 Enter (예: 사진·증빙)"
            className="flex-1 h-8 px-3 rounded-md border border-violet-200 bg-white text-sm focus:outline-none focus:border-violet-400" />
          <button type="button" onClick={handleAddSection}
            className="h-8 px-3 rounded-md text-xs font-bold text-white bg-violet-600 hover:bg-violet-700">추가</button>
          <button type="button" onClick={() => { setAddOpen(false); setAddingLabel(''); }}
            className="h-8 px-2 rounded-md text-xs text-slate-500 hover:bg-slate-100">취소</button>
        </div>
      )}

      <div className="space-y-3">
        {sections.map((sec, idx) => {
          const s = state[sec.key] ?? EMPTY_STATE;
          return (
            <ReportSectionCard
              key={sec.key}
              Icon={sec.Icon}
              label={sec.label}
              canGenerate={sec.canGenerate}
              content={s.content}
              onContentChange={(v) => patch(sec.key, { content: v })}
              onGenerate={() => handleGenerate(sec.key)}
              onSave={() => handleSaveOne(sec.key, idx)}
              isGenerating={s.generating}
              isSaving={s.saving}
              isDirty={s.content !== s.baseline}
              updatedAt={s.updatedAt}
              onMove={(dir) => moveSection(idx, dir)}
              onDelete={() => handleDeleteSection(sec.key)}
              isFirst={idx === 0}
              isLast={idx === sections.length - 1}
            />
          );
        })}
      </div>
    </div>
  );
}
