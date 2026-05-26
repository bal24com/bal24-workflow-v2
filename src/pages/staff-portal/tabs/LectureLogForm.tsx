// bal24 v2 — STEP-PORTAL-LECTURE-LOG-REDESIGN (박경수님 2026-05-26)
// 강의일지 인라인 폼 — textarea + 사진 업로드 + 임시저장 / 제출 / 취소.
// LectureLogSection 의 펼침 영역에서 렌더.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, ImageIcon, Trash2, Save, Send, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import { useToast } from '../../../contexts/ToastContext';

export interface LectureLogPhoto {
  url: string;
  path: string;
  filename: string;
  size: number;
  uploaded_at: string;
}

export interface LectureLogRow {
  id?: string;
  curriculum_id: string;
  staff_id: string;
  program_id: string;
  content: string | null;
  photos: LectureLogPhoto[];
  status: 'draft' | 'submitted';
  submitted_at: string | null;
}

interface Props {
  curriculum: { id: string; session_no: number; title: string; session_date: string | null };
  staffId: string;
  staffName: string;
  staffAffiliation: string | null;
  programId: string;
  existing: LectureLogRow | null;
  onSaved: (next: LectureLogRow) => void;
  onClose: () => void;
  toast: ReturnType<typeof useToast>;
}

export default function LectureLogForm({
  curriculum, staffId, staffName, staffAffiliation, programId, existing, onSaved, onClose, toast,
}: Props) {
  const [content, setContent] = useState<string>(existing?.content ?? '');
  const [photos, setPhotos] = useState<LectureLogPhoto[]>(existing?.photos ?? []);
  const [saveStatus, setSaveStatus] = useState<'idle' | 'saving' | 'saved' | 'error'>('idle');
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const isSubmitted = existing?.status === 'submitted';
  const timerRef = useRef<ReturnType<typeof setTimeout> | undefined>(undefined);

  const saveDraft = useCallback(async (
    nextContent: string, nextPhotos: LectureLogPhoto[],
  ): Promise<LectureLogRow | null> => {
    setSaveStatus('saving');
    const { data, error } = await supabase.from('curriculum_logs')
      .upsert({
        curriculum_id: curriculum.id, staff_id: staffId, program_id: programId,
        content: nextContent, photos: nextPhotos, status: 'draft',
      }, { onConflict: 'curriculum_id,staff_id' })
      .select('id, curriculum_id, staff_id, program_id, content, photos, status, submitted_at')
      .maybeSingle();
    if (error) {
      console.error('[LectureLogForm] 자동저장 실패:', error.message);
      setSaveStatus('error');
      return null;
    }
    setSaveStatus('saved');
    if (data) {
      const row = data as LectureLogRow;
      const next = { ...row, photos: (row.photos ?? []) as LectureLogPhoto[] };
      onSaved(next);
      return next;
    }
    return null;
  }, [curriculum.id, staffId, programId, onSaved]);

  // debounce 자동저장
  useEffect(() => {
    if (isSubmitted) return;
    if (content === (existing?.content ?? '') && photos === existing?.photos) return;
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
    const path = `${programId}/${curriculum.id}/${staffId}/${Date.now()}_${safe}`;
    const { error } = await supabase.storage.from('curriculum-photos').upload(path, file, { upsert: false });
    if (error) {
      setUploading(false);
      const msg = error.message.toLowerCase().includes('not found')
        ? 'curriculum-photos 버킷이 없어요. PM에게 생성을 요청해 주세요.'
        : `업로드 실패: ${error.message}`;
      toast.error(msg);
      return;
    }
    const { data: pub } = supabase.storage.from('curriculum-photos').getPublicUrl(path);
    const newPhoto: LectureLogPhoto = {
      url: pub.publicUrl, path, filename: file.name, size: file.size,
      uploaded_at: new Date().toISOString(),
    };
    const next = [...photos, newPhoto];
    setPhotos(next);
    setUploading(false);
    void saveDraft(content, next);
  }

  async function handleRemovePhoto(photo: LectureLogPhoto) {
    if (!window.confirm(`사진 "${photo.filename}" 을 삭제할까요?`)) return;
    await supabase.storage.from('curriculum-photos').remove([photo.path]);
    const next = photos.filter((p) => p.path !== photo.path);
    setPhotos(next);
    void saveDraft(content, next);
  }

  async function handleSubmit() {
    if (!content.trim() && photos.length === 0) {
      toast.error('내용 또는 사진을 1건 이상 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    await saveDraft(content, photos);
    const { data, error } = await supabase.from('curriculum_logs')
      .update({ status: 'submitted', submitted_at: new Date().toISOString() })
      .match({ curriculum_id: curriculum.id, staff_id: staffId })
      .select('id, curriculum_id, staff_id, program_id, content, photos, status, submitted_at')
      .maybeSingle();
    setSubmitting(false);
    if (error) {
      console.error('[LectureLogForm] 제출 실패:', error.message);
      toast.error('제출 중 오류가 발생했어요.');
      return;
    }
    toast.success('일지를 제출했어요. 🎉');
    if (data) {
      const row = data as LectureLogRow;
      onSaved({ ...row, photos: (row.photos ?? []) as LectureLogPhoto[] });
    }
  }

  const affiliationLabel = staffAffiliation ? ` (${staffAffiliation})` : '';

  return (
    <div className="space-y-3">
      <header className="flex items-start justify-between gap-2 flex-wrap">
        <div>
          <p className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
            ✏️ <span>{curriculum.session_no}차시 일지 {isSubmitted ? '(제출 완료)' : '작성'}</span>
            <span className="text-slate-400">—</span>
            <span className="text-slate-700">{curriculum.title}</span>
          </p>
          <p className="text-[11px] text-slate-500 mt-1">
            날짜 <span className="tabular-nums">{formatDateKo(curriculum.session_date) || '미정'}</span>
            <span className="mx-1.5 text-slate-300">|</span>
            작성자 <strong>{staffName}</strong>{affiliationLabel}
          </p>
        </div>
        <button type="button" onClick={onClose}
          className="inline-flex items-center gap-0.5 px-2 py-1 rounded text-[11px] text-slate-500 hover:bg-slate-100">
          <X size={11} aria-hidden="true" /> 닫기
        </button>
      </header>

      {isSubmitted ? (
        <div className="rounded-md border border-emerald-200 bg-emerald-50/40 px-3 py-3">
          {content && <p className="text-sm text-slate-700 whitespace-pre-wrap mb-2">{content}</p>}
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
              {photos.map((p) => (
                <a key={p.path} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="block aspect-square rounded-md overflow-hidden border border-emerald-200">
                  <img src={p.url} alt={p.filename} className="w-full h-full object-cover hover:opacity-80" />
                </a>
              ))}
            </div>
          )}
          <p className="mt-2 text-[10px] text-emerald-700 font-semibold">✓ 제출 완료 — 수정 불가</p>
        </div>
      ) : (
        <>
          <div className="flex items-center justify-between">
            <p className="text-[11px] text-slate-500">내용을 작성하면 2초 후 자동으로 저장돼요.</p>
            {saveStatus === 'saving' && <span className="text-[10px] text-slate-400 inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" />저장 중…</span>}
            {saveStatus === 'saved' && <span className="text-[10px] text-emerald-600">✓ 저장됨</span>}
            {saveStatus === 'error' && <span className="text-[10px] text-rose-600">⚠ 저장 실패</span>}
          </div>

          <label className="text-xs font-semibold text-slate-700 block">
            일지 내용 <span className="text-rose-500">*</span>
          </label>
          <textarea value={content} onChange={(e) => setContent(e.target.value)}
            placeholder="강의 진행 내용·특이사항·다음 차시 준비 등을 자유롭게 작성해 주세요."
            className="w-full min-h-[150px] rounded-md border border-amber-200 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-y" />

          {photos.length > 0 && (
            <div>
              <p className="text-xs font-semibold text-slate-700 mb-1.5">📷 강의 사진 ({photos.length}/10)</p>
              <div className="grid grid-cols-3 sm:grid-cols-4 gap-2">
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
            </div>
          )}

          <div className="flex items-center justify-between gap-2 pt-1">
            <label className={`inline-flex items-center gap-1 text-xs px-3 py-1.5 rounded-md border cursor-pointer ${uploading ? 'opacity-50 pointer-events-none border-slate-200' : 'border-violet-200 text-violet-700 hover:bg-violet-50'}`}>
              {uploading ? <Loader2 size={12} className="animate-spin" /> : <ImageIcon size={12} aria-hidden="true" />}
              사진 추가
              <input type="file" accept="image/*" className="hidden" disabled={uploading}
                onChange={(e) => { const f = e.target.files?.[0]; if (f) void handleUpload(f); e.target.value = ''; }} />
            </label>
            <div className="flex items-center gap-1.5">
              <button type="button" onClick={() => void saveDraft(content, photos)}
                disabled={saveStatus === 'saving'}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-700 border border-slate-300 rounded-md hover:bg-slate-50 disabled:opacity-50">
                <Save size={12} aria-hidden="true" /> 임시저장
              </button>
              <button type="button" onClick={() => void handleSubmit()}
                disabled={submitting || saveStatus === 'saving'}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-emerald-600 rounded-md hover:bg-emerald-700 disabled:opacity-50">
                {submitting ? <Loader2 size={12} className="animate-spin" /> : <Send size={12} aria-hidden="true" />}
                제출하기
              </button>
            </div>
          </div>
        </>
      )}
    </div>
  );
}
