// bal24 v2 — 고객사 등록·수정 모달
// client prop 있으면 수정 모드, 없으면 신규 등록.
// 헬퍼·타입은 clientFormHelpers.ts, 담당자 섹션은 ClientContactsSection.tsx 로 분리.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input, FileDropZone } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Client, ClientContact, ClientType, Profile } from '../../types/database';
import { makeContact, type ContactDraft } from './ContactRow';
import {
  STORAGE_BUCKET,
  EMPTY_CLIENT,
  clientToForm,
  contactRowToDraft,
  formatBusinessNumber,
  translateClientError,
  type ClientForm,
} from './clientFormHelpers';
import ClientContactsSection from './ClientContactsSection';

type Props = {
  open: boolean;
  /** 수정 모드 시 기존 client. null/undefined면 신규 등록. */
  client?: Client | null;
  onClose: () => void;
  /** 저장(등록 or 수정) 완료 콜백 */
  onSaved: () => void;
};

type ProfileOption = Pick<Profile, 'id' | 'name'>;

export default function ClientFormModal({ open, client, onClose, onSaved }: Props) {
  const isEdit = Boolean(client);
  const [form, setForm] = useState<ClientForm>(EMPTY_CLIENT);
  const [contacts, setContacts] = useState<ContactDraft[]>([makeContact()]);
  const [licenseUrl, setLicenseUrl] = useState<string | null>(null);
  const [licenseName, setLicenseName] = useState<string | null>(null);
  const [profiles, setProfiles] = useState<ProfileOption[]>([]);

  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errors, setErrors] = useState<Partial<Record<keyof ClientForm, string>>>({});
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

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

  // 모달 열릴 때 — client 있으면 prefill, 없으면 EMPTY
  useEffect(() => {
    if (!open) return;
    if (client) {
      setForm(clientToForm(client));
      setLicenseUrl(client.business_license_url ?? null);
      setLicenseName(client.business_license_url ? '등록된 사업자등록증' : null);
      let cancelled = false;
      void (async () => {
        const { data, error } = await supabase
          .from('client_contacts')
          .select('*')
          .eq('client_id', client.id)
          .order('created_at', { ascending: true });
        if (cancelled) return;
        if (error) {
          console.error('[clients] 담당자 조회 실패:', error.message);
          setContacts([makeContact()]);
          return;
        }
        const rows = (data as ClientContact[] | null) ?? [];
        setContacts(rows.length > 0 ? rows.map(contactRowToDraft) : [makeContact()]);
      })();
      return () => { cancelled = true; };
    }
    setForm(EMPTY_CLIENT);
    setContacts([makeContact()]);
    setLicenseUrl(null);
    setLicenseName(null);
  }, [open, client]);

  useEffect(() => {
    if (open) return;
    setForm(EMPTY_CLIENT);
    setContacts([makeContact()]);
    setLicenseUrl(null);
    setLicenseName(null);
    setErrors({});
    setErrorMsg(null);
    setInfoMsg(null);
  }, [open]);

  const update = <K extends keyof ClientForm>(key: K, value: ClientForm[K]) => {
    setForm((prev) => ({ ...prev, [key]: value }));
  };

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
      setErrorMsg(translateClientError(raw, 'upload'));
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
      const payload = {
        name: form.name.trim(),
        business_name: form.businessName.trim() || null,
        ceo_name: form.ceoName.trim() || null,
        client_type: form.clientType,
        representative: form.representative.trim() || null,
        business_number: businessNumberDigits || null,
        business_type: form.businessType.trim() || null,
        business_item: form.businessItem.trim() || null,
        department: form.department.trim() || null,
        address: form.address.trim() || null,
        phone: form.phone.trim() || null,
        email: form.email.trim() || null,
        note: form.note.trim() || null,
        bank_name: form.bankName.trim() || null,
        bank_account: form.bankAccount.trim() || null,
        bank_holder: form.bankHolder.trim() || null,
        business_license_url: licenseUrl,
      };

      let clientId: string | null = null;

      if (isEdit && client) {
        const { error: updateError } = await supabase
          .from('clients')
          .update({ ...payload, updated_at: new Date().toISOString() })
          .eq('id', client.id);
        if (updateError) throw updateError;
        clientId = client.id;
      } else {
        const { data: clientData, error: insertError } = await supabase
          .from('clients')
          .insert(payload)
          .select('id')
          .single();
        if (insertError) throw insertError;
        clientId = (clientData?.id as string | undefined) ?? null;
      }

      if (clientId) {
        // 수정 모드: 기존 contacts 전체 삭제 후 재삽입 (단순·DB 동기화 정확)
        if (isEdit) {
          const { error: delErr } = await supabase
            .from('client_contacts')
            .delete()
            .eq('client_id', clientId);
          if (delErr) console.error('[clients] 담당자 초기화 실패:', delErr.message);
        }

        const filledContacts = contacts.filter((c) => c.name.trim());
        if (filledContacts.length > 0) {
          const rows = filledContacts.map((c) => ({
            client_id: clientId,
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
            setErrorMsg(translateClientError(contactsError.message, 'contact'));
          }
        }
      }

      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error(`[clients] ${isEdit ? '수정' : '등록'} 실패:`, raw);
      setErrorMsg(translateClientError(raw, 'insert'));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={isEdit ? '고객사 수정' : '고객사 신규 등록'}
      description={isEdit ? '정보를 수정하고 저장하면 즉시 반영돼요.' : '상호명만 필수예요. 담당자는 여러 명 등록할 수 있어요.'}
      size="lg"
      closeOnBackdrop={!submitting && !uploading}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting || uploading}>취소</Button>
          <Button type="submit" form="client-form" variant="primary" loading={submitting} disabled={uploading}>
            {isEdit ? '수정 완료' : '저장하기'}
          </Button>
        </>
      }
    >
      <form id="client-form" onSubmit={handleSubmit} className="space-y-5" noValidate>
        <section className="space-y-3">
          <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">기본 정보</h3>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="상호명 (통칭)" required value={form.name} onChange={(e) => update('name', e.target.value)} disabled={submitting} error={errors.name} placeholder="예) 밸런스닷" />
            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">고객 유형</label>
              <select
                value={form.clientType}
                onChange={(e) => update('clientType', e.target.value as ClientType)}
                disabled={submitting}
                className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
              >
                <option value="client">고객사</option>
                <option value="vendor">주관기관</option>
                <option value="both">고객사 + 주관기관</option>
              </select>
            </div>
          </div>
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="법인명 (사업자등록증 상)" value={form.businessName} onChange={(e) => update('businessName', e.target.value)} disabled={submitting} placeholder="예) 주식회사 밸런스닷" />
            <Input label="대표자명" value={form.ceoName} onChange={(e) => update('ceoName', e.target.value)} disabled={submitting} placeholder="예) 박경수" />
          </div>
          <Input
            label="사업자등록번호"
            value={form.businessNumber}
            onChange={(e) => update('businessNumber', formatBusinessNumber(e.target.value))}
            disabled={submitting}
            error={errors.businessNumber}
            placeholder="000-00-00000"
            inputMode="numeric"
            helperText="세금계산서 발행에 필요해요."
          />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="업태" value={form.businessType} onChange={(e) => update('businessType', e.target.value)} disabled={submitting} placeholder="예) 서비스업" />
            <Input label="종목" value={form.businessItem} onChange={(e) => update('businessItem', e.target.value)} disabled={submitting} placeholder="예) 교육서비스" />
          </div>
          <Input label="부서명" value={form.department} onChange={(e) => update('department', e.target.value)} disabled={submitting} placeholder="부서명 (선택)" helperText="해당 고객사 내 부서·팀명" />
          <Input label="주소" value={form.address} onChange={(e) => update('address', e.target.value)} disabled={submitting} />
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Input label="대표 전화" type="tel" value={form.phone} onChange={(e) => update('phone', e.target.value)} disabled={submitting} placeholder="02-0000-0000" />
            <Input label="대표 이메일" type="email" value={form.email} onChange={(e) => update('email', e.target.value)} disabled={submitting} placeholder="contact@company.kr" />
          </div>
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
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
            <Input label="계좌은행" value={form.bankName} onChange={(e) => update('bankName', e.target.value)} disabled={submitting} placeholder="예) 우리은행" />
            <Input label="계좌번호" value={form.bankAccount} onChange={(e) => update('bankAccount', e.target.value)} disabled={submitting} />
            <Input label="예금주" value={form.bankHolder} onChange={(e) => update('bankHolder', e.target.value)} disabled={submitting} placeholder="예) (주)밸런스닷" />
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

        <ClientContactsSection
          contacts={contacts}
          profiles={profiles}
          disabled={submitting}
          onCompanyNameSuggested={(name) => {
            if (!form.name.trim()) update('name', name);
          }}
          onScanFeedback={(fb) => {
            if (fb.type === 'info') {
              setInfoMsg(fb.message);
              setErrorMsg(null);
            } else {
              setErrorMsg(fb.message);
              setInfoMsg(null);
            }
          }}
          onChange={setContacts}
        />

        {infoMsg && (
          <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-700">{infoMsg}</div>
        )}
        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
