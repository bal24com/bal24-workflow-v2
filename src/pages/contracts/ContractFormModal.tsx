// 수입/계약 등록·수정 모달 — STEP-ACCOUNTING-ALL P2
// 기본정보 + 청구 단계 jsonb + 첨부 + 비고

import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import FileDropZone from '../../components/ui/FileDropZone';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import type {
  BillingScheduleItem, ContractStatus, VatType,
} from '../../types/database';
import type { ContractRow, LinkOption } from './contractUtils';
import { CONTRACT_STATUS_VALUES, LINK_TYPE_LABEL, uploadContractFile } from './contractUtils';
import BillingScheduleEditor from './BillingScheduleEditor';

interface RefOption { id: string; name: string }
interface ProgramOption { id: string; name: string; project_id: string | null }

interface Props {
  open: boolean;
  target: ContractRow | null;
  onClose: () => void;
  onSaved: () => void;
}

const VAT_VALUES: VatType[] = ['과세', '면세', '영세율'];

function emptyForm() {
  return {
    contract_name: '', client_id: '', project_id: '', program_id: '', consortium_id: '',
    contract_amount: '', vat_type: '과세' as VatType, contract_date: '',
    status: '진행중' as ContractStatus, memo: '',
    contract_file_url: '', contract_file_name: '', tax_invoice_url: '', tax_invoice_name: '',
  };
}



export default function ContractFormModal({ open, target, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState(emptyForm());
  const [schedule, setSchedule] = useState<BillingScheduleItem[]>([]);
  const [clients, setClients] = useState<RefOption[]>([]);
  const [projects, setProjects] = useState<RefOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [consortiums, setConsortiums] = useState<RefOption[]>([]);
  const [linkSearch, setLinkSearch] = useState('');
  const [saving, setSaving] = useState(false);
  const [uploadingContract, setUploadingContract] = useState(false);
  const [uploadingTaxInvoice, setUploadingTaxInvoice] = useState(false);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      const [cRes, pRes, gRes, conRes] = await Promise.all([
        supabase.from('clients').select('id, name').is('deleted_at', null).order('name'),
        supabase.from('projects').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('programs').select('id, name, project_id').is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('consortiums').select('id, name').is('deleted_at', null).order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (cRes.error) console.error('[ContractFormModal] clients 조회 실패:', cRes.error.message);
      if (pRes.error) console.error('[ContractFormModal] projects 조회 실패:', pRes.error.message);
      if (gRes.error) console.error('[ContractFormModal] programs 조회 실패:', gRes.error.message);
      if (conRes.error) console.error('[ContractFormModal] consortiums 조회 실패:', conRes.error.message);
      setClients((cRes.data as RefOption[] | null) ?? []);
      setProjects((pRes.data as RefOption[] | null) ?? []);
      setPrograms((gRes.data as ProgramOption[] | null) ?? []);
      setConsortiums((conRes.data as RefOption[] | null) ?? []);
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
        program_id: target.program_id ?? '',
        consortium_id: target.consortium_id ?? '',
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
      // 기존 연결 항목명을 검색창에 표시
      const linkedName =
        target.program?.name ?? target.project?.name ?? target.consortium?.name ?? '';
      const linkedLabel = target.program ? 'program' : target.project ? 'project' : target.consortium ? 'consortium' : null;
      setLinkSearch(linkedLabel && linkedName ? `${LINK_TYPE_LABEL[linkedLabel]}: ${linkedName}` : '');
    } else {
      setForm(emptyForm());
      setSchedule([]);
      setLinkSearch('');
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

  // STEP-ACCOUNTING-FOLLOWUP4 — 프로젝트/프로그램/컨소시엄 통합 검색
  // 계약명 = 선택 항목명 강제 (덮어쓰기). 계약은 셋 중 정확히 하나에만 연결.
  const linkOptions = useMemo<LinkOption[]>(() => {
    const opts: LinkOption[] = [];
    for (const p of projects) {
      opts.push({ key: `project:${p.id}`, type: 'project', id: p.id, name: p.name, display: `프로젝트: ${p.name}` });
    }
    for (const g of programs) {
      opts.push({ key: `program:${g.id}`, type: 'program', id: g.id, name: g.name, display: `프로그램: ${g.name}`, projectId: g.project_id });
    }
    for (const c of consortiums) {
      opts.push({ key: `consortium:${c.id}`, type: 'consortium', id: c.id, name: c.name, display: `컨소시엄: ${c.name}` });
    }
    return opts;
  }, [projects, programs, consortiums]);

  const linkMatches = useMemo(() => {
    const q = linkSearch.trim().toLowerCase();
    if (!q) return linkOptions.slice(0, 12);
    return linkOptions.filter((o) => o.display.toLowerCase().includes(q)).slice(0, 12);
  }, [linkOptions, linkSearch]);

  function selectLink(displayValue: string) {
    setLinkSearch(displayValue);
    // 정확 일치하는 옵션 찾기. 일치 안 하면 form 의 ID 들은 모두 해제.
    const match = linkOptions.find((o) => o.display === displayValue);
    setForm((f) => {
      if (!match) {
        return { ...f, project_id: '', program_id: '', consortium_id: '' };
      }
      const next = { ...f, project_id: '', program_id: '', consortium_id: '' };
      if (match.type === 'project') next.project_id = match.id;
      if (match.type === 'program') {
        next.program_id = match.id;
        // 프로그램은 부모 프로젝트도 자동 설정
        if (match.projectId) next.project_id = match.projectId;
      }
      if (match.type === 'consortium') next.consortium_id = match.id;
      // 계약명 = 선택 항목명 강제 동기화 (덮어쓰기)
      next.contract_name = match.name;
      return next;
    });
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
        program_id: form.program_id || null,
        consortium_id: form.consortium_id || null,
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
        {/* STEP-ACCOUNTING-FOLLOWUP4 — 연결 대상 통합 검색 (프로젝트/프로그램/컨소시엄 중 하나) */}
        <Field label="연결 대상 (프로젝트·프로그램·컨소시엄)" required>
          <div className="relative">
            <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
            <Input
              list="contract-link-options"
              value={linkSearch}
              onChange={(e) => selectLink(e.target.value)}
              placeholder="이름으로 검색 — 예: '아리랑' 입력 후 옵션 선택"
              className="pl-9"
            />
            <datalist id="contract-link-options">
              {linkMatches.map((o) => <option key={o.key} value={o.display} />)}
            </datalist>
          </div>
          <p className="text-[10px] text-slate-400 mt-1">선택한 항목명이 계약명으로 자동 설정됩니다. (계약명 = 선택 항목명 강제 일치)</p>
        </Field>

        <Field label="계약명 (선택한 항목명으로 자동 설정)" required>
          <Input
            value={form.contract_name}
            readOnly
            placeholder="위에서 연결 대상을 선택하면 자동으로 채워져요"
            className="bg-slate-50 cursor-not-allowed"
          />
        </Field>

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

        <BillingScheduleEditor
          schedule={schedule}
          onAdd={addSchedule}
          onUpdate={updateSchedule}
          onRemove={removeSchedule}
        />

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
