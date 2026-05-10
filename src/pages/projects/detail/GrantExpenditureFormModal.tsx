// bal24 v2 — STEP-GRANT-LEDGER 지출증빙 등록/수정 모달
// 기본정보·주관기관·증빙서류 6종(필수 3 + 선택 3) 업로드.

import { useEffect, useMemo, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Loader2, Upload, ExternalLink, Trash2 } from 'lucide-react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useAuth } from '../../../contexts/AuthContext';
import { useToast } from '../../../contexts/ToastContext';
import {
  uploadFile, STORAGE_BUCKETS, STORAGE_PATHS, getFileExtension,
} from '../../../lib/storageUtils';
import type {
  GrantExpenditure, GrantFundType,
} from '../../../types/grantLedger';

interface Props {
  open: boolean;
  projectId: string;
  programId?: string | null;
  expenditure?: GrantExpenditure | null;
  onClose: () => void;
  onSaved: () => void;
}

type DocType = 'biz_reg' | 'bank_copy' | 'inspection' | 'contract' | 'quote';
const DOCS: { key: DocType; field: keyof GrantExpenditure; label: string; required: boolean }[] = [
  { key: 'biz_reg',    field: 'biz_reg_url',    label: '사업자등록증 사본',    required: true },
  { key: 'bank_copy',  field: 'bank_copy_url',  label: '통장사본',             required: true },
  { key: 'inspection', field: 'inspection_url', label: '검수조서 / 납품확인서', required: true },
  { key: 'contract',   field: 'contract_url',   label: '계약서',               required: false },
  { key: 'quote',      field: 'quote_url',      label: '견적서',               required: false },
];

const today = () => new Date().toISOString().slice(0, 10);

export default function GrantExpenditureFormModal({
  open, projectId, programId, expenditure, onClose, onSaved,
}: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [submitting, setSubmitting] = useState(false);
  const [uploadingKey, setUploadingKey] = useState<string | null>(null);

  // 기본정보
  const [itemName, setItemName] = useState('');
  const [date, setDate] = useState(today());
  const [amount, setAmount] = useState('0');
  const [fundType, setFundType] = useState<GrantFundType>('grant');
  const [accountCode, setAccountCode] = useState('');
  const [notes, setNotes] = useState('');

  // 주관기관
  const [vendorName, setVendorName] = useState('');
  const [vendorBizRegNo, setVendorBizRegNo] = useState('');
  const [vendorRepName, setVendorRepName] = useState('');
  const [vendorAddress, setVendorAddress] = useState('');

  // 증빙 URL
  const [receiptUrl, setReceiptUrl] = useState<string | null>(null);
  const [docUrls, setDocUrls] = useState<Record<DocType, string | null>>({
    biz_reg: null, bank_copy: null, inspection: null, contract: null, quote: null,
  });

  useEffect(() => {
    if (!open) return;
    if (expenditure) {
      setItemName(expenditure.item_name);
      setDate(expenditure.expenditure_date);
      setAmount(String(expenditure.amount));
      setFundType(expenditure.fund_type);
      setAccountCode(expenditure.account_code ?? '');
      setNotes(expenditure.notes ?? '');
      setVendorName(expenditure.vendor_name ?? '');
      setVendorBizRegNo(expenditure.vendor_biz_reg_no ?? '');
      setVendorRepName(expenditure.vendor_rep_name ?? '');
      setVendorAddress(expenditure.vendor_address ?? '');
      setReceiptUrl(expenditure.receipt_url);
      setDocUrls({
        biz_reg:    expenditure.biz_reg_url,
        bank_copy:  expenditure.bank_copy_url,
        inspection: expenditure.inspection_url,
        contract:   expenditure.contract_url,
        quote:      expenditure.quote_url,
      });
    } else {
      setItemName(''); setDate(today()); setAmount('0'); setFundType('grant');
      setAccountCode(''); setNotes('');
      setVendorName(''); setVendorBizRegNo(''); setVendorRepName(''); setVendorAddress('');
      setReceiptUrl(null);
      setDocUrls({ biz_reg: null, bank_copy: null, inspection: null, contract: null, quote: null });
    }
  }, [open, expenditure]);

  const expenditureId = useMemo(() => expenditure?.id ?? `draft-${Date.now()}`, [expenditure]);

  const handleDocUpload = async (docType: DocType, e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingKey(docType);
    try {
      const ext = getFileExtension(file);
      const path = STORAGE_PATHS.grantDocument(projectId, expenditureId, docType, ext);
      const result = await uploadFile(STORAGE_BUCKETS.GRANT_DOCUMENTS, path, file);
      setDocUrls((p) => ({ ...p, [docType]: result.url }));
      toast.success(`${DOCS.find((d) => d.key === docType)?.label} 업로드 완료.`);
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업로드에 실패했어요.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleReceiptUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    setUploadingKey('receipt');
    try {
      const ext = getFileExtension(file);
      const path = `${projectId}/${expenditureId}/receipt.${ext}`;
      const result = await uploadFile(STORAGE_BUCKETS.GRANT_DOCUMENTS, path, file);
      setReceiptUrl(result.url);
      toast.success('영수증 업로드 완료.');
    } catch (err) {
      toast.error(err instanceof Error ? err.message : '업로드에 실패했어요.');
    } finally {
      setUploadingKey(null);
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!itemName.trim()) { toast.error('항목명을 입력해 주세요.'); return; }
    const amt = Number(amount.replace(/,/g, ''));
    if (Number.isNaN(amt) || amt < 0) { toast.error('금액은 0 이상이어야 해요.'); return; }
    setSubmitting(true);
    try {
      const payload = {
        project_id: projectId,
        program_id: programId ?? null,
        item_name: itemName.trim(),
        account_code: accountCode.trim() || null,
        expenditure_date: date,
        amount: amt,
        fund_type: fundType,
        vendor_name: vendorName.trim() || null,
        vendor_biz_reg_no: vendorBizRegNo.trim() || null,
        vendor_rep_name: vendorRepName.trim() || null,
        vendor_address: vendorAddress.trim() || null,
        receipt_url: receiptUrl,
        biz_reg_url: docUrls.biz_reg,
        bank_copy_url: docUrls.bank_copy,
        inspection_url: docUrls.inspection,
        contract_url: docUrls.contract,
        quote_url: docUrls.quote,
        notes: notes.trim() || null,
        created_by: expenditure ? undefined : (user?.id ?? null),
        updated_at: new Date().toISOString(),
      };
      const res = expenditure
        ? await supabase.from('grant_expenditures').update(payload).eq('id', expenditure.id)
        : await supabase.from('grant_expenditures').insert(payload);
      if (res.error) {
        console.error('[grant-exp] 저장 실패:', res.error.message);
        toast.error('지출 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      toast.success('지출증빙을 저장했어요.');
      onSaved();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={expenditure ? '지출증빙 수정' : '지출증빙 등록'}
      size="lg"
      closeOnBackdrop={!submitting && !uploadingKey}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="grant-exp-form" variant="primary" loading={submitting}>저장</Button>
        </>
      }
    >
      <form id="grant-exp-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        {/* 기본정보 */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">기본정보</h3>
          <Input label="항목명" required value={itemName} onChange={(e) => setItemName(e.target.value)} disabled={submitting} placeholder="예) 자료집 인쇄비" />
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input type="date" label="지출일" required value={date} onChange={(e) => setDate(e.target.value)} disabled={submitting} />
            <Input type="number" label="금액 (원)" inputMode="numeric" value={amount} onChange={(e) => setAmount(e.target.value)} disabled={submitting} min={0} step={1000} required />
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">구분</label>
              <select value={fundType} onChange={(e) => setFundType(e.target.value as GrantFundType)} disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
                <option value="grant">지원금</option>
                <option value="self">자부담</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="계정과목 코드" value={accountCode} onChange={(e) => setAccountCode(e.target.value)} disabled={submitting} placeholder="예) EXPENSE_PRINTING" />
            <Input label="메모" value={notes} onChange={(e) => setNotes(e.target.value)} disabled={submitting} />
          </div>
        </section>

        {/* 주관기관 */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">주관기관</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
            <Input label="주관기관명" value={vendorName} onChange={(e) => setVendorName(e.target.value)} disabled={submitting} />
            <Input label="사업자등록번호" value={vendorBizRegNo} onChange={(e) => setVendorBizRegNo(e.target.value)} disabled={submitting} placeholder="000-00-00000" />
            <Input label="대표자명" value={vendorRepName} onChange={(e) => setVendorRepName(e.target.value)} disabled={submitting} />
            <Input label="주소" value={vendorAddress} onChange={(e) => setVendorAddress(e.target.value)} disabled={submitting} />
          </div>
        </section>

        {/* 증빙서류 */}
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wider">증빙서류</h3>

          {/* 영수증 */}
          <DocRow
            label="세금계산서 / 영수증"
            url={receiptUrl}
            uploading={uploadingKey === 'receipt'}
            onPick={handleReceiptUpload}
            onClear={() => setReceiptUrl(null)}
            disabled={submitting}
          />

          {DOCS.map((d) => (
            <DocRow
              key={d.key}
              label={`${d.label}${d.required ? ' *필수' : ' (선택)'}`}
              url={docUrls[d.key]}
              uploading={uploadingKey === d.key}
              onPick={(e) => void handleDocUpload(d.key, e)}
              onClear={() => setDocUrls((p) => ({ ...p, [d.key]: null }))}
              disabled={submitting}
            />
          ))}
        </section>
      </form>
    </Modal>
  );
}

interface DocRowProps {
  label: string;
  url: string | null;
  uploading: boolean;
  onPick: (e: ChangeEvent<HTMLInputElement>) => void;
  onClear: () => void;
  disabled: boolean;
}

function DocRow({ label, url, uploading, onPick, onClear, disabled }: DocRowProps) {
  return (
    <div className="flex items-center gap-2 flex-wrap">
      <span className="text-xs font-semibold text-slate-700 min-w-[180px]">{label}</span>
      {url ? (
        <>
          <a href={url} target="_blank" rel="noreferrer"
            className="inline-flex items-center gap-1 text-xs text-emerald-700 hover:underline">
            <ExternalLink size={11} aria-hidden="true" />
            업로드됨 — 열기
          </a>
          <button type="button" onClick={onClear} disabled={disabled || uploading}
            className="inline-flex items-center gap-1 text-xs text-rose-500 hover:underline">
            <Trash2 size={11} aria-hidden="true" />
            제거
          </button>
        </>
      ) : (
        <label className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-xs text-violet-700 bg-violet-50 hover:bg-violet-100 cursor-pointer">
          {uploading ? <Loader2 size={11} className="animate-spin" /> : <Upload size={11} />}
          파일 선택
          <input type="file" hidden onChange={onPick} disabled={disabled || uploading} />
        </label>
      )}
    </div>
  );
}
