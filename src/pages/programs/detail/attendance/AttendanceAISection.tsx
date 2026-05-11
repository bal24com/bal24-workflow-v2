// bal24 v2 — STEP-PROGRAM-ENHANCE-FULL AI 출석 처리 섹션
// 출석부 파일(엑셀/PDF/이미지) + 자연어 지시 → ai-chat → attendance_records bulk INSERT

import { useState } from 'react';
import { Loader2, Sparkles, Upload, X } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { callAiWithFile } from '../../../../lib/aiClient';
import type { ProgramParticipant } from '../../../../types/database';

interface Props {
  programId: string;
  onProcessed?: () => void;
}

const BUCKET = 'attendance-files';

const AI_PROMPT = (instruction: string) => `
당신은 출석부 분석 AI입니다. 첨부된 파일(또는 파일들)을 분석하여 출석자 목록을 추출하세요.

사용자 지시: "${instruction || '파일 이름에서 N일차를 추론하고, 사인·체크가 있는 사람만 출석으로 간주'}"

규칙:
- 사인·체크·O 표시가 있으면 출석
- 빈 칸·X·결석 표시는 결석
- 파일이 여러 개면 day_label을 파일 순서대로 "1일차", "2일차"... 또는 사용자 지시 우선

응답 형식 — JSON 배열만 (마크다운 금지):
[
  { "day_label": "1일차", "present": ["홍길동", "이순신"], "absent": ["김철수"] },
  { "day_label": "2일차", "present": [...], "absent": [...] }
]
`.trim();

export default function AttendanceAISection({ programId, onProcessed }: Props) {
  const toast = useToast();
  const [files, setFiles] = useState<File[]>([]);
  const [instruction, setInstruction] = useState('');
  const [processing, setProcessing] = useState(false);

  async function handleProcess() {
    if (files.length === 0) { toast.error('파일을 먼저 선택해 주세요.'); return; }
    setProcessing(true);
    try {
      // 1. Storage 업로드 (병렬)
      const uploadResults = await Promise.all(files.map(async (file) => {
        const ext = (file.name.includes('.') ? file.name.split('.').pop() : 'bin')!.replace(/[^a-z]/gi, '').toLowerCase() || 'bin';
        const safe = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 40) || 'attend';
        const path = `${programId}/ai/${Date.now()}_${safe}.${ext}`;
        const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
        if (up.error) throw new Error(up.error.message);
        return { file, url: supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl };
      }));

      // 2. AI 호출 — 파일별로 단수 호출 + 결과 누적 (callAiWithFile 패턴)
      const parsed: Array<{ day_label: string; present: string[]; absent?: string[] }> = [];
      for (let i = 0; i < uploadResults.length; i += 1) {
        const { file } = uploadResults[i];
        const dayHint = `이 파일은 ${i + 1}번째 파일입니다. 사용자 지시를 우선 적용하되 명시 없으면 "${i + 1}일차"로 day_label 추정.`;
        const res = await callAiWithFile(file, `${AI_PROMPT(instruction)}\n\n${dayHint}`, 'chat', { maxTokens: 2048 });
        if (!res.ok || !res.text) continue;
        const cleaned = res.text.replace(/^```json\s*/i, '').replace(/```\s*$/, '').trim();
        try {
          const obj = JSON.parse(cleaned);
          if (Array.isArray(obj)) parsed.push(...obj);
          else if (obj && typeof obj === 'object') parsed.push(obj);
        } catch {
          const idx = cleaned.indexOf('[');
          if (idx >= 0) { try { parsed.push(...JSON.parse(cleaned.slice(idx))); } catch { /* noop */ } }
        }
      }
      if (parsed.length === 0) { toast.error('AI 응답 JSON 파싱 실패.'); return; }

      // 4. participants 조회 → 이름 매칭
      const partRes = await supabase.from('program_participants').select('id, name').eq('program_id', programId);
      if (partRes.error || !partRes.data) { toast.error('교육생 목록 조회 실패.'); return; }
      const participants = partRes.data as Pick<ProgramParticipant, 'id' | 'name'>[];

      // 5. attendance_records bulk INSERT (이름 부분 매칭)
      const records: Array<Record<string, unknown>> = [];
      for (const day of parsed) {
        for (const p of participants) {
          const isPresent = day.present.some((n) => n.includes(p.name) || p.name.includes(n));
          records.push({
            program_id: programId, participant_id: p.id,
            day_label: day.day_label, is_present: isPresent,
            note: 'AI 자동 처리',
          });
        }
      }
      // 중복 방지 — 동일 (program_id, participant_id, day_label) 기존 row 삭제 후 재삽입
      for (const day of parsed) {
        const del = await supabase.from('program_attendance_records').delete()
          .eq('program_id', programId).eq('day_label', day.day_label);
        if (del.error) console.warn('[attend-ai] 기존 row 삭제 경고:', del.error.message);
      }
      const ins = await supabase.from('program_attendance_records').insert(records);
      if (ins.error) { console.error('[attend-ai] insert 실패:', ins.error.message); toast.error('출석 기록 저장에 실패했어요.'); return; }

      toast.success(`AI 출석 처리 완료 — ${parsed.length}일치 / ${records.length}건 등록`);
      setFiles([]); setInstruction('');
      onProcessed?.();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[attend-ai] 처리 실패:', raw);
      toast.error('AI 출석 처리 중 오류가 발생했어요.');
    } finally {
      setProcessing(false);
    }
  }

  return (
    <div className="space-y-2">
      <p className="text-[11px] text-violet-700/80 flex items-center gap-1">
        <Sparkles size={11} aria-hidden="true" /> 출석부 파일(엑셀·PDF·이미지)을 올리면 AI가 자동으로 출석을 체크합니다.
      </p>
      <input type="file" multiple accept=".pdf,.png,.jpg,.jpeg,.xlsx,.xls" disabled={processing}
        onChange={(e) => { setFiles(Array.from(e.target.files ?? [])); e.target.value = ''; }}
        className="block w-full text-xs text-slate-500
          file:mr-3 file:py-1.5 file:px-3 file:rounded file:border file:border-violet-300
          file:text-xs file:font-semibold file:text-violet-700 file:bg-violet-50 hover:file:bg-violet-100" />
      {files.length > 0 && (
        <ul className="space-y-1">
          {files.map((f, i) => (
            <li key={i} className="flex items-center gap-1 text-[11px] text-slate-600">
              <span className="inline-block w-5 text-right text-slate-400">{i + 1}.</span>
              <span className="flex-1 truncate">{f.name}</span>
              <button type="button" onClick={() => setFiles(files.filter((_, j) => j !== i))}
                aria-label="제거" className="text-slate-400 hover:text-rose-500"><X size={11} /></button>
            </li>
          ))}
        </ul>
      )}
      <textarea value={instruction} onChange={(e) => setInstruction(e.target.value)} rows={2}
        placeholder="예) 1번 파일은 1일차, 2번 파일은 2일차로 처리해줘"
        className="w-full px-2 py-1.5 rounded border border-violet-200 text-xs focus:outline-none focus:border-violet-500 resize-none" />
      <button type="button" disabled={processing || files.length === 0}
        onClick={() => void handleProcess()}
        className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
        {processing ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
        {processing ? 'AI 처리 중…' : 'AI 출석 처리 시작'}
      </button>
    </div>
  );
}
