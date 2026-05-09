// bal24 v2 — 외부 포털 항목 단일 렌더 (5 type)

import { useState } from 'react';
import type { ChangeEvent, DragEvent } from 'react';
import { Download, Upload, Check, FileIcon, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { ITEM_TYPE_LABELS, PORTAL_FILES_BUCKET } from '../portal/portalConstants';
import type { PortalItem } from '../../types/database';
import ClientAutoDataView from './ClientAutoDataView';

type Props = {
  item: PortalItem;
  projectId: string;
  /** STEP-PM-VIEWER: PM/ADMIN 뷰어 모드 — 업로드·제출·동의 비활성화 */
  readOnly?: boolean;
  /** 완료 후 새로고침 콜백 */
  onCompleted: () => void;
};

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '제출 권한이 없어요. 운영자에게 문의해 주세요.';
  if (m.includes('bucket not found')) return '파일 저장소가 없어요. 운영자에게 문의해 주세요.';
  if (m.includes('payload too large')) return '파일 용량이 너무 커요.';
  return '처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function ClientPortalItem({ item, projectId, readOnly = false, onCompleted }: Props) {
  const [busy, setBusy] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [feedback, setFeedback] = useState('');
  const [dragActive, setDragActive] = useState(false);

  const markCompleted = async () => {
    const { error } = await supabase
      .from('portal_items')
      .update({ completed: true, completed_at: new Date().toISOString() })
      .eq('id', item.id);
    if (error) console.error('[client-portal] 완료 표시 실패:', error.message);
  };

  const insertResponse = async (payload: {
    response_type: 'feedback' | 'file' | 'approval';
    content?: string | null;
    file_url?: string | null;
    file_name?: string | null;
    file_size?: number | null;
  }) => {
    const { error } = await supabase.from('portal_responses').insert({ item_id: item.id, ...payload });
    if (error) throw error;
  };

  const handleFileDownloadClick = async () => {
    if (!item.file_url) return;
    setBusy(true);
    setErrorMsg(null);
    try {
      const marker = `/${PORTAL_FILES_BUCKET}/`;
      const idx = item.file_url.indexOf(marker);
      let openUrl = item.file_url;
      if (idx >= 0) {
        const path = item.file_url.slice(idx + marker.length).split('?')[0];
        const { data, error } = await supabase.storage.from(PORTAL_FILES_BUCKET).createSignedUrl(path, 60);
        if (error || !data) {
          setErrorMsg('파일 열기 권한이 없어요.');
          return;
        }
        openUrl = data.signedUrl;
      }
      window.open(openUrl, '_blank', 'noopener,noreferrer');
      if (!item.completed) {
        await markCompleted();
        onCompleted();
      }
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[client-portal] 다운로드 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setBusy(false);
    }
  };

  const handleUpload = async (file: File) => {
    setBusy(true);
    setErrorMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 60);
      const path = `responses/${item.portal_id}/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage.from(PORTAL_FILES_BUCKET).upload(path, file, {
        upsert: false, contentType: file.type || undefined,
      });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(PORTAL_FILES_BUCKET).getPublicUrl(path);
      await insertResponse({
        response_type: 'file',
        file_url: pub.publicUrl,
        file_name: file.name,
        file_size: file.size,
      });
      await markCompleted();
      onCompleted();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[client-portal] 업로드 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setBusy(false);
    }
  };

  const handleSubmitFeedback = async () => {
    if (!feedback.trim()) { setErrorMsg('내용을 입력해 주세요.'); return; }
    setBusy(true);
    setErrorMsg(null);
    try {
      await insertResponse({ response_type: 'feedback', content: feedback.trim() });
      await markCompleted();
      onCompleted();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[client-portal] 의견 제출 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setBusy(false);
    }
  };

  const handleApproval = async () => {
    setBusy(true);
    setErrorMsg(null);
    try {
      await insertResponse({ response_type: 'approval', content: item.approval_text ?? '동의함' });
      await markCompleted();
      onCompleted();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[client-portal] 동의 처리 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setBusy(false);
    }
  };

  const onDragOver = (e: DragEvent<HTMLDivElement>) => { e.preventDefault(); setDragActive(true); };
  const onDragLeave = (e: DragEvent<HTMLDivElement>) => { if (e.currentTarget === e.target) setDragActive(false); };
  const onDrop = (e: DragEvent<HTMLDivElement>) => {
    e.preventDefault(); setDragActive(false);
    const f = e.dataTransfer?.files?.[0];
    if (f && !busy) void handleUpload(f);
  };
  const onPick = (e: ChangeEvent<HTMLInputElement>) => {
    const f = e.target.files?.[0];
    if (f) void handleUpload(f);
    e.target.value = '';
  };

  return (
    <article className="rounded-xl border border-slate-200 bg-white p-4 space-y-3">
      <div className="flex items-start justify-between gap-2">
        <div className="min-w-0">
          <div className="flex items-center gap-2 flex-wrap">
            <h3 className="text-sm font-bold text-text">{item.label}</h3>
            {item.required && <span className="text-[10px] text-danger font-semibold">필수</span>}
          </div>
          <div className="text-[10px] text-muted">{ITEM_TYPE_LABELS[item.item_type]}</div>
        </div>
        {item.completed && (
          <span className="inline-flex items-center gap-1 text-xs font-semibold text-success">
            <Check size={12} />완료
          </span>
        )}
      </div>
      {item.description && <p className="text-xs text-muted whitespace-pre-wrap">{item.description}</p>}

      {item.item_type === 'file_download' && item.file_url && (
        <button type="button" onClick={() => void handleFileDownloadClick()} disabled={busy}
          className="inline-flex items-center gap-1.5 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50">
          {busy ? <Loader2 size={14} className="animate-spin" /> : <Download size={14} />}
          {item.file_name ?? '파일 다운로드'}
        </button>
      )}

      {item.item_type === 'file_upload' && (
        <div onDragOver={onDragOver} onDragEnter={onDragOver} onDragLeave={readOnly ? undefined : onDragLeave} onDrop={readOnly ? undefined : onDrop}
          className={['rounded-xl border-2 border-dashed p-4 text-center transition-colors',
            dragActive ? 'border-primary bg-primary/5' : 'border-slate-200 bg-slate-50/40',
            busy || readOnly ? 'opacity-60' : ''].join(' ')}>
          <Upload size={20} className="mx-auto text-slate-400 mb-1" />
          <p className="text-xs text-text">파일을 끌어다 놓거나 버튼을 눌러 선택해 주세요.</p>
          <label className={[
            'inline-flex mt-2 items-center gap-1 px-3 py-1 rounded-lg text-xs font-semibold bg-white border border-slate-200',
            readOnly ? 'opacity-40 cursor-not-allowed' : 'cursor-pointer hover:bg-slate-50',
          ].join(' ')}>
            <FileIcon size={12} />
            파일 선택
            <input type="file" hidden onChange={onPick} disabled={busy || readOnly} />
          </label>
          {busy && <p className="text-xs text-primary mt-2 inline-flex items-center gap-1"><Loader2 size={11} className="animate-spin" />업로드 중…</p>}
        </div>
      )}

      {item.item_type === 'feedback' && !item.completed && (
        <div className="space-y-2">
          <textarea rows={3} value={feedback} onChange={(e) => setFeedback(e.target.value)} disabled={busy || readOnly}
            placeholder="의견을 적어 주세요."
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none" />
          <button type="button" onClick={() => void handleSubmitFeedback()} disabled={busy || readOnly}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
            {busy ? <Loader2 size={14} className="animate-spin" /> : null}
            제출
          </button>
        </div>
      )}

      {item.item_type === 'approval' && !item.completed && (
        <div className="space-y-2 rounded-lg bg-slate-50 p-3">
          <p className="text-sm text-text">{item.approval_text ?? '본 내용에 동의합니다.'}</p>
          <button type="button" onClick={() => void handleApproval()} disabled={busy || readOnly}
            className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-primary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
            <Check size={14} />동의합니다
          </button>
        </div>
      )}

      {item.item_type === 'tax_invoice' && !item.completed && (
        <button type="button" onClick={() => void handleApproval()} disabled={busy || readOnly}
          className="inline-flex items-center gap-1 px-4 py-2 rounded-xl bg-secondary text-white text-sm font-semibold hover:opacity-90 disabled:opacity-50 disabled:cursor-not-allowed">
          {busy ? <Loader2 size={14} className="animate-spin" /> : null}
          세금계산서 발행 요청하기
        </button>
      )}

      {item.item_type === 'auto_data' && item.auto_data_key && (
        <div className="rounded-lg border border-slate-200 bg-white p-3">
          <ClientAutoDataView projectId={projectId} dataKey={item.auto_data_key} />
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-lg bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">{errorMsg}</div>
      )}
    </article>
  );
}
