// bal24 v2 — STEP-PORTAL-MULTI-FIX PART D (박경수님 2026-05-26)
// 강의일지 인라인 폼 — 사진 우선 배치 + PortalPhotoUpload(공용) + 텍스트 영역 보조.

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Save, Send, X } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import { useToast } from '../../../contexts/ToastContext';
import PortalPhotoUpload, { type PortalPhoto } from '../../../components/portal/PortalPhotoUpload';
import AiDraftButton from '../../../components/portal/AiDraftButton';

export type LectureLogPhoto = PortalPhoto;

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

  // photos 변경 시 즉시 저장
  function handlePhotosChange(next: LectureLogPhoto[]) {
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
  const pathPrefix = `${programId}/${curriculum.id}/${staffId}`;

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
          {photos.length > 0 && (
            <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-2">
              {photos.map((p) => (
                <a key={p.path} href={p.url} target="_blank" rel="noopener noreferrer"
                  className="block aspect-square rounded-md overflow-hidden border border-emerald-200">
                  <img src={p.url} alt={p.filename} className="w-full h-full object-cover hover:opacity-80" />
                </a>
              ))}
            </div>
          )}
          {content && <p className="text-sm text-slate-700 whitespace-pre-wrap">{content}</p>}
          <p className="mt-2 text-[10px] text-emerald-700 font-semibold">✓ 제출 완료 — 수정 불가</p>
        </div>
      ) : (
        <>
          {/* 박경수님 2026-05-26 — 사진 우선 배치 (텍스트보다 먼저) */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">
              📷 강의 사진 첨부 <span className="text-[11px] text-slate-400 font-normal ml-1">(촬영·드래그·붙여넣기)</span>
            </label>
            <PortalPhotoUpload
              photos={photos}
              onChange={handlePhotosChange}
              bucket="curriculum-photos"
              pathPrefix={pathPrefix}
              disabled={submitting}
              maxPhotos={10}
            />
          </div>

          <div>
            <div className="flex items-center justify-between mb-1 gap-2 flex-wrap">
              <label className="text-xs font-semibold text-slate-700">
                일지 내용 <span className="text-[11px] text-slate-400 font-normal">(선택)</span>
              </label>
              <div className="inline-flex items-center gap-2">
                {/* STEP-V9-QUICKWIN QW-4 — AI 초안 버튼 */}
                <AiDraftButton
                  edgeFunctionName="curriculum-log-ai"
                  payload={{
                    session_title: curriculum.title,
                    session_no: curriculum.session_no,
                    session_date: curriculum.session_date,
                    photo_count: photos.length,
                  }}
                  onDraftGenerated={(draft) => setContent((prev) => (prev.trim() ? `${prev}\n\n${draft}` : draft))}
                  disabled={submitting}
                />
                {saveStatus === 'saving' && <span className="text-[10px] text-slate-400 inline-flex items-center gap-1"><Loader2 size={10} className="animate-spin" />저장 중…</span>}
                {saveStatus === 'saved' && <span className="text-[10px] text-emerald-600">✓ 저장됨</span>}
                {saveStatus === 'error' && <span className="text-[10px] text-rose-600">⚠ 저장 실패</span>}
              </div>
            </div>
            <textarea value={content} onChange={(e) => setContent(e.target.value)}
              placeholder="강의 진행 내용·특이사항·다음 차시 준비 등 (사진이 충분하면 비워둬도 OK)"
              className="w-full min-h-[100px] rounded-md border border-amber-200 px-3 py-2 text-sm focus:border-violet-400 focus:ring-2 focus:ring-violet-200 outline-none resize-y" />
          </div>

          <div className="flex items-center justify-end gap-1.5 pt-1">
            <button type="button" onClick={onClose} disabled={submitting}
              className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-semibold text-slate-600 hover:bg-slate-100 rounded-md disabled:opacity-50">
              <X size={12} aria-hidden="true" /> 취소
            </button>
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
        </>
      )}
    </div>
  );
}
