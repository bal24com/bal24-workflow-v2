// bal24 v2 — STEP-PROGRAM-REPORT-TAB
// 프로그램 결과보고서 탭 — 6섹션 자동집계 + 직접 편집 + 저장 + 전체 다운로드

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, FileText, ClipboardCheck, BookOpen, Users2, BarChart3, Award, Download,
} from 'lucide-react';
import type { LucideIcon } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import ReportSectionCard from './ReportSectionCard';
import {
  fetchReportSections, saveReportSection, SECTION_GENERATORS,
} from './programReportUtils';
import type { ProgramReportSectionKey } from '../../../types/database';

interface Props { programId: string }

interface SectionDef {
  key: ProgramReportSectionKey;
  label: string;
  Icon: LucideIcon;
  /** 자동집계 지원 여부 */
  canGenerate: boolean;
}

const SECTIONS: SectionDef[] = [
  { key: 'overview',     label: '사업 개요',     Icon: FileText,        canGenerate: true  },
  { key: 'curriculum',   label: '커리큘럼 요약', Icon: BookOpen,        canGenerate: true  },
  { key: 'participants', label: '교육생 현황',   Icon: Users2,          canGenerate: true  },
  { key: 'attendance',   label: '출석 현황',     Icon: ClipboardCheck,  canGenerate: true  },
  { key: 'satisfaction', label: '만족도 요약',   Icon: BarChart3,       canGenerate: true  },
  { key: 'outcomes',     label: '성과 및 결론',  Icon: Award,           canGenerate: true  },
];

interface SectionState {
  content: string;
  updatedAt: string | null;
  /** 마지막 저장된 본문 (dirty 판정용) */
  baseline: string;
  /** AI 집계 진행 중 */
  generating: boolean;
  /** 저장 진행 중 */
  saving: boolean;
}

const EMPTY_STATE: SectionState = { content: '', updatedAt: null, baseline: '', generating: false, saving: false };

export default function ProgramReportTab({ programId }: Props) {
  const toast = useToast();
  const [programName, setProgramName] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [savingAll, setSavingAll] = useState(false);
  const [state, setState] = useState<Record<ProgramReportSectionKey, SectionState>>({
    overview: EMPTY_STATE, curriculum: EMPTY_STATE, participants: EMPTY_STATE,
    attendance: EMPTY_STATE, satisfaction: EMPTY_STATE, outcomes: EMPTY_STATE, extra: EMPTY_STATE,
  });

  const refresh = useCallback(async () => {
    setLoading(true);
    const [rows, prog] = await Promise.all([
      fetchReportSections(programId),
      supabase.from('programs').select('name').eq('id', programId).maybeSingle(),
    ]);
    setProgramName(prog.data?.name ?? '');
    const next = { ...state };
    for (const sec of SECTIONS) {
      const row = rows.find((r) => r.section_key === sec.key);
      next[sec.key] = {
        ...EMPTY_STATE,
        content: row?.content ?? '',
        baseline: row?.content ?? '',
        updatedAt: row?.updated_at ?? null,
      };
    }
    setState(next);
    setLoading(false);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId]);

  useEffect(() => { void refresh(); }, [refresh]);

  function patch(key: ProgramReportSectionKey, partial: Partial<SectionState>) {
    setState((prev) => ({ ...prev, [key]: { ...prev[key], ...partial } }));
  }

  async function handleGenerate(key: ProgramReportSectionKey) {
    const gen = SECTION_GENERATORS[key];
    if (!gen) return;
    patch(key, { generating: true });
    try {
      const text = await gen(programId);
      patch(key, { content: text, generating: false });
      toast.success(`${labelOf(key)} 섹션을 자동집계했어요. [저장]을 눌러 반영하세요.`);
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
      toast.success(`${labelOf(key)} 섹션을 저장했어요.`);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[program-report] 저장 실패:', raw);
      toast.error('저장 중 오류가 발생했어요.');
      patch(key, { saving: false });
    }
  }

  const dirtyKeys = useMemo(
    () => SECTIONS.filter((s) => state[s.key].content !== state[s.key].baseline).map((s) => s.key),
    [state],
  );

  async function handleSaveAll() {
    if (dirtyKeys.length === 0) { toast.success('저장할 변경이 없어요.'); return; }
    setSavingAll(true);
    try {
      for (let i = 0; i < SECTIONS.length; i += 1) {
        const sec = SECTIONS[i];
        if (!dirtyKeys.includes(sec.key)) continue;
        await saveReportSection(programId, sec.key, state[sec.key].content, i);
      }
      toast.success(`${dirtyKeys.length}개 섹션을 저장했어요.`);
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
    for (const sec of SECTIONS) {
      parts.push(`## ${sec.label}`, '');
      parts.push(state[sec.key].content || '(미입력)', '');
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
              섹션별 자동집계 후 직접 편집할 수 있어요. {dirtyKeys.length > 0 ? `${dirtyKeys.length}개 섹션이 저장 대기 중이에요.` : '모든 변경이 저장됐어요.'}
            </p>
          </div>
        </div>
        <div className="flex items-center gap-1.5 shrink-0">
          <button type="button" onClick={handleDownload}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-violet-200 bg-white text-violet-700 text-xs font-bold hover:bg-violet-50">
            <Download size={11} aria-hidden="true" /> 텍스트 다운로드
          </button>
          <button type="button" onClick={() => void handleSaveAll()} disabled={savingAll || dirtyKeys.length === 0}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
            {savingAll ? <Loader2 size={11} className="animate-spin" aria-hidden="true" /> : null}
            전체 저장 {dirtyKeys.length > 0 ? `(${dirtyKeys.length})` : ''}
          </button>
        </div>
      </header>

      <div className="space-y-3">
        {SECTIONS.map((sec, idx) => {
          const s = state[sec.key];
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
            />
          );
        })}
      </div>
    </div>
  );
}

function labelOf(key: ProgramReportSectionKey): string {
  return SECTIONS.find((s) => s.key === key)?.label ?? key;
}
