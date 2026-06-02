// 박경수님 2026-06-02 CLUB-13 — 외부공유 항목 · 진행 중 파일 제출 (과정 산출물·사진).
// 폼 발행 없이 바로 업로드. activity_logs(log_type='upload') 에 저장 → PM 일지에서 확인.

import { useCallback, useEffect, useState } from 'react';
import { FileUp, Send, Loader2, CalendarDays } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { ActivityLog, ActivityFile } from '../../../types/database';
import MultiFileUpload from '../../../components/MultiFileUpload';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

const inputClass =
  'w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm text-[#1E1B4B] placeholder-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors';

export default function FileUploadItem({ programId }: Props) {
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [memo, setMemo] = useState('');
  const [files, setFiles] = useState<ActivityFile[]>([]);
  const [saving, setSaving] = useState(false);
  const [err, setErr] = useState<string | null>(null);
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('program_id', programId)
      .eq('log_type', 'upload')
      .is('deleted_at', null)
      .order('activity_date', { ascending: false })
      .limit(20);
    if (error) { console.error('[FileUploadItem] 조회 실패:', error.message); return; }
    setLogs((data ?? []) as ActivityLog[]);
  }, [programId]);

  useEffect(() => { void reload(); }, [reload]);

  async function handleSubmit() {
    setErr(null);
    if (!title.trim()) { setErr('제목을 입력해 주세요.'); return; }
    if (files.length === 0) { setErr('파일을 1개 이상 첨부해 주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('activity_logs').insert({
      program_id: programId,
      log_type: 'upload',
      title: title.trim(),
      activity_date: date || new Date().toISOString().slice(0, 10),
      content: memo.trim() || null,
      file_urls: files,
    });
    setSaving(false);
    if (error) {
      console.error('[FileUploadItem] INSERT 실패:', error.message);
      setErr('제출에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setTitle(''); setDate(''); setMemo(''); setFiles([]);
    void reload();
  }

  return (
    <ItemCard
      icon={<FileUp size={18} aria-hidden="true" />}
      title="파일 제출"
      hint="과정 산출물·사진·자료를 바로 업로드해 주세요 (드래그·붙여넣기 가능)"
    >
      <div className="flex flex-col gap-2.5">
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">제목 <span className="text-rose-500">*</span></label>
            <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
              placeholder="예: 2차 활동 사진" className={inputClass} />
          </div>
          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">날짜</label>
            <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className={inputClass} />
          </div>
        </div>
        <textarea value={memo} onChange={(e) => setMemo(e.target.value)}
          placeholder="설명 (선택)" className={`${inputClass} min-h-[64px] resize-y leading-relaxed`} />
        <MultiFileUpload bucket="satisfaction-files" pathPrefix={`upload/${programId}`}
          files={files} onChange={setFiles} disabled={saving} />
        {err && <p role="alert" className="text-xs text-rose-600 font-semibold">{err}</p>}
        <button type="button" onClick={() => void handleSubmit()} disabled={saving || !title.trim() || files.length === 0}
          className="self-end inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors">
          {saving ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
          {saving ? '제출 중…' : '제출하기'}
        </button>
      </div>

      {/* 최근 제출 목록 */}
      {logs.length > 0 && (
        <div className="mt-3 pt-3 border-t border-slate-100 space-y-2">
          <p className="text-[11px] font-bold text-slate-600">최근 제출 ({logs.length})</p>
          <ul className="space-y-1.5">
            {logs.map((log) => (
              <li key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-2.5 space-y-1">
                <div className="flex items-center gap-2 flex-wrap">
                  <span className="text-sm font-bold text-[#1E1B4B]">{log.title}</span>
                  <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                    <CalendarDays size={11} aria-hidden="true" /> {log.activity_date}
                  </span>
                </div>
                {log.file_urls && log.file_urls.length > 0 && (
                  <div className="flex flex-wrap gap-1.5">
                    {log.file_urls.map((f, i) => (
                      /\.(png|jpe?g|gif|webp)$/i.test(f.name) ? (
                        <a key={i} href={f.url} target="_blank" rel="noreferrer" className="block">
                          <img src={f.url} alt={f.name} className="w-16 h-16 object-cover rounded-lg border border-slate-200" />
                        </a>
                      ) : (
                        <a key={i} href={f.url} target="_blank" rel="noreferrer"
                          className="text-[11px] text-violet-700 hover:underline bg-violet-50 rounded px-2 py-1">📎 {f.name}</a>
                      )
                    ))}
                  </div>
                )}
              </li>
            ))}
          </ul>
        </div>
      )}
    </ItemCard>
  );
}
