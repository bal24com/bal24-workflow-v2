// bal24 v2 — STEP-MENTORING-P3-APPROVE / 2026-05-26 박경수님
// 도장·사인 등록 컴포넌트 (staff_pool 강사 전용).
// StaffInfoEditModal 과 StaffMentoringTab 양쪽에서 재사용.

import { useEffect, useState } from 'react';
import { Loader2, Save } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';

interface Props {
  staffId: string;
  /** 카드 외곽선·배경을 외부에서 통제하고 싶을 때 표시. 기본 true. */
  showBorder?: boolean;
  /** 상단 헤더(아이콘·제목) 표시 여부. 기본 true. */
  showHeader?: boolean;
}

export default function SignatureUploadSection({ staffId, showBorder = true, showHeader = true }: Props) {
  const toast = useToast();
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('staff_pool').select('signature_url').eq('id', staffId).maybeSingle();
      if (!cancelled) {
        setCurrentUrl((data?.signature_url as string | null) ?? null);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [staffId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error('파일 크기는 2MB 이하여야 해요.'); return; }
    if (!['image/png', 'image/jpeg'].includes(f.type)) { toast.error('PNG 또는 JPG 파일만 업로드할 수 있어요.'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${staffId}/signature_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('signatures')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      console.error('[signature] 업로드 실패:', upErr.message);
      toast.error('서명 업로드에 실패했어요. signatures 버킷 정책을 확인해 주세요.');
      return;
    }
    const { data: pub } = supabase.storage.from('signatures').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('staff_pool')
      .update({ signature_url: pub.publicUrl, updated_at: new Date().toISOString() }).eq('id', staffId);
    setUploading(false);
    if (dbErr) {
      console.error('[signature] DB 저장 실패:', dbErr.message);
      toast.error('업로드는 됐지만 기록 저장에 실패했어요.');
      return;
    }
    setCurrentUrl(pub.publicUrl);
    setFile(null); setPreview(null);
    toast.success('서명이 저장됐어요. 다음 PDF 출력부터 자동 적용돼요.');
  }

  async function handleDelete() {
    if (!currentUrl) return;
    if (!window.confirm('등록된 서명을 삭제할까요?')) return;
    const { error } = await supabase.from('staff_pool')
      .update({ signature_url: null, updated_at: new Date().toISOString() }).eq('id', staffId);
    if (error) { console.error('[signature] 삭제 실패:', error.message); toast.error('삭제에 실패했어요.'); return; }
    setCurrentUrl(null);
    toast.success('서명을 삭제했어요.');
  }

  if (!loaded) return null;

  const wrapClass = showBorder
    ? 'rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)] p-5'
    : '';

  return (
    <section className={wrapClass}>
      {showHeader && (
        <h3 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
          <Save size={16} className="text-violet-500" aria-hidden="true" /> 도장 / 사인 등록
          {!currentUrl && (
            <span className="ml-1 text-[10px] font-bold text-amber-700 bg-amber-50 border border-amber-200 rounded-full px-2 py-0.5">미등록</span>
          )}
          {currentUrl && (
            <span className="ml-1 text-[10px] font-bold text-emerald-700 bg-emerald-50 border border-emerald-200 rounded-full px-2 py-0.5">등록됨</span>
          )}
        </h3>
      )}
      {currentUrl ? (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1.5">현재 등록된 서명</p>
          <div className="flex items-center gap-3">
            <img src={currentUrl} alt="등록된 서명" className="h-16 max-w-[200px] object-contain border border-slate-200 rounded-lg p-1 bg-white" />
            <button type="button" onClick={() => void handleDelete()}
              className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded">
              삭제
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-500 mb-3">
          아직 등록된 서명이 없어요. 등록해 두면 멘토링 일지 PDF 출력 시 자동으로 들어가요.
        </p>
      )}
      <label className="block border-2 border-dashed border-violet-300 rounded-xl p-4 text-center cursor-pointer hover:border-violet-500 transition-colors">
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} disabled={uploading} />
        <div className="text-2xl mb-1">🖊️</div>
        <p className="text-xs font-semibold text-violet-700">PNG 또는 JPG 파일 선택</p>
        <p className="text-[11px] text-slate-400 mt-1">최대 2MB · 흰 배경 권장</p>
      </label>
      {preview && (
        <div className="mt-3 flex items-center gap-3">
          <img src={preview} alt="미리보기" className="h-12 max-w-[160px] object-contain border border-slate-200 rounded p-1" />
          <button type="button" onClick={() => void handleUpload()} disabled={uploading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-violet-600 rounded-[10px] hover:bg-violet-700 disabled:opacity-50">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            서명 저장
          </button>
        </div>
      )}
    </section>
  );
}
