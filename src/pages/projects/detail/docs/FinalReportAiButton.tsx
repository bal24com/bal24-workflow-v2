// bal24 v2 — STEP-AI-DOC-FEATURES 결과보고서 AI 초안 생성 버튼·모달

import { useState } from 'react';
import { Sparkles } from 'lucide-react';
import { Modal, Button } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { callAi } from '../../../../lib/aiClient';
import type { FinalReportSection } from '../../../../types/database';

interface Props {
  projectId: string;
  sections: FinalReportSection[];
  onCompleted: () => void;
}

const SYSTEM_PROMPT = `당신은 사업 결과보고서 작성 전문가입니다.
아래 사업 정보를 바탕으로 결과보고서 각 섹션의 초안을 작성하세요.
- 공식 보고체 사용
- 확인되지 않은 수치는 "[확인 필요]"로 표기
- 각 섹션 200~400자 분량
- JSON 객체로만 반환. 키는 섹션 제목, 값은 본문 텍스트.`;

function safeParse(raw: string): Record<string, string> {
  const cleaned = raw.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
  try { const r = JSON.parse(cleaned); return typeof r === 'object' && r ? r as Record<string, string> : {}; }
  catch { const i = cleaned.indexOf('{'); return i >= 0 ? safeParse(cleaned.slice(i)) : {}; }
}

export default function FinalReportAiButton({ projectId, sections, onCompleted }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [emptyOnly, setEmptyOnly] = useState(true);
  const [running, setRunning] = useState(false);

  async function handleGenerate() {
    setRunning(true);
    try {
      // 1) 컨텍스트 수집
      const [projRes, partRes, attRes, expRes, progRes] = await Promise.all([
        supabase.from('projects').select('name, description, contract_amount, start_date, end_date').eq('id', projectId).maybeSingle(),
        supabase.from('program_participants').select('id', { count: 'exact', head: true }),
        supabase.from('attendance_records').select('status', { count: 'exact' }),
        supabase.from('expenses').select('gross_amount').eq('project_id', projectId).is('deleted_at', null),
        supabase.from('programs').select('name, type, status').eq('project_id', projectId),
      ]);
      const project = projRes.data ?? {};
      const expRows = (expRes.data ?? []) as { gross_amount: number }[];
      const expensesTotal = expRows.reduce((s, r) => s + Number(r.gross_amount ?? 0), 0);
      const context = {
        project,
        participants_count: partRes.count ?? 0,
        attendance_total: attRes.count ?? 0,
        expenses_total: expensesTotal,
        programs: progRes.data ?? [],
      };

      // 2) 텍스트 섹션만 대상
      const targets = sections.filter((s) => s.section_type === 'text');
      if (targets.length === 0) { toast.error('초안을 생성할 텍스트 섹션이 없어요.'); return; }
      const sectionTitles = targets.map((s) => s.title);

      // 3) AI 호출
      const res = await callAi({
        preset: 'report-section',
        systemOverride: SYSTEM_PROMPT,
        messages: [{ role: 'user', content: `[사업 정보]\n${JSON.stringify(context, null, 2)}\n\n[작성 대상 섹션]\n${sectionTitles.join('\n')}` }],
        maxTokens: 4096,
      });
      if (!res.ok || !res.text) { toast.error('AI 초안 생성에 실패했어요.'); return; }
      const drafts = safeParse(res.text);

      // 4) UPDATE
      let updated = 0;
      for (const s of targets) {
        const draft = drafts[s.title]?.trim();
        if (!draft) continue;
        if (emptyOnly && s.content?.trim()) continue;
        const { error } = await supabase.from('final_report_sections')
          .update({ content: draft, updated_at: new Date().toISOString() }).eq('id', s.id);
        if (error) console.error('[final-report-ai] UPDATE 실패:', error.message);
        else updated += 1;
      }
      toast.success(`${updated}개 섹션 초안을 생성했어요.`);
      setOpen(false);
      onCompleted();
    } catch (err) {
      const r = err instanceof Error ? err.message : '';
      console.error('[final-report-ai] 실행 실패:', r);
      toast.error('AI 초안 생성 중 오류가 발생했어요.');
    } finally {
      setRunning(false);
    }
  }

  return (
    <>
      <Button variant="outline" size="sm" leftIcon={<Sparkles size={12} />} onClick={() => setOpen(true)}>
        AI 초안 생성
      </Button>
      <Modal open={open} onClose={() => setOpen(false)} title="✨ 결과보고서 AI 초안 생성" size="md"
        closeOnBackdrop={!running}
        footer={
          <div className="flex justify-end gap-2 w-full">
            <Button variant="outline" onClick={() => setOpen(false)} disabled={running}>취소</Button>
            <Button variant="primary" loading={running} onClick={() => void handleGenerate()}>
              {emptyOnly ? '빈 섹션만 생성' : '전체 교체'}
            </Button>
          </div>
        }>
        <div className="space-y-3">
          <p className="text-sm text-slate-700">
            프로젝트 정보·참여자·출석·지출·프로그램을 종합하여 텍스트 섹션 초안을 생성해요.
            <br />자동집계(참여자 현황·출석·사업비) 섹션은 대상에서 제외됩니다.
          </p>
          <label className="flex items-center gap-2 text-sm text-slate-700 cursor-pointer p-3 rounded-lg bg-slate-50 border border-slate-200">
            <input type="checkbox" checked={emptyOnly} onChange={(e) => setEmptyOnly(e.target.checked)}
              className="w-4 h-4 rounded border-slate-300 text-violet-600 focus:ring-violet-300" />
            <span>빈 섹션만 채우기 (체크 해제 시 기존 내용 덮어씀)</span>
          </label>
        </div>
      </Modal>
    </>
  );
}
