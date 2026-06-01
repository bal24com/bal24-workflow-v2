// 박경수님 2026-05-30 STEP-PORTAL-EXTERNAL-SHARE — 외부 공유 안내 입력 섹션.
// 수혜기관에게 보여줄 사업 소개·일정. project_portals.intro_title/intro_content 저장.

import { useState } from 'react';
import { Save, Eye, EyeOff, Loader2 } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';

interface Props {
  portalId: string;
  introTitle: string;
  introContent: string;
  onSaved: () => void;
}

export default function PortalIntroSection({ portalId, introTitle, introContent, onSaved }: Props) {
  const toast = useToast();
  const [title, setTitle] = useState(introTitle);
  const [content, setContent] = useState(introContent);
  const [saving, setSaving] = useState(false);
  const [preview, setPreview] = useState(false);

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('project_portals')
      .update({ intro_title: title.trim() || null, intro_content: content.trim() || null })
      .eq('id', portalId);
    setSaving(false);
    if (error) {
      console.error('[PortalIntroSection] 저장 실패:', error.message);
      toast.error('안내 저장에 실패했어요.');
      return;
    }
    toast.success('안내 내용을 저장했어요.');
    onSaved();
  }

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-[#1E1B4B]">📢 수혜기관 안내</h3>
        <button type="button" onClick={() => setPreview((p) => !p)}
          className="inline-flex items-center gap-1 text-xs text-violet-700 hover:underline">
          {preview ? <><EyeOff size={12} /> 편집</> : <><Eye size={12} /> 미리보기</>}
        </button>
      </div>

      {preview ? (
        <div className="rounded-xl border border-violet-100 bg-violet-50/30 p-4 space-y-2">
          <p className="text-[10px] text-slate-500 italic">수혜기관 화면에 이렇게 보여요.</p>
          <h4 className="text-base font-bold text-[#1E1B4B]">{title || '(제목 없음)'}</h4>
          <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">
            {content || '(안내 내용 없음)'}
          </p>
        </div>
      ) : (
        <div className="space-y-2">
          <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
            placeholder="제목 — 예) 2026년 해양 창업 지원사업 안내"
            className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
          <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={5}
            placeholder="사업 소개·진행 일정·문의처 등 수혜기관에 안내할 내용"
            className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500" />
          <div className="flex justify-end">
            <button type="button" onClick={() => void handleSave()} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 h-9 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} aria-hidden="true" />}
              저장
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
