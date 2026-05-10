// bal24 v2 — 영수증 동적 추가 섹션
// ExpenseFormModal에서 사용. 등록 시 부모가 expense INSERT 후 받은 id로
// 이 섹션이 모은 영수증들을 일괄 INSERT.

import { useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Button, FileDropZone, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { RECEIPT_TYPE_VALUES } from '../../utils/accounting';
import type { ReceiptType } from '../../types/database';

const STORAGE_BUCKET = 'expense-files';

export type ReceiptDraft = {
  uid: string;
  fileUrl: string | null;
  fileName: string | null;
  fileSize: number | null;
  receiptType: ReceiptType;
  amount: string;
  description: string;
};

export function makeReceipt(): ReceiptDraft {
  return {
    uid: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID()
      : `${Date.now()}_${Math.random()}`,
    fileUrl: null,
    fileName: null,
    fileSize: null,
    receiptType: '영수증',
    amount: '',
    description: '',
  };
}

function translateUploadError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('bucket not found')) return `파일 저장소(${STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`;
  if (m.includes('payload too large')) return '파일 용량이 너무 커요.';
  if (m.includes('row-level security')) return '파일을 올릴 권한이 없어요.';
  return '파일 업로드 중 오류가 발생했어요.';
}

type Props = {
  receipts: ReceiptDraft[];
  onChange: (next: ReceiptDraft[]) => void;
  disabled?: boolean;
};

export default function ExpenseReceiptsSection({ receipts, onChange, disabled }: Props) {
  const [uploadingUid, setUploadingUid] = useState<string | null>(null);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const update = (uid: string, patch: Partial<ReceiptDraft>) => {
    onChange(receipts.map((r) => (r.uid === uid ? { ...r, ...patch } : r)));
  };

  const add = () => onChange([...receipts, makeReceipt()]);
  const remove = (uid: string) => onChange(receipts.filter((r) => r.uid !== uid));

  const upload = async (uid: string, file: File) => {
    setUploadingUid(uid);
    setErrorMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 60);
      const path = `receipts/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      update(uid, { fileUrl: pub.publicUrl, fileName: file.name, fileSize: file.size });
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[expenses] 영수증 업로드 실패:', raw);
      setErrorMsg(translateUploadError(raw));
    } finally {
      setUploadingUid(null);
    }
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">영수증 ({receipts.filter((r) => r.fileUrl).length})</h3>
        <Button type="button" variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={add} disabled={disabled}>영수증 추가</Button>
      </div>

      {receipts.length === 0 ? (
        <p className="text-xs text-muted">영수증이 있으면 여기에 첨부하세요. 등록 후에도 추가 가능해요.</p>
      ) : (
        <div className="space-y-3">
          {receipts.map((r, idx) => (
            <div key={r.uid} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-3">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">영수증 #{idx + 1}</span>
                <button
                  type="button"
                  onClick={() => remove(r.uid)}
                  disabled={disabled}
                  className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5"
                  aria-label={`영수증 #${idx + 1} 삭제`}
                >
                  <Trash2 size={14} />
                </button>
              </div>

              <FileDropZone
                fileUrl={r.fileUrl}
                fileName={r.fileName}
                uploading={uploadingUid === r.uid}
                onFileSelected={(f) => void upload(r.uid, f)}
                onClear={() => update(r.uid, { fileUrl: null, fileName: null, fileSize: null })}
                disabled={disabled}
                enablePaste={false}
                accept="image/*,application/pdf"
              />

              <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">유형</label>
                  <select
                    value={r.receiptType}
                    onChange={(e) => update(r.uid, { receiptType: e.target.value as ReceiptType })}
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                  >
                    {RECEIPT_TYPE_VALUES.map((t) => (<option key={t} value={t}>{t}</option>))}
                  </select>
                </div>
                <Input label="금액 (원)" inputMode="numeric" value={r.amount} onChange={(e) => update(r.uid, { amount: e.target.value })} disabled={disabled} placeholder="비워두면 미정" />
                <Input label="설명" value={r.description} onChange={(e) => update(r.uid, { description: e.target.value })} disabled={disabled} />
              </div>
            </div>
          ))}
        </div>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-3 py-2 text-xs text-danger">{errorMsg}</div>
      )}
      <p className="text-xs text-muted">파일이 비어 있는 영수증은 저장되지 않아요.</p>
    </section>
  );
}
