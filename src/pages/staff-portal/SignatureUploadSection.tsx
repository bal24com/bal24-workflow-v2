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
      {/* 박경수님 2026-05-26 — 좌우 반반 레이아웃 (새 파일 등록 / 현재 등록된 서명) */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 좌측 — 새 파일 등록 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">새 파일 등록</p>
          <label className="flex flex-col items-center justify-center h-32 border-2 border-dashed border-violet-300 rounded-xl bg-violet-50 cursor-pointer hover:border-violet-500 hover:bg-violet-100 transition-colors">
            <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} disabled={uploading} />
            <span className="text-2xl mb-1" aria-hidden="true">🖊️</span>
            <span className="text-xs font-semibold text-violet-700">PNG / JPG 파일 선택</span>
            <span className="text-[11px] text-slate-400 mt-0.5">최대 2MB · 흰 배경 권장</span>
          </label>
          {preview && (
            <div className="mt-2 flex items-center gap-2">
              <img src={preview} alt="미리보기" className="h-10 max-w-[120px] object-contain border border-slate-200 rounded p-1" />
              <button type="button" onClick={() => void handleUpload()} disabled={uploading}
                className="inline-flex items-center gap-1 px-3 py-1.5 text-[11px] font-bold text-white bg-violet-600 rounded-md hover:bg-violet-700 disabled:opacity-50">
                {uploading ? <Loader2 size={11} className="animate-spin" /> : <Save size={11} />}
                저장
              </button>
            </div>
          )}
        </div>

        {/* 우측 — 현재 등록된 서명 */}
        <div>
          <p className="text-xs font-semibold text-slate-500 mb-1.5">현재 등록된 서명</p>
          {currentUrl ? (
            <div className="h-32 border border-slate-200 rounded-xl flex flex-col items-center justify-center bg-white relative">
              <img src={currentUrl} alt="등록된 서명" className="max-h-20 max-w-full object-contain" />
              <button type="button" onClick={() => void handleDelete()}
                className="mt-2 text-xs text-rose-600 hover:bg-rose-50 px-2 py-0.5 rounded">
                삭제
              </button>
            </div>
          ) : (
            <div className="h-32 border border-dashed border-slate-200 rounded-xl flex items-center justify-center text-xs text-slate-400">
              등록된 서명 없음
            </div>
          )}
        </div>
      </div>
      {!currentUrl && (
        <p className="text-[11px] text-slate-500 mt-2">
          💡 도장/서명을 등록하면 멘토링 일지 PDF 출력 시 자동 적용돼요.
        </p>
      )}
    </section>
  );
}
