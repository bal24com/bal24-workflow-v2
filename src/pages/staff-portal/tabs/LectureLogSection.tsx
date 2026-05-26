// 강사 포털 · 강의 일지 카드 섹션 — 박경수님 + SkyClaw STEP-STAFF-PORTAL-REDESIGN PART D (2026-05-28)
// 차시별 카드 (아코디언) + textarea 자동저장 (debounce 2초) + 사진 업로드 (curriculum-photos 버킷) + 제출.

import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ChevronDown, ChevronUp, Loader2, Trash2, ImageIcon, CheckCircle2, Clock, PencilLine, Send } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo } from '../../../lib/utils';
import type { StaffPortalIdentity } from '../staffPortalUtils';

interface Props {
  staff: StaffPortalIdentity;
  programId: string;
  curriculums: Array<{ id: string; session_no: number; title: string; session_date: string | null; start_time: string | null }>;
}

interface LogPhoto { url: string; path: string; filename: string; size: number; uploaded_at: string }
interface LogRow {
  id?: string; curriculum_id: string; staff_id: string; program_id: string;
  content: string; photos: LogPhoto[];
  status: 'draft' | 'submitted'; submitted_at: string | null;
}

const EMPTY_LOG: Omit<LogRow, 'curriculum_id' | 'staff_id' | 'program_id'> = {
  content: '', photos: [], status: 'draft', submitted_at: null,
};

export default function LectureLogSection({ staff, programId, curriculums }: Props) {
  const toast = useToast();
  const [logs, setLogs] = useState<Record<string, LogRow>>({}); // curriculum_id → LogRow
  const [loading, setLoading] = useState(true);
  const [expandedId, setExpandedId] = useState<string | null>(null);

  // 박경수님 환경: staff_pool 강사만 일지 작성 가능 (profile 강사는 별도 흐름)
  const canWrite = staff.sourceType === 'staff_pool';

  const fetchLogs = useCallback(async () => {
    setLoading(true);
    const curIds = curriculums.map((c) => c.id);
    if (curIds.length === 0) { setLogs({}); setLoading(false); return; }
    const { data, error } = await supabase.from('curriculum_logs')
      .select('id, curriculum_id, staff_id, program_id, content, photos, status, submitted_at')
      .in('curriculum_id', curIds).eq('staff_id', staff.id);
    setLoading(false);
    if (error) { console.error('[LectureLog] 조회 실패:', error.message); return; }
    const map: Record<string, LogRow> = {};
    for (const r of (data ?? []) as LogRow[]) { map[r.curriculum_id] = { ...r, photos: r.photos ?? [] }; }
    setLogs(map);
  }, [curriculums, staff.id]);

  useEffect(() => { void fetchLogs(); }, [fetchLogs]);

  if (!canWrite) return null;
  if (curriculums.length === 0) return null;
  if (loading) return <div className="flex justify-center py-6"><Loader2 size={18} className="animate-spin text-violet-400" /></div>;

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.08)] space-y-3">
      <header className="flex items-center justify-between">
        <h2 className="text-base font-bold text-[#1E1B4B] flex items-center gap-2">
          <PencilLine size={16} className="text-violet-500" aria-hidden="true" /> 강의 일지 ({curriculums.length}차시)
        </h2>
        <span className="text-[11px] text-slate-400">차시 카드 클릭 → 작성 / 자동저장 / 제출</span>
      </header>
      <ul className="space-y-2">
        {curriculums.map((c) => {
          const log = logs[c.id] ?? { ...EMPTY_LOG, curriculum_id: c.id, staff_id: staff.id, program_id: programId };
          const expanded = expandedId === c.id;
          const borderClass = log.status === 'submitted' ? 'border-emerald-200' : log.id ? 'border-amber-200 bg-amber-50/30' : 'border-slate-200';
          const badge = log.status === 'submitted'
            ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-emerald-100 text-emerald-700"><CheckCircle2 size={10} aria-hidden="true" />제출완료</span>
            : log.id ? <span className="inline-flex items-center gap-1 px-2 py-0.5 rounded-md text-[10px] font-bold bg-amber-100 text-amber-700"><Clock size={10} aria-hidden="true" />임시저장</span>
            : <span className="inline-flex items-center px-2 py-0.5 rounded-md text-[10px] font-bold bg-slate-100 text-slate-500">미작성</span>;
          return (
            <li key={c.id} className={`rounded-xl border ${borderClass} overflow-hidden transition-all`}>
              <button type="button" onClick={() => setExpandedId(expanded ? null : c.id)}
                className="w-full flex items-center gap-3 px-3 py-2.5 hover:bg-violet-50/50">
                <span className="text-xs font-bold text-violet-700 tabular-nums w-8 text-center">{c.session_no}</span>
                <div className="flex-1 min-w-0 text-left">
                  <p className="text-sm font-semibold text-slate-800 truncate">{c.title}</p>
                  <p className="text-[11px] text-slate-500 tabular-nums">{formatDateKo(c.session_date)}{c.start_time ? ` · ${c.start_time.slice(0, 5)}` : ''}</p>
                </div>
                {badge}
                {expanded ? <ChevronUp size={14} className="text-slate-400" /> : <ChevronDown size={14} className="text-slate-400" />}
              </button>
              {expanded && (
                <LectureLogForm log={log} onSaved={(next) => setLogs((prev) => ({ ...prev, [c.id]: next }))} toast={toast} />
              )}
            </li>
          );
        })}
      </ul>
    </section>
  );
}

// ============================================================
// 일지 폼 — 자동저장(debounce 2초) + 사진 업로드 + 제출
// ============================================================
interface FormProps {
  log: LogRow;
  onSaved: (next: LogRow) => void;
  toast: ReturnType<typeof useToast>;
}

function LectureLogForm({ log, onSaved, toast }: FormProps) {
  const [content, setContent] = useState(log.content ?? '');
  const [photos, setPhotos] = useState<LogPhoto[]>(log.photos ?? []);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);
  const isSubmitted = log.status === 'submitted';

  const saveDraft = useCallback(async (nextContent: string, nextPhotos: LogPhoto[]) => {
    setSaveStatus('saving');
    const { data, error } = await supabase.from('curriculum_logs')
      .upsert({
        curriculum_id: log.curriculum_id, staff_id: log.staff_id, program_id: log.program_id,
        content: nextContent, photos: nextPhotos, status: 'draft',
      }, { onConflict: 'curriculum_id,staff_id' })
      .select('id, curriculum_id, staff_id, program_id, content, photos, status, submitted_at').maybeSingle();
    if (error) { console.error('[LectureLog] 자동저장 실패:', error.message); setSaveStatus('error'); return; }
    setSaveStatus('saved');
    if (data) onSaved({ ...(data as LogRow), photos: (data as LogRow).photos ?? [] });
  }, [log.curriculum_id, log.staff_id, log.program_id, onSaved]);

  // debounce 자동저장
  useEffect(() => {
    if (isSubmitted) return;
    if (content === (log.content ?? '') && photos === log.photos) return;
    if (timerRef.current) clearTimeout(timerRef.current);
    timerRef.current = setTimeout(() => { void saveDraft(content, photos); }, 2000);
    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [content, photos]);

  async function handleUpload(file: File) {
    if (file.size > 10 * 1024 * 1024) { toast.error('사진은 10MB 이하만 업로드할 수 있어요.'); return; }
    if (photos.length >= 10) { toast.error('사진은 최대 10장까지 첨부할 수 있어요.'); return; }
    setUploading(true);
    const safe = file.name.replace(/[^\w.\- ]/g, '_');
    const path = `${log.program_id}/${log.curriculum_id}/${log.staff_id}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from('curriculum-photos').upload(path, file, { upsert: false });
    if (error) {
      setUploading(false);
      const msg = error.message.toLowerCase().includes('not found') ? 'curriculum-photos 버킷이 없어요. Supabase Storage 에서 먼저 생성해 주세요.' : `업로드 실패: ${error.message}`;
      toast.error(msg); return;
    }
    const { data: pub } = supabase.storage.from('curriculum-photos').getPublicUrl(path);
    const newPhoto: LogPhoto = { url: pub.publicUrl, path, filename: file.name, size: file.size, uploaded_at: new Date().toISOString() };
    const nextPhotos = [...photos, newPhoto];
    setPhotos(nextPhotos);
    setUploading(false);
    // 사진 추가 즉시 저장 (debounce 안 기다림)
    void saveDraft(content, nextPhotos);
  }

  async function handleRemovePhoto(photo: LogPhoto) {
    if (!window.confirm(`사진 "${photo.filename}" 을 삭제할까요?`)) return;
    await supabase.storage.from('curriculum-photos').remove([photo.path]);
    const nextPhotos = photos.filter((p) => p.path !== photo.path);
    setPhotos(nextPhotos);
    void saveDraft(content, nextPhotos);
  }

  async function handleSubmit() {
    if (!content.trim() && photos.length === 0) { toast.error('내용 또는 사진을 1건 이상 입력해 주세요.'); return; }
    setSubmitting(true);
    // 먼저 draft 저장
    await saveDraft(content, photos);
    // 그 다음 submitted 로 전환
    const { data, error } = await supabase.from('curriculum_logs')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .match({ curriculum_id: log.curriculum_id, staff_id: log.staff_id })
      .select('id, curriculum_id, staff_id, program_id, content, photos, status, submitted_at').maybeSingle();
    setSubmitting(false);
    if (error) { console.error('[LectureLog] 제출 실패:', error.message); toast.error('제출 중 오류가 발생했어요.'); return; }
    toast.success('일지를 제출했어요. 🎉');
    if (data) onSaved({ ...(data as LogRow), photos: (data as LogRow).photos ?? [] });
  }

  const saveLabel = useMemo(() => {
    if (saveStatus === 'saving') return <span className="inline-flex items-center gap-1 text-[10px] text-slate-400"><Loader2 size={10} className="animate-spin" aria-hidden="true" />저장 중…</span>;
    if (saveStatus === 'saved') return <span className="text-[10px] text-emerald-600">✓ 저장됨</span>;
    if (saveStatus === 'error') return <span className="text-[10px] text-rose-600">⚠ 저장 실패</span>;
    return null;
  }, [saveStatus]);

  if (isSubmitted) {
    return (
      <div className="px-4 py-3 bg-emerald-50/40 border-t border-emerald-100">
        <p className="text-[11px] text-emerald-700 font-bold mb-2 inline-flex items-center gap-1"><CheckCircle2 size={11} aria-hidden="true" />제출 완료 — 수정 불가</p>
        {content && <p className="text-xs text-slate-700 whitespace-pre-line mb-2">{content}</p>}
        {photos.length > 0 && (
          <div className="grid grid-cols-3 gap-2">
            {photos.map((p) => (
              <a key={p.path} href={p.url} target="_blank" rel="noopener noreferrer" className="block aspect-square rounded-md overflow-hidden border border-emerald-200">
                <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />
              </a>
            ))}
          </div>
        )}
      </div>
    );
  }

  return (
    <div className="px-4 py-3 bg-amber-50/30 border-t border-amber-100 space-y-2">
      <div className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">내용을 작성하면 2초 후 자동으로 저장돼요. 제출 전에는 언제든 수정 가능해요.</p>
        {saveLabel}
      </div>
      <textarea value={content} onChange={(e) => setContent(e.target.value)}
        placeholder="강의 진행 내용·특이사항·다음 차시 준비 등"
        className="w-full min-h-[120px] rounded-md border border-amber-200 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-y" />

      {/* 사진 그리드 */}
      {photos.length > 0 && (
        <div className="grid grid-cols-3 gap-2">
          {photos.map((p) => (
            <div key={p.path} className="relative group aspect-square rounded-md overflow-hidden border border-amber-200">
              <img src={p.url} alt={p.filename} className="w-full h-full object-cover" />
              <button type="button" onClick={() => void handleRemovePhoto(p)} aria-label="사진 삭제"
                className="absolute top-1 right-1 w-6 h-6 rounded-full bg-rose-600/90 text-white opacity-0 group-hover:opacity-100 transition-opacity flex items-center justify-center">
                <Trash2 size={11} aria-hidden="true" />
              </button>
            </div>
          ))}
        </div>
      )}

      <div className="flex items-center justify-between gap-2">
        <label className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border cursor-pointer ${uploading ? 'opacity-50 pointer-events-none border-slate-200' : 'border-violet-200 text-violet-700 hover:bg-violet-50'}`}>
          {uploading ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <ImageIcon size={12} aria-hidden="true" />}
          사진 추가 ({photos.length}/10)
          <input type="file" accept="image/*" className="hidden" disabled={uploading}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ''; }} />
        </label>
        <button type="button" onClick={() => void handleSubmit()} disabled={submitting || saveStatus === 'saving'}
          className="inline-flex items-center gap-1.5 px-4 py-1.5 text-sm font-semibold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50">
          {submitting ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Send size={12} aria-hidden="true" />}
          제출
        </button>
      </div>
    </div>
  );
}
