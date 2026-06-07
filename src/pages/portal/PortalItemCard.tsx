// 박경수님 2026-06-07 STEP-PORTAL-BENEFICIARY-ENHANCE — 포털 아이템 카드 컴포넌트 분리.
// 파일 다운로드, 업로드, 동의, 의견 입력 등 개별 항목 처리.

import { useState } from 'react';
import { 
  Loader2, CheckCircle2, FileText, Download, ShieldCheck, MessageSquare 
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ITEM_TYPE_LABEL } from './portalUtils';
import { FileDropZone } from '../../components/ui';
import { PORTAL_FILES_BUCKET } from './portalConstants';

export interface PortalItemRow {
  id: string;
  item_type: string;
  title: string | null;
  label: string | null;
  description: string | null;
  file_url: string | null;
  file_name: string | null;
  actionable_roles: string[] | null;
}

export interface PortalResponseRow {
  id: string;
  item_id: string;
  content: string | null;
  file_url: string | null;
  is_approved: boolean | null;
  submitted_at: string;
}

interface BeneficiaryOrg {
  id: string;
  org_name: string;
}

interface Props {
  item: PortalItemRow; 
  org: BeneficiaryOrg;
  responses: PortalResponseRow[]; 
  onSaved: (r: PortalResponseRow) => void;
}

export default function PortalItemCard({ 
  item, org, responses, onSaved 
}: Props) {
  const [submitting, setSubmitting] = useState(false);
  const title = item.title ?? item.label ?? '(제목 없음)';
  const completed = responses.length > 0;

  async function submitAction(payload: Partial<PortalResponseRow>) {
    setSubmitting(true);
    // respondent_id 는 수혜기관 ID 로 고정
    const { data, error } = await supabase
      .from('portal_responses')
      .insert({
        item_id: item.id,
        portal_role: 'beneficiary_org',
        respondent_id: org.id,
        response_type: payload.is_approved != null ? 'approval' : (payload.file_url ? 'file' : 'feedback'),
        ...payload,
      })
      .select('*')
      .single();
    setSubmitting(false);
    if (error) {
      alert('제출 중 오류가 발생했어요.');
      return;
    }
    if (data) onSaved(data as PortalResponseRow);
  }

  const handleFileUpload = async (file: File) => {
    setSubmitting(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const path = `portal-responses/${org.id}/${Date.now()}_${Math.random().toString(36).slice(2)}.${ext}`;
      
      const { error: upErr } = await supabase.storage
        .from(PORTAL_FILES_BUCKET)
        .upload(path, file);
      
      if (upErr) throw upErr;
      
      const { data: { publicUrl } } = supabase.storage
        .from(PORTAL_FILES_BUCKET)
        .getPublicUrl(path);

      await submitAction({ file_url: publicUrl, content: file.name });
    } catch (err) {
      console.error('File upload failed:', err);
      alert('파일 업로드에 실패했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <li className="bg-white rounded-2xl border border-violet-100 p-5 space-y-4 hover:border-violet-300 transition-colors shadow-sm">
      <div className="flex items-start justify-between gap-4">
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-1.5 mb-1.5">
            <span className="text-[10px] font-black px-1.5 py-0.5 rounded bg-slate-100 text-slate-500 uppercase tracking-tighter">
              {ITEM_TYPE_LABEL[item.item_type] || item.item_type}
            </span>
            {completed && (
              <span className="inline-flex items-center gap-0.5 text-[10px] font-bold text-emerald-600">
                <CheckCircle2 size={12} /> 완료됨
              </span>
            )}
          </div>
          <h4 className="text-sm font-black text-[#1E1B4B]">{title}</h4>
          {item.description && <p className="text-xs text-slate-500 mt-1 leading-relaxed">{item.description}</p>}
        </div>
      </div>

      <div className="pt-2">
        {item.item_type === 'file_download' && item.file_url && (
          <a href={item.file_url} target="_blank" rel="noopener noreferrer"
            onClick={() => !completed && void submitAction({ content: '다운로드' })}
            className="w-full h-10 rounded-xl bg-slate-50 border border-slate-100 flex items-center justify-between px-4 text-xs font-bold text-violet-700 hover:bg-violet-50 transition-colors">
            <span className="flex items-center gap-2 truncate pr-4 text-slate-600">
              <FileText size={14} className="text-slate-400" />
              {item.file_name || '안내 파일 다운로드'}
            </span>
            <Download size={14} />
          </a>
        )}

        {item.item_type === 'file_upload' && (
          <div className="space-y-2">
            <FileDropZone
              uploading={submitting}
              onFileSelected={handleFileUpload}
              fileUrl={responses[0]?.file_url ?? null}
              fileName={responses[0]?.content ?? null}
              disabled={submitting}
              onClear={() => {}} // 기존 응답 삭제 로직은 복잡하므로 일단 비워둠
            />
          </div>
        )}

        {item.item_type === 'approval' && (
          <button type="button" onClick={() => void submitAction({ is_approved: true, content: '동의' })}
            disabled={submitting || completed}
            className={`w-full h-10 rounded-xl flex items-center justify-center gap-2 text-xs font-bold transition-all ${
              completed ? 'bg-emerald-50 text-emerald-700' : 'bg-violet-600 text-white shadow-lg shadow-violet-100'
            }`}>
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <ShieldCheck size={14} />}
            {completed ? '동의 완료됨' : '내용을 확인하고 동의합니다'}
          </button>
        )}

        {item.item_type === 'feedback' && (
          <FeedbackAction 
            completed={completed} 
            submitting={submitting} 
            lastResponse={responses[0]?.content}
            onSubmit={(txt) => submitAction({ content: txt })} 
          />
        )}
      </div>
    </li>
  );
}

function FeedbackAction({ 
  completed, submitting, lastResponse, onSubmit 
}: { 
  completed: boolean; 
  submitting: boolean; 
  lastResponse?: string | null;
  onSubmit: (txt: string) => void 
}) {
  const [text, setText] = useState('');
  return (
    <div className="space-y-2">
      {completed ? (
        <div className="p-3 bg-slate-50 rounded-xl border border-slate-100 text-xs text-slate-600">
          <p className="font-bold mb-1 text-slate-400">나의 의견:</p>
          {lastResponse}
        </div>
      ) : (
        <>
          <textarea 
            value={text} onChange={(e) => setText(e.target.value)} rows={3}
            disabled={submitting}
            placeholder="의견을 입력해 주세요."
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm outline-none focus:border-violet-500 disabled:bg-slate-50" 
          />
          <button type="button"
            onClick={() => text.trim() && onSubmit(text.trim())}
            disabled={submitting || !text.trim()}
            className="w-full h-10 rounded-xl bg-violet-600 text-white text-xs font-bold flex items-center justify-center gap-2">
            {submitting ? <Loader2 size={14} className="animate-spin" /> : <MessageSquare size={14} />}
            의견 제출하기
          </button>
        </>
      )}
    </div>
  );
}
