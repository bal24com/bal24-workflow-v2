// bal24 v2 — 결과보고서 섹션 편집 모달 (텍스트 + 사진 첨부)

import { useCallback, useEffect, useRef, useState } from 'react';
import { Loader2, Upload, Trash2 } from 'lucide-react';
import { Modal, Button } from '../../../../components/ui';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { sanitizeFileName } from '../../../../components/files/sharedFilesUtils';
import type { FinalReportSection, FinalReportPhoto } from '../../../../types/database';

interface Props {
  section: FinalReportSection;
  onClose: () => void;
  onSaved: () => void;
}

const BUCKET = 'project-docs';

export default function FinalReportItemEditor({ section, onClose, onSaved }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(section.title);
  const [content, setContent] = useState(section.content ?? '');
  const [photos, setPhotos] = useState<FinalReportPhoto[]>([]);
  const [thumbUrls, setThumbUrls] = useState<Record<string, string>>({});
  const [uploading, setUploading] = useState(false);
  const [saving, setSaving] = useState(false);
  const photoRef = useRef<HTMLInputElement | null>(null);

  const reload = useCallback(async () => {
    const { data, error } = await supabase
      .from('final_report_photos').select('*').eq('section_id', section.id).order('display_order');
    if (error) console.error('[final-report-editor] 사진 조회 실패:', error.message);
    setPhotos((data ?? []) as FinalReportPhoto[]);
  }, [section.id]);

  useEffect(() => {
    let cancelled = false;
    void (async () => { await reload(); if (cancelled) return; })();
    return () => { cancelled = true; };
  }, [reload]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const next: Record<string, string> = { ...thumbUrls };
      for (const p of photos) {
        if (!next[p.id]) {
          const { data } = await supabase.storage.from(BUCKET).createSignedUrl(p.file_url, 3600);
          if (data?.signedUrl) next[p.id] = data.signedUrl;
        }
      }
      if (!cancelled) setThumbUrls(next);
    })();
    return () => { cancelled = true; };
  }, [photos, thumbUrls]);

  async function handlePhotoUpload(files: FileList | null) {
    if (!files || files.length === 0) return;
    setUploading(true);
    try {
      for (let i = 0; i < files.length; i += 1) {
        const f = files[i];
        const safe = sanitizeFileName(f.name);
        const path = `${section.project_id}/report/${section.id}/${Date.now()}_${safe}`;
        const up = await supabase.storage.from(BUCKET).upload(path, f, {
          upsert: false, contentType: f.type || undefined,
        });
        if (up.error) throw up.error;
        const { error } = await supabase.from('final_report_photos').insert({
          section_id: section.id,
          file_url: path,
          caption: null,
          display_order: photos.length + i,
        });
        if (error) throw error;
      }
      await reload();
      toast.success(`${files.length}장 업로드 완료.`);
    } catch (err) {
      const r = err instanceof Error ? err.message : '';
      console.error('[final-report-editor] 사진 업로드 실패:', r);
      toast.error('사진 업로드에 실패했어요.');
    } finally {
      setUploading(false);
    }
  }

  async function handlePhotoCaption(p: FinalReportPhoto, caption: string) {
    const { error } = await supabase.from('final_report_photos').update({ caption }).eq('id', p.id);
    if (error) { toast.error('설명 저장 실패.'); return; }
    setPhotos((prev) => prev.map((x) => (x.id === p.id ? { ...x, caption } : x)));
  }

  async function handlePhotoDelete(p: FinalReportPhoto) {
    if (!window.confirm('이 사진을 삭제할까요?')) return;
    const { error } = await supabase.from('final_report_photos').delete().eq('id', p.id);
    if (error) { toast.error('삭제 실패.'); return; }
    await supabase.storage.from(BUCKET).remove([p.file_url]).catch(() => undefined);
    await reload();
  }

  async function handleSave() {
    if (!title.trim()) { toast.error('제목을 입력해 주세요.'); return; }
    setSaving(true);
    try {
      const { error } = await supabase.from('final_report_sections').update({
        title: title.trim(),
        content: content.trim() || null,
        updated_at: new Date().toISOString(),
      }).eq('id', section.id);
      if (error) throw error;
      toast.success('저장됐어요.');
      onSaved();
    } catch (err) {
      const r = err instanceof Error ? err.message : '';
      console.error('[final-report-editor] 저장 실패:', r);
      toast.error('저장에 실패했어요.');
    } finally {
      setSaving(false);
    }
  }

  const showText = section.section_type === 'text';
  const showPhotos = section.section_type === 'text' || section.section_type === 'photo_gallery';

  return (
    <Modal open={true} onClose={onClose} title="섹션 편집" size="lg" closeOnBackdrop={!saving && !uploading}
      footer={
        <div className="flex items-center justify-end gap-2 w-full">
          <Button variant="outline" onClick={onClose} disabled={saving || uploading}>취소</Button>
          <Button variant="primary" loading={saving} onClick={() => void handleSave()}>저장하기</Button>
        </div>
      }>
      <div className="space-y-4">
        <div className="space-y-1.5">
          <label className="text-xs font-bold text-slate-600">제목</label>
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)} disabled={saving}
            className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-violet-400" />
        </div>

        {showText && (
          <div className="space-y-1.5">
            <label className="text-xs font-bold text-slate-600">내용</label>
            <textarea rows={8} value={content} onChange={(e) => setContent(e.target.value)} disabled={saving}
              placeholder="이 섹션의 본문을 입력해 주세요."
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-2 text-sm focus:outline-none focus:border-violet-400 resize-none" />
          </div>
        )}

        {showPhotos && (
          <section className="space-y-2">
            <div className="flex items-center justify-between">
              <h4 className="text-xs font-bold text-slate-600">사진 ({photos.length})</h4>
              <input ref={photoRef} type="file" multiple accept="image/*" hidden
                onChange={(e) => { void handlePhotoUpload(e.target.files); e.target.value = ''; }} />
              <Button variant="outline" size="sm" leftIcon={uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
                onClick={() => photoRef.current?.click()} disabled={uploading}>
                {uploading ? '업로드 중…' : '사진 추가'}
              </Button>
            </div>
            {photos.length === 0 ? (
              <p className="text-[11px] text-slate-400 italic text-center py-3">사진이 없어요. [사진 추가]로 등록하세요.</p>
            ) : (
              <ul className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {photos.map((p) => (
                  <li key={p.id} className="rounded-lg border border-slate-200 bg-slate-50 overflow-hidden">
                    <div className="aspect-square bg-slate-100 relative">
                      {thumbUrls[p.id] ? (
                        <img src={thumbUrls[p.id]} alt={p.caption ?? ''} className="w-full h-full object-cover" />
                      ) : (
                        <div className="w-full h-full flex items-center justify-center"><Loader2 size={14} className="animate-spin text-slate-400" /></div>
                      )}
                      <button type="button" onClick={() => void handlePhotoDelete(p)} aria-label="삭제"
                        className="absolute top-1 right-1 p-1 rounded bg-black/40 text-white hover:bg-black/60">
                        <Trash2 size={11} aria-hidden="true" />
                      </button>
                    </div>
                    <input type="text" defaultValue={p.caption ?? ''}
                      onBlur={(e) => { if (e.target.value !== (p.caption ?? '')) void handlePhotoCaption(p, e.target.value); }}
                      placeholder="설명 (선택)"
                      className="w-full px-2 py-1.5 text-[11px] border-t border-slate-200 focus:outline-none focus:bg-white" />
                  </li>
                ))}
              </ul>
            )}
          </section>
        )}
      </div>
    </Modal>
  );
}
