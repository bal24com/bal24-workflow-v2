// bal24 v2 — 고객사 신규 등록 모달
// 기본정보 + 사업자등록증 파일 + 담당자 동적 추가/삭제 (client_contacts)

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Button, Input, FileDropZone } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';

const STORAGE_BUCKET = 'client-files';

type Props = {
  open: boolean;
  onClose: () => void;
  onCreated: () => void;
};

type ClientForm = {
  name: string;
  representative: string;
  businessNumber: string;
  businessType: string;
  businessItem: string;
  bankName: string;
  bankAccount: string;
  address: string;
  note: string;
};

type ContactDraft = {
  uid: string;
  name: string;
  position: string;
  mainDuties: string;
  phoneMobile: string;
  phoneOffice: string;
  email: string;
  linkedProfileId: string;
};

type ProfileOption = Pick<Profile, 'id' | 'name'>;

const EMPTY_CLIENT: ClientForm = {
  name: '', representative: '', businessNumber: '',
  businessType: '', businessItem: '',
  bankName: '', bankAccount: '',
  address: '', note: '',
};

function makeContact(): ContactDraft {
  return {
    uid: typeof crypto !== 'undefined' && crypto.randomUUID ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
    name: '', position: '', mainDuties: '',
    phoneMobile: '', phoneOffice: '', email: '', linkedProfileId: '',
  };
}

function formatBusinessNumber(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 10);
  if (d.length < 4) return d;
  if (d.length < 6) return `${d.slice(0, 3)}-${d.slice(3)}`;
  return `${d.slice(0, 3)}-${d.slice(3, 5)}-${d.slice(5)}`;
}

function translateError(raw: string, ctx: 'upload' | 'insert' | 'contact'): string {
  const m = raw.toLowerCase();
  if (ctx === 'upload') {
    if (m.includes('bucket not found')) return `파일 저장소(${STORAGE_BUCKET})가 없어요. Supabase에서 버킷을 먼저 만들어 주세요.`;
    if (m.includes('payload too large') || m.includes('exceeded')) return '파일 용량이 너무 커요.';
    if (m.includes('row-level security') || m.includes('permission denied')) return '파일을 올릴 권한이 없어요. 관리자에게 문의해 주세요.';
    return '파일 업로드 중 오류가 발생했어요.';
  }
  if (m.includes("could not find the table 'public.client_contacts'") || m.includes('pgrst205')) {
    return '담당자 테이블이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('column') && m.includes('does not exist')) {
    return '거래처 테이블 컬럼이 아직 적용되지 않았어요. Supabase에서 마이그레이션을 실행해 주세요.';
  }
  if (m.includes('row-level security') || m.includes('permission denied')) return '저장 권한이 없어요. 관리자에게 문의해 주세요.';
  return ctx === 'contact'
    ? '담당자 저장 중 오류가 발생했어요. (고객사는 등록되었어요)'
    : '거래처 등록 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function ClientFormModal({ open, onClose, onCreated }: Props) {
  const [form, setForm] = useState<ClientForm>(EMPTY_CLIENT);
  const [contacts, setContacts] = useState<ContactDraft[]>([makeContact()]);
  const [licenseUrl, setLicenseUrl] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientForm, string>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    supabase
      .from('profiles')
      .select('id, name')
      .eq('is_active', true)
      .order('name', { ascending: true })
      .then(({ data, error }) => {
        if (cancelled) return;
        if (error) console.error('[clients] 직원 조회 실패:', error.message);
        else setProfiles(data ?? []);
      });
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (open) return;
    setForm(EMPTY_CLIENT);
    setContacts([makeContact()]);
    setLicenseUrl(null);
    setLicenseName(null);
    setErrors({});
    setErrorMsg(null);
  }, [open]);

  const update = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

  const updateContact = (uid: string, patch: Partial<ContactDraft>) => {
    setContacts((prev) => prev.map((c) => (c.uid === uid ? { ...c, ...patch } : c)));
  };

  const addContact = () => setContacts((prev) => [...prev, makeContact()]);
  const removeContact = (uid: string) =>
    setContacts((prev) => (prev.length > 1 ? prev.filter((c) => c.uid !== uid) : prev));

  const handleLicenseSelected = async (file: File) => {
    setUploading(true);
    setErrorMsg(null);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^\w가-힣ㄱ-ㅎㅏ-ㅣ.-]+/g, '_').slice(0, 60);
      const path = `business_licenses/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage.from(STORAGE_BUCKET).upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(STORAGE_BUCKET).getPublicUrl(path);
      setLicenseUrl(pub.publicUrl);
      setLicenseName(file.name);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[clients] 사업자등록증 업로드 실패:', raw);
      setErrorMsg(translateError(raw, 'upload'));
    } finally {
      setUploading(false);
    }
  };

  const validate = (): boolean => {
    const next: Partial<Record<keyof ClientForm, string>> = {};
    if (!form.name.trim()) next.name = '상호명을 입력해 주세요.';
    const bn = form.businessNumber.replace(/\D/g, '');
    if (bn && bn.length !== 10) next.businessNumber = '사업자등록번호는 숫자 10자리여야 해요.';
    setErrors(next);
    return Object.keys(next).length === 0;
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!validate()) {
      setErrorMsg('필수 항목을 확인해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const businessNumberDigits = form.businessNumber.replace(/\D/g, '');
      const { data: clientData, error: insertError } = await supabase.from('clients').insert({
        name: form.name.trim(),
        representative: form.representative.trim() || null,
        business_number: businessNumberDigits || null,
        business_type: form.businessType.trim() || null,
        business_item: form.businessItem.trim() || null,
        address: form.address.trim() || null,
        note: form.note.trim() || null,
        bank_name: form.bankName.trim() || null,
        bank_account: form.bankAccount.trim() || null,
        business_license_url: licenseUrl,
      }).select('id').single();

      if (insertError) throw insertError;

      const filledContacts = contacts.filter((c) => c.name.trim());
      if (filledContacts.length > 0 && clientData) {
        const rows = filledContacts.map((c) => ({
          client_id: clientData.id,
          name: c.name.trim(),
          position: c.position.trim() || null,
          main_duties: c.mainDuties.trim() || null,
          phone_mobile: c.phoneMobile.trim() || null,
          phone_office: c.phoneOffice.trim() || null,
          email: c.email.trim() || null,
          linked_profile_id: c.linkedProfileId || null,
        }));
        const { error: contactsError } = await supabase.from('client_contacts').insert(rows);
        if (contactsError) {
          console.error('[clients] 담당자 저장 실패:', contactsError.message);
          setErrorMsg(translateError(contactsError.message, 'contact'));
          // 고객사는 등록됐으니 onCreated는 호출하고 모달은 닫음
        }
      }

      onCreated();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[clients] 등록 실패:', raw);
      setErrorMsg(translateError(raw, 'insert'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="고객사 신규 등록"
      description="상호명만 필수예요. 담당자는 여러 명 등록할 수 있어요."
      size="lg"
      closeOnBackdrop={!submitting && !uploading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting || uploading}>취소</Button>
          <Button type="submit" form="client-form" variant="primary" loading={submitting} disabled={uploading}>저장하기</Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">기본 정보</h3>
          <Input label="상호명" required value={form.name} onChange={(e) => update('name', e.target.value)} disabled={submitting} error={errors.name} placeholder="예) (주)밸런스닷" />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="대표자명" value={form.representative} onChange={(e) => update('representative', e.target.value)} disabled={submitting} />
            <Input
              label="사업자등록번호"
              value={form.businessNumber}
              onChange={(e) => update('businessNumber', formatBusinessNumber(e.target.value))}
              disabled={submitting}
              error={errors.businessNumber}
              placeholder="000-00-00000"
              inputMode="numeric"
            />
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="업태" value={form.businessType} onChange={(e) => update('businessType', e.target.value)} disabled={submitting} placeholder="예) 서비스업" />
            <Input label="종목" value={form.businessItem} onChange={(e) => update('businessItem', e.target.value)} disabled={submitting} placeholder="예) 교육서비스" />
          </div>
          <Input label="주소" value={form.address} onChange={(e) => update('address', e.target.value)} disabled={submitting} />
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

        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">계좌</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="계좌은행" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} disabled={submitting} placeholder="예) 우리은행" />
            <Input label="계좌번호" value={form.bankAccount} onChange={(e) => update('bankAccount', e.target.value)} disabled={submitting} />
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

        <section className="space-y-3">
          <div className="flex items-center justify-between">
            <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">담당자 ({contacts.length})</h3>
            <Button type="button" variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={addContact} disabled={submitting}>담당자 추가</Button>
          </div>
          <div className="space-y-3">
            {contacts.map((c, idx) => (
              <div key={c.uid} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-3">
                <div className="flex items-center justify-between">
                  <span className="text-xs font-semibold text-slate-500">담당자 #{idx + 1}</span>
                  {contacts.length > 1 && (
                    <button
                      type="button"
                      onClick={() => removeContact(c.uid)}
                      disabled={submitting}
                      className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5"
                      aria-label={`담당자 #${idx + 1} 삭제`}
                    >
                      <Trash2 size={14} />
                    </button>
                  )}
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input label="이름" value={c.name} onChange={(e) => updateContact(c.uid, { name: e.target.value })} disabled={submitting} placeholder="예) 홍길동" />
                  <Input label="직책" value={c.position} onChange={(e) => updateContact(c.uid, { position: e.target.value })} disabled={submitting} placeholder="예) 차장" />
                  <Input label="주요업무" value={c.mainDuties} onChange={(e) => updateContact(c.uid, { mainDuties: e.target.value })} disabled={submitting} placeholder="예) 교육 운영" />
                </div>
                <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
                  <Input label="휴대폰" value={c.phoneMobile} onChange={(e) => updateContact(c.uid, { phoneMobile: e.target.value })} disabled={submitting} placeholder="010-0000-0000" />
                  <Input label="사무실" value={c.phoneOffice} onChange={(e) => updateContact(c.uid, { phoneOffice: e.target.value })} disabled={submitting} />
                  <Input label="이메일" type="email" value={c.email} onChange={(e) => updateContact(c.uid, { email: e.target.value })} disabled={submitting} />
                </div>
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">내부직원 매칭</label>
                  <select
                    value={c.linkedProfileId}
                    onChange={(e) => updateContact(c.uid, { linkedProfileId: e.target.value })}
                    disabled={submitting}
                    className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
                  >
                    <option value="">선택 없음</option>
                    {profiles.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
                  </select>
                </div>
              </div>
            ))}
          </div>
          <p className="text-xs text-muted">이름이 비어 있는 담당자 행은 저장되지 않아요.</p>
        </section>

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
