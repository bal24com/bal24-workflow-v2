// 박경수님 2026-06-02 CLUB-3 — 외부 토큰 페이지 결과보고서 열람 항목 (read-only).
// 지원기관이 자기 토큰으로 접속 시 program_report_sections 를 단계 라벨과 함께 표시.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, FileText } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ProgramReportSection } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

// 박경수님 2026-06-02 — programReportUtils.DEFAULT_REPORT_SECTIONS 와 동일 라벨 (외부 페이지는 utils import 최소화)
const SECTION_LABEL: Record<string, string> = {
  overview:     '사업 개요',
  goals:        '추진 목표 및 기대 효과',
  curriculum:   '교육 과정 및 운영 내용',
  participants: '교육생 현황 및 참여 실적',
  attendance:   '출석 현황',
  satisfaction: '만족도 조사 결과',
  outcomes:     '주요 성과 및 결론',
  budget:       '예산 집행 현황',
  improvements: '향후 개선 방향',
};

export default function ReportViewItem({ programId }: Props) {
  const [sections, setSections] = useState<ProgramReportSection[]>([]);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_report_sections')
      .select('*')
      .eq('program_id', programId)
      .order('sort_order');
    if (error) {
      console.error('[ReportViewItem] 보고서 조회 실패:', error.message);
      setSections([]);
      setLoading(false);
      return;
    }
    // 내용이 있는 섹션만 노출
    setSections(((data ?? []) as ProgramReportSection[]).filter((s) => (s.content ?? '').trim().length > 0));
    setLoading(false);
  }, [programId]);

  useEffect(() => { void reload(); }, [reload]);

  if (loading) {
    return (
      <ItemCard icon={<FileText size={18} />} title="결과보고서">
        <div className="flex justify-center py-4">
          <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      </ItemCard>
    );
  }

  if (sections.length === 0) return null;

  return (
    <ItemCard icon={<FileText size={18} className="text-violet-600" />} title="결과보고서">
      <div className="space-y-3">
        {sections.map((s) => (
          <div key={s.id ?? s.section_key} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3">
            <h4 className="text-sm font-bold text-[#1E1B4B] mb-1.5">
              {SECTION_LABEL[s.section_key] ?? s.section_key}
            </h4>
            <p className="text-xs text-slate-700 whitespace-pre-wrap leading-relaxed">{s.content}</p>
          </div>
        ))}
      </div>
    </ItemCard>
  );
}
