// 수입/계약 등록·수정 모달 — STEP-ACCOUNTING-ALL P2
// 기본정보 + 청구 단계 jsonb + 첨부 + 비고

import { useEffect, useState } from 'react';
import { Plus, Trash2 } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import FileDropZone from '../../components/ui/FileDropZone';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import type {
  BillingScheduleItem, ContractStatus, VatType,
} from '../../types/database';
import type { ContractRow } from './contractUtils';
import { CONTRACT_STATUS_VALUES, uploadContractFile } from './contractUtils';

interface RefOption { id: string; name: string }

interface Props {
  open: boolean;
  target: ContractRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const VAT_VALUES: VatType[] = ['과세', '면세', '영세율'];

function emptyForm() {
  return {
    contract_name: '',
    client_id: '',
    project_id: '',
    contract_amount: '',
    vat_type: '과세' as VatType,
    contract_date: '',
    status: '진행중' as ContractStatus,
    memo: '',
    contract_file_url: '' as string,
    contract_file_name: '' as string,
    tax_invoice_url: '' as string,
    tax_invoice_name: '' as string,
  };
}


export default function ContractFormModal({ open, target, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [schedule, setSchedule] = useState<BillingScheduleItem[]>([]);
  const [clients, setClients] = useState<RefOption[]>([]);
  const [projects, setProjects] = useState<RefOption[]>([]);
  const [saving, setSaving] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingTaxInvoice, setUploadingTaxInvoice] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [cRes, pRes] = await Promise.all([
        supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
        supabase.from('projects').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (cRes.error) console.error('[ContractFormModal] clients 조회 실패:', cRes.error.message);
      if (pRes.error) console.error('[ContractFormModal] projects 조회 실패:', pRes.error.message);
      setClients((cRes.data as RefOption[] | null) ?? []);
      setProjects((pRes.data as RefOption[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({
        contract_name: target.contract_name ?? '',
        client_id: target.client_id ?? '',
        project_id: target.project_id ?? '',
        contract_amount: String(target.contract_amount ?? ''),
        vat_type: target.vat_type ?? '과세',
        contract_date: target.contract_date ?? '',
        status: target.status ?? '진행중',
        memo: target.memo ?? '',
        contract_file_url: target.contract_file_url ?? '',
        contract_file_name: target.contract_file_url ? '업로드된 계약서' : '',
        tax_invoice_url: target.tax_invoice_url ?? '',
        tax_invoice_name: target.tax_invoice_url ? '업로드된 세금계산서' : '',
      });
      setSchedule(Array.isArray(target.billing_schedule) ? target.billing_schedule : []);
    } else {
      setForm(emptyForm());
      setSchedule([]);
    }
  }, [open, target]);

  function addSchedule() {
    setSchedule((prev) => [
      ...prev,
      { seq: prev.length + 1, amount: 0, due_date: '', status: 'pending' },
    ]);
  }

  function updateSchedule(idx: number, patch: Partial<BillingScheduleItem>) {
    setSchedule((prev) => prev.map((s, i) => (i === idx ? { ...s, ...patch } : s)));
  }

  function removeSchedule(idx: number) {
    setSchedule((prev) => prev.filter((_, i) => i !== idx).map((s, i) => ({ ...s, seq: i + 1 })));
  }

  async function handleContractFile(file: File) {
    setUploadingContract(true);
    try {
      const { url, name } = await uploadContractFile(file, 'contract');
      setForm((f) => ({ ...f, contract_file_url: url, contract_file_name: name }));
      toast.success('계약서를 업로드했어요.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[ContractFormModal] 계약서 업로드 실패:', msg);
      toast.error(msg || '계약서 업로드에 실패했어요.');
    } finally {
      setUploadingContract(false);
    }
  }

  async function handleTaxInvoiceFile(file: File) {
    setUploadingTaxInvoice(true);
    try {
      const { url, name } = await uploadContractFile(file, 'tax_invoice');
      setForm((f) => ({ ...f, tax_invoice_url: url, tax_invoice_name: name }));
      toast.success('세금계산서를 업로드했어요.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[ContractFormModal] 세금계산서 업로드 실패:', msg);
      toast.error(msg || '세금계산서 업로드에 실패했어요.');
    } finally {
      setUploadingTaxInvoice(false);
    }
  }

  function clearContractFile() {
    setForm((f) => ({ ...f, contract_file_url: '', contract_file_name: '' }));
  }
  function clearTaxInvoice() {
    setForm((f) => ({ ...f, tax_invoice_url: '', tax_invoice_name: '' }));
  }

  async function handleSave() {
    if (!form.contract_name.trim()) { toast.error('계약명을 입력해 주세요.'); return; }
    if (!form.contract_amount || Number.isNaN(Number(form.contract_amount))) {
      toast.error('계약금액을 숫자로 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      const payload = {
        contract_name: form.contract_name.trim(),
        client_id: form.client_id || null,
        project_id: form.project_id || null,
        contract_amount: Number(form.contract_amount),
        vat_type: form.vat_type,
        contract_date: form.contract_date || null,
        status: form.status,
        billing_schedule: schedule,
        memo: form.memo.trim() || null,
        contract_file_url: form.contract_file_url || null,
        tax_invoice_url: form.tax_invoice_url || null,
        updated_at: new Date().toISOString(),
      };
      if (target) {
        const { error } = await supabase.from('income_contracts').update(payload).eq('id', target.id);
        if (error) throw error;
        toast.success('계약을 수정했어요.');
      } else {
        const { error } = await supabase.from('income_contracts').insert(payload);
        if (error) throw error;
        toast.success('계약을 등록했어요.');
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[ContractFormModal] 저장 오류:', msg);
      toast.error('저장 중 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  }

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? '계약 수정' : '신규 계약 등록'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
          <Button variant="primary" onClick={() => void handleSave()} loading={saving}>저장하기</Button>
        </div>
      }
    >
      <div className="space-y-4">
        <Field label="계약명" required>
          <Input
            value={form.contract_name}
            onChange={(e) => setForm({ ...form, contract_name: e.target.value })}
            placeholder="예: 2026 광주관광 활성화 1차 용역"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label="주관기관">
            <select
              value={form.client_id}
              onChange={(e) => setForm({ ...form, client_id: e.target.value })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">선택 안함</option>
              {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
            </select>
          </Field>
          <Field label="연결 프로젝트">
            <select
              value={form.project_id}
              onChange={(e) => setForm({ ...form, project_id: e.target.value })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">선택 안함</option>
              {projects.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </Field>
        </div>

        <div className="grid grid-cols-3 gap-3">
          <Field label="계약금액" required>
            <Input
              type="number"
              value={form.contract_amount}
              onChange={(e) => setForm({ ...form, contract_amount: e.target.value })}
              placeholder="50000000"
            />
          </Field>
          <Field label="과세구분">
            <select
              value={form.vat_type}
              onChange={(e) => setForm({ ...form, vat_type: e.target.value as VatType })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {VAT_VALUES.map((v) => <option key={v} value={v}>{v}</option>)}
            </select>
          </Field>
          <Field label="계약일">
            <Input
              type="date"
              value={form.contract_date}
              onChange={(e) => setForm({ ...form, contract_date: e.target.value })}
            />
          </Field>
        </div>

        <Field label="상태">
          <select
            value={form.status}
            onChange={(e) => setForm({ ...form, status: e.target.value as ContractStatus })}
            className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
          >
            {CONTRACT_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
          </select>
        </Field>

        {/* 청구 단계 jsonb */}
        <div>
          <div className="flex items-center justify-between mb-2">
            <span className="text-xs font-semibold text-slate-500">청구 단계</span>
            <Button variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={addSchedule}>단계 추가</Button>
          </div>
          {schedule.length === 0 ? (
            <p className="text-xs text-slate-400 italic">청구 단계를 추가하지 않으면 일괄 계약으로 처리됩니다.</p>
          ) : (
            <div className="space-y-2">
              {schedule.map((s, idx) => (
                <div key={idx} className="grid grid-cols-12 gap-2 items-center">
                  <div className="col-span-1 text-center text-xs text-slate-500">{s.seq}회차</div>
                  <Input
                    className="col-span-3"
                    type="number"
                    value={String(s.amount || '')}
                    onChange={(e) => updateSchedule(idx, { amount: Number(e.target.value) || 0 })}
                    placeholder="금액"
                  />
                  <Input
                    className="col-span-3"
                    type="date"
                    value={s.due_date}
                    onChange={(e) => updateSchedule(idx, { due_date: e.target.value })}
                  />
                  <select
                    className="col-span-3 h-10 rounded-xl border border-slate-200 px-2 text-xs"
                    value={s.status}
                    onChange={(e) => updateSchedule(idx, { status: e.target.value as BillingScheduleItem['status'] })}
                  >
                    <option value="pending">대기</option>
                    <option value="issued">발행</option>
                    <option value="paid">완료</option>
                  </select>
                  <button
                    type="button"
                    onClick={() => removeSchedule(idx)}
                    className="col-span-2 inline-flex items-center justify-center h-9 rounded-lg text-xs text-rose-600 hover:bg-rose-50"
                  >
                    <Trash2 size={12} className="mr-1" />삭제
                  </button>
                </div>
              ))}
            </div>
          )}
        </div>

        {/* 첨부 파일 — Storage contracts 버킷 */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Field label="계약서 (PDF·이미지)">
            <FileDropZone
              fileUrl={form.contract_file_url || null}
              fileName={form.contract_file_name || null}
              accept="application/pdf,image/*"
              uploading={uploadingContract}
              uploadingLabel="계약서 업로드 중..."
              onFileSelected={(file) => void handleContractFile(file)}
              onClear={clearContractFile}
            />
          </Field>
          <Field label="세금계산서 (PDF·이미지)">
            <FileDropZone
              fileUrl={form.tax_invoice_url || null}
              fileName={form.tax_invoice_name || null}
              accept="application/pdf,image/*"
              uploading={uploadingTaxInvoice}
              uploadingLabel="세금계산서 업로드 중..."
              onFileSelected={(file) => void handleTaxInvoiceFile(file)}
              onClear={clearTaxInvoice}
            />
          </Field>
        </div>

        <Field label="비고">
          <textarea
            value={form.memo}
            onChange={(e) => setForm({ ...form, memo: e.target.value })}
            rows={3}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm"
            placeholder="추가 메모"
          />
        </Field>
      </div>
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
      </label>
      {children}
    </div>
  );
}
