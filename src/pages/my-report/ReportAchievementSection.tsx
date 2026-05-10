// bal24 v2 — STEP-MEMBER-REPORT-PORTAL § 4+5 사업성과 서술 + 홍보사진 첨부

import { useEffect, useRef, useState } from 'react';
import type { ChangeEvent } from 'react';
import { Save, Upload, X, Loader2, ExternalLink } from 'lucide-react';
import { Button } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import {
  uploadFile, STORAGE_BUCKETS, STORAGE_PATHS, getFileExtension, safeFileBase,
} from '../../lib/storageUtils';
import type { PerformanceReport } from '../../types/performanceReport';

interface Props {
  report: PerformanceReport;
  readOnly: boolean;
  saving: boolean;
  onSave: (fields: Partial<PerformanceReport>) => Promise<boolean>;
}

const MAX_PHOTOS = 10;

export default function ReportAchievementSection({ report, readOnly, saving, onSave }: Props) {
  const toast = useToast();
  const fileRef = useRef<HTMLInputElement>(null);
  const [businessSummary, setBusinessSummary] = useState('');
  const [salesMethod, setSalesMethod] = useState('');
  const [achievementNotes, setAchievementNotes] = useState('');
  const [photos, setPhotos] = useState<string[]>([]);
  const [uploading, setUploading] = useState(false);

  useEffect(() => {
    setBusinessSummary(report.business_summary ?? '');
    setSalesMethod(report.sales_method ?? '');
    setAchievementNotes(report.achievement_notes ?? '');
    setPhotos(report.photo_urls ?? []);
  }, [report]);

  const handleSaveText = () => {
    void onSave({
      business_summary: businessSummary.trim() || null,
      sales_method: salesMethod.trim() || null,
      achievement_notes: achievementNotes.trim() || null,
    });
  };

  const handleUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files ?? []);
    if (fileRef.current) fileRef.current.value = '';
    if (files.length === 0) return;
    if (photos.length + files.length > MAX_PHOTOS) {
      toast.error(`사진은 최대 ${MAX_PHOTOS}장까지 첨부 가능해요.`);
      return;
    }
    setUploading(true);
    try {
      const newUrls: string[] = [];
      for (const f of files) {
        const ext = getFileExtension(f);
        const fileName = `${Date.now()}_${safeFileBase(f.name)}.${ext}`;
        try {
          const result = await uploadFile(
            STORAGE_BUCKETS.REPORT_ATTACHMENTS,
            STORAGE_PATHS.reportAttachment(report.id, 'photos', fileName),
            f,
          );
          newUrls.push(result.url);
        } catch (err) {
          console.error('[my-report] 사진 업로드 실패:', err instanceof Error ? err.message : '');
          toast.error(`'${f.name}' 업로드에 실패했어요.`);
        }
      }
      if (newUrls.length > 0) {
        const updated = [...photos, ...newUrls];
        setPhotos(updated);
        await onSave({ photo_urls: updated });
      }
    } finally {
      setUploading(false);
    }
  };

  const handleRemove = async (idx: number) => {
    const updated = photos.filter((_, i) => i !== idx);
    setPhotos(updated);
    await onSave({ photo_urls: updated.length > 0 ? updated : null });
  };

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#1E1B4B]">④ 사업성과 서술 / ⑤ 홍보사진</h2>
        {!readOnly && (
          <Button variant="outline" size="sm" leftIcon={<Save size={12} />} onClick={handleSaveText} loading={saving}>
            텍스트 저장
          </Button>
        )}
      </header>

      <div className="space-y-3">
        <TextArea label="사업 목적/개요" value={businessSummary} onChange={setBusinessSummary} disabled={readOnly} rows={4}
          placeholder="사업의 목적, 핵심 내용, 진행 방식 등을 적어 주세요." />
        <TextArea label="판매·홍보 방법" value={salesMethod} onChange={setSalesMethod} disabled={readOnly} rows={3}
          placeholder="판매 채널, 홍보 매체, 타겟 고객 등을 적어 주세요." />
        <TextArea label="사업성과 서술" value={achievementNotes} onChange={setAchievementNotes} disabled={readOnly} rows={4}
          placeholder="달성한 정성·정량 성과, 의미 있는 변화, 향후 계획 등을 적어 주세요." />
      </div>

      {/* 사진 첨부 */}
      <div className="space-y-2 pt-2 border-t border-slate-100">
        <label className="text-sm font-bold text-[#1E1B4B]">
          홍보사진 ({photos.length}/{MAX_PHOTOS})
        </label>
        <div className="flex flex-wrap gap-2">
          {photos.map((url, idx) => (
            <div key={idx} className="relative w-24 h-24 rounded-lg overflow-hidden border border-slate-200">
              <img src={url} alt={`사진 ${idx + 1}`} className="w-full h-full object-cover" />
              {!readOnly && (
                <button type="button" onClick={() => void handleRemove(idx)}
                  className="absolute top-0.5 right-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-black/60 text-white hover:bg-black/80"
                  aria-label={`사진 ${idx + 1} 삭제`}>
                  <X size={10} />
                </button>
              )}
              <a href={url} target="_blank" rel="noreferrer" className="absolute bottom-0.5 left-0.5 inline-flex items-center justify-center w-5 h-5 rounded-full bg-white/80 text-violet-700 hover:bg-white" aria-label="원본 보기">
                <ExternalLink size={10} />
              </a>
            </div>
          ))}
          {!readOnly && photos.length < MAX_PHOTOS && (
            <button type="button" onClick={() => fileRef.current?.click()} disabled={uploading}
              className="inline-flex items-center justify-center w-24 h-24 rounded-lg border-2 border-dashed border-violet-200 bg-violet-50/40 text-violet-500 hover:bg-violet-100 disabled:opacity-50">
              {uploading ? <Loader2 size={18} className="animate-spin" /> : <Upload size={18} />}
            </button>
          )}
          <input ref={fileRef} type="file" accept="image/*" multiple hidden onChange={(e) => void handleUpload(e)} />
        </div>
        <p className="text-[11px] text-slate-400">최대 {MAX_PHOTOS}장 · 5MB 이하 이미지 (jpg/png/webp/gif)</p>
      </div>
    </section>
  );
}

interface TAProps { label: string; value: string; onChange: (v: string) => void; disabled: boolean; rows: number; placeholder?: string }
function TextArea({ label, value, onChange, disabled, rows, placeholder }: TAProps) {
  return (
    <div className="space-y-1">
      <label className="text-xs font-semibold text-slate-700">{label}</label>
      <textarea value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} rows={rows} placeholder={placeholder}
        className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-y leading-relaxed" />
    </div>
  );
}
