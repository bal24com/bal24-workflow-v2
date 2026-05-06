// bal24 v2 — 거래처(고객사) 신규 등록 모달
// 14 필드 + 사업자등록증 파일 업로드 (드래그앤드롭/Ctrl+V/클릭)
// 공통 Modal + Input + Button + FileDropZone 사용

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input, FileDropZone } from '../../components/ui';
import { supabase } from '../../lib/supabase';

const STORAGE_BUCKET = 'client-files';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type FormState = {
  name: string;
  representative: string;
  businessNumber: string;
  businessType: string;
  businessItem: string;
  managerName: string;
  managerPhone: string;
  managerEmail: string;
  bankName: string;
  bankAccount: string;
  address: string;
  note: string;
};

const EMPTY: FormState = {
  name: '', representative: '', businessNumber: '',
  businessType: '', businessItem: '',
  managerName: '', managerPhone: '', managerEmail: '',
  bankName: '', bankAccount: '',
  address: '', note: '',
};

function formatBusinessNumber(raw: string): string {
  const digits = raw.replace(/\D/g, '').slice(0, 10);
  if (digits.length < 4) return digits;
  if (digits.length < 6) return `${digits.slice(0, 3)}-${digits.slice(3)}`;
  return `${digits.slice(0, 3)}-${digits.slice(3, 5)}-${digits.slice(5)}`;
}

function translateUploadError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('bucket not found')) {
    return `파일 저장소(${STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`;
  }
  if (m.includes('payload too large') || m.includes('exceeded')) {
    return '파일 용량이 너무 커요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return '파일을 올릴 권한이 없어요. 관리자에게 문의해 주세요.';
  }
  return '파일 업로드 중 오류가 발생했어요.';
}

function translateInsertError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('column') && m.includes('does not exist')) {
    return '거래처 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) {
    return '거래처를 등록할 권한이 없어요. 관리자에게 문의해 주세요.';
  }
  return '거래처 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function ClientFormModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [licenseUrl, setLicenseUrl] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState<string | null>(null);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof FormState, string>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (open) return;
    setForm(EMPTY);
    setLicenseUrl(null);
    setLicenseName(null);
    setErrors({});
    setErrorMsg(null);
  }, [open]);

  const update = <K extends keyof FormState>(key: K, value: FormState[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const handleLicenseSelected = async (file: File) => {
    setUploading(true);
    setErrorMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 60);
      const path = `business_licenses/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;

      const { error } = await supabase.storage
        .from(STORAGE_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });

      if (error) throw error;

      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      setLicenseUrl(pub.publicUrl);
      setLicenseName(file.name);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[clients] 사업자등록증 업로드 실패:', raw);
      setErrorMsg(translateUploadError(raw));
    } finally {
      setUploading(false);
    }
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof FormState, string>> = {};
    if (!form.name.trim()) next.name = '상호명을 입력해 주세요.';
    if (!form.representative.trim()) next.representative = '대표자명을 입력해 주세요.';

    const bn = form.businessNumber.replace(/\D/g, '');
    if (!bn) next.businessNumber = '사업자등록번호를 입력해 주세요.';
    else if (bn.length !== 10) next.businessNumber = '사업자등록번호는 숫자 10자리여야 해요.';

    if (!form.businessType.trim()) next.businessType = '업태를 입력해 주세요.';
    if (!form.businessItem.trim()) next.businessItem = '종목을 입력해 주세요.';
    if (!form.managerName.trim()) next.managerName = '담당자명을 입력해 주세요.';
    if (!form.managerPhone.trim()) next.managerPhone = '담당자 연락처를 입력해 주세요.';
    if (!form.managerEmail.trim()) next.managerEmail = '담당자 이메일을 입력해 주세요.';
    else if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(form.managerEmail.trim())) {
      next.managerEmail = '이메일 형식이 올바르지 않아요.';
    }
    if (!form.bankName.trim()) next.bankName = '계좌은행을 입력해 주세요.';
    if (!form.bankAccount.trim()) next.bankAccount = '계좌번호를 입력해 주세요.';
    if (!form.address.trim()) next.address = '주소를 입력해 주세요.';

    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validate()) {
      setErrorMsg('입력하지 않은 필수 항목이 있어요.');
      return;
    }

    setSubmitting(true);
    try {
      const businessNumberDigits = form.businessNumber.replace(/\D/g, '');
      const { error } = await supabase.from('clients').insert({
        name: form.name.trim(),
        representative: form.representative.trim(),
        business_number: businessNumberDigits,
        business_type: form.businessType.trim() || null,
        business_item: form.businessItem.trim() || null,
        manager_name: form.managerName.trim() || null,
        manager_phone: form.managerPhone.trim() || null,
        manager_email: form.managerEmail.trim() || null,
        bank_name: form.bankName.trim() || null,
        bank_account: form.bankAccount.trim() || null,
        address: form.address.trim() || null,
        note: form.note.trim() || null,
        business_license_url: licenseUrl,
      });

      if (error) throw error;
      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[clients] 등록 실패:', raw);
      setErrorMsg(translateInsertError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="고객사 신규 등록"
      description="상호명·대표자·사업자번호 등 필수 항목을 입력해 주세요."
      size="lg"
      closeOnBackdrop={!submitting && !uploading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting || uploading}>
            취소
          </Button>
          <Button type="submit" form="client-form" variant="primary" loading={submitting} disabled={uploading}>
            저장하기
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">기본 정보</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="상호명" required value={form.name} onChange={(e) => update('name', e.target.value)} disabled={submitting} error={errors.name} placeholder="예) (주)밸런스닷" />
            <Input label="대표자명" required value={form.representative} onChange={(e) => update('representative', e.target.value)} disabled={submitting} error={errors.representative} />
          </div>
          <Input
            label="사업자등록번호"
            required
            value={form.businessNumber}
            onChange={(e) => update('businessNumber', formatBusinessNumber(e.target.value))}
            disabled={submitting}
            error={errors.businessNumber}
            placeholder="000-00-00000"
            inputMode="numeric"
          />
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">업종</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="업태" required value={form.businessType} onChange={(e) => update('businessType', e.target.value)} disabled={submitting} error={errors.businessType} placeholder="예) 서비스업" />
            <Input label="종목" required value={form.businessItem} onChange={(e) => update('businessItem', e.target.value)} disabled={submitting} error={errors.businessItem} placeholder="예) 교육서비스" />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">담당자</h3>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="담당자명" required value={form.managerName} onChange={(e) => update('managerName', e.target.value)} disabled={submitting} error={errors.managerName} />
            <Input label="연락처" required value={form.managerPhone} onChange={(e) => update('managerPhone', e.target.value)} disabled={submitting} error={errors.managerPhone} placeholder="010-0000-0000" />
            <Input label="이메일" required type="email" value={form.managerEmail} onChange={(e) => update('managerEmail', e.target.value)} disabled={submitting} error={errors.managerEmail} placeholder="manager@example.com" />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">계좌 정보</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="계좌은행" required value={form.bankName} onChange={(e) => update('bankName', e.target.value)} disabled={submitting} error={errors.bankName} placeholder="예) 우리은행" />
            <Input label="계좌번호" required value={form.bankAccount} onChange={(e) => update('bankAccount', e.target.value)} disabled={submitting} error={errors.bankAccount} />
          </div>
        </section>

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">주소 / 메모</h3>
          <Input label="주소" required value={form.address} onChange={(e) => update('address', e.target.value)} disabled={submitting} error={errors.address} placeholder="예) 서울시 강남구 ..." />
          <div className="space-y-1.5">
            <label htmlFor="client-note" className="text-sm font-semibold text-slate-700">메모</label>
            <textarea
              id="client-note"
              rows={2}
              value={form.note}
              onChange={(e) => update('note', e.target.value)}
              disabled={submitting}
              placeholder="특이사항·할인율·결제조건 등"
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
            />
          </div>
        </section>

        <section className="space-y-2">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">사업자등록증</h3>
          <FileDropZone
            fileUrl={licenseUrl}
            fileName={licenseName}
            uploading={uploading}
            onFileSelected={(f) => void handleLicenseSelected(f)}
            onClear={() => { setLicenseUrl(null); setLicenseName(null); }}
            disabled={submitting}
            accept="image/*,application/pdf"
          />
        </section>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}
