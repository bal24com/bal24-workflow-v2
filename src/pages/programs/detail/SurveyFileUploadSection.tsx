// bal24 v2 — STEP-CURRICULUM-ATTEND-SURVEY-FULL 만족도 외부 파일 업로드·분석 섹션
// 엑셀(구글폼 응답) → xlsx 파싱 → Storage 업로드 → Edge Function 'analyze-survey' → DB 저장

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Upload, FileText } from 'lucide-react';
import * as XLSX from 'xlsx';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import SurveyResultCard from './SurveyResultCard';
import type { SatisfactionSurvey } from '../../../types/database';

interface Props { programId: string }

const BUCKET = 'satisfaction-files';

export default function SurveyFileUploadSection({ programId }: Props) {
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [items, setItems] = useState<SatisfactionSurvey[]>([]);
  const [loading, setLoading] = useState(true);
  const [uploading, setUploading] = useState(false);

  const refresh = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('satisfaction_surveys').select('*')
      .eq('program_id', programId).order('uploaded_at', { ascending: false });
    if (error) {
      console.error('[survey-file] 조회 실패:', error.message);
      const m = error.message.toLowerCase();
      if (m.includes('does not exist') || m.includes('pgrst205')) {
        toast.error('만족도 분석 테이블이 적용되지 않았어요. Supabase 마이그레이션 실행 필요.');
      } else {
        toast.error('만족도 분석 결과를 불러오지 못했어요.');
      }
      setItems([]); setLoading(false); return;
    }
    setItems((data ?? []) as SatisfactionSurvey[]);
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  async function handleFile(file: File) {
    if (!file.name.match(/\.(xlsx?|csv)$/i)) { toast.error('엑셀(.xlsx/.xls/.csv) 파일만 업로드할 수 있어요.'); return; }
    if (file.size > 20 * 1024 * 1024) { toast.error('파일 용량이 20MB를 초과해요.'); return; }
    setUploading(true);
    try {
      // 1) 엑셀 파싱
      const buf = await file.arrayBuffer();
      const wb = XLSX.read(buf, { type: 'array' });
      const ws = wb.Sheets[wb.SheetNames[0]];
      const rows = XLSX.utils.sheet_to_json(ws) as Record<string, string | number>[];
      if (rows.length === 0) { toast.error('응답 데이터가 없어요.'); return; }

      // 2) Storage 업로드 (원본 보관)
      // STEP-SURVEY-FIX — Supabase Storage 키는 ASCII만 허용 → 한글·공백·특수문자 모두 '_'로 (file_name엔 원본 보관)
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 40) || 'survey';
      const ext = (file.name.includes('.') ? file.name.split('.').pop() : 'xlsx')!.replace(/[^a-z]/gi, '').toLowerCase();
      const path = `surveys/${programId}/${Date.now()}_${safeBase}.${ext || 'xlsx'}`;
      const up = await supabase.storage.from(BUCKET).upload(path, file, { upsert: true, contentType: file.type || undefined });
      if (up.error) {
        console.error('[survey-file] 업로드 실패:', up.error.message);
        toast.error('파일 업로드 실패 (satisfaction-files 버킷 생성 확인).');
        return;
      }
      const fileUrl = supabase.storage.from(BUCKET).getPublicUrl(path).data.publicUrl;

      // 3) Edge Function 호출 → 집계 + DB 저장
      const { data, error } = await supabase.functions.invoke('analyze-survey', {
        body: { program_id: programId, file_name: file.name, file_url: fileUrl, rows },
      });
      if (error) {
        console.error('[survey-file] 분석 실패:', error.message);
        toast.error('분석 중 오류가 발생했어요. (Edge Function 배포 확인)');
        return;
      }
      const total = (data as { total_count?: number } | null)?.total_count ?? rows.length;
      toast.success(`${total}건 응답이 분석되었어요.`);
      void refresh();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[survey-file] 예외:', raw);
      toast.error('파일 분석 중 오류가 발생했어요.');
    } finally {
      setUploading(false);
    }
  }

  async function handleDelete(s: SatisfactionSurvey) {
    if (!window.confirm(`"${s.file_name ?? '만족도 응답'}"을(를) 삭제할까요?`)) return;
    const { error } = await supabase.from('satisfaction_surveys').delete().eq('id', s.id);
    if (error) { console.error('[survey-file] 삭제 실패:', error.message); toast.error('삭제에 실패했어요.'); return; }
    toast.success('삭제했어요.');
    void refresh();
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)] p-4 space-y-3">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-bold text-[#1E1B4B]">만족도 외부 파일 업로드·분석</p>
          <p className="text-[11px] text-slate-500 mt-0.5">
            구글폼 응답 엑셀(.xlsx/.csv)을 업로드하면 항목별 평균과 자유서술을 자동 집계해요.
          </p>
        </div>
        <input ref={inputRef} type="file" accept=".xlsx,.xls,.csv" hidden disabled={uploading}
          onChange={(e) => { const f = e.target.files?.[0]; e.target.value = ''; if (f) void handleFile(f); }} />
        <button type="button" onClick={() => inputRef.current?.click()} disabled={uploading}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-40">
          {uploading ? <Loader2 size={12} className="animate-spin" /> : <Upload size={12} />}
          {uploading ? '분석 중…' : '파일 업로드'}
        </button>
      </header>

      {loading ? (
        <div className="flex justify-center py-6"><Loader2 size={16} className="animate-spin text-violet-400" /></div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-6 inline-flex items-center gap-1.5 justify-center w-full">
          <FileText size={12} aria-hidden="true" /> 업로드된 분석 결과가 없어요.
        </p>
      ) : (
        <div className="space-y-2.5">
          {items.map((s) => (
            <SurveyResultCard key={s.id} survey={s} programId={programId}
              onDelete={() => void handleDelete(s)}
              onAnalyzed={() => void refresh()} />
          ))}
        </div>
      )}
    </section>
  );
}
