// 외주/급여 등록·수정 모달 — STEP-ACCOUNTING-FOLLOWUP2
// 단가·회수·세액 자동계산 + 프로그램 연동 + 부가세 옵션 + 카테고리 자유 입력 + 프로젝트 검색

import { useEffect, useMemo, useState } from 'react';
import { Search as SearchIcon } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import { calcTax, TAX_RATE_LABEL, TAX_RATE_VALUES } from '../../utils/taxUtils';
import type {
  PayrollExpenseType, PayrollPaymentStatus, PayrollTaxRateType,
} from '../../types/database';
import {
  PAYROLL_BASE_TYPES, PAYROLL_STATUS_VALUES,
  isOperationType, isOutsourceType, isPersonCategory,
  type PayrollRow,
} from './payrollUtils';
// 박경수님 보고 fix (2026-05-26) — 외주/급여 등록 모달도 견적 카테고리를 datalist 에 노출
import { useEstimateCategories } from '../../hooks/useEstimateCategories';
// 박경수님 보고 fix (2026-05-26) — 수정 모드 증빙 업로드 (receipt_urls 활용)
import PayrollReceiptUpload from './PayrollReceiptUpload';

interface RefOption { id: string; name: string }
interface ProgramOption { id: string; name: string; project_id: string | null }
// STEP-ACCOUNTING-FOLLOWUP7 — 계약 옵션 (선택 시 project/program/consortium/client 자동 prefill)
interface ContractOption { id: string; contract_name: string; project_id: string | null; program_id: string | null; consortium_id: string | null; client_id: string | null }
interface Props { open: boolean; target: PayrollRow | null; defaultType: PayrollExpenseType; defaultContractId?: string; onClose: () => void; onSaved: () => void }

const BANK_OPTIONS = ['국민은행', '신한은행', '우리은행', '하나은행', '농협은행', '기업은행', '카카오뱅크', '토스뱅크', '새마을금고', '우체국', '기타'];

function emptyForm(t: PayrollExpenseType) {
  return { expense_type: t, description: '', payee_name: '', payee_id_no: '', biz_reg_no: '', bank_name: '', bank_account: '', unit_price: '', quantity: '1', tax_rate_type: '3.3' as PayrollTaxRateType, payment_status: '대기' as PayrollPaymentStatus, paid_at: '', project_id: '', program_id: '', contract_id: '', memo: '' };
}

export default function PayrollExpenseFormModal({
  open, target, defaultType, defaultContractId, onClose, onSaved,
}: Props) {
  const toast = useToast();
  const [form, setForm] = useState(() => emptyForm(defaultType));
  const [projects, setProjects] = useState<RefOption[]>([]);
  const [programs, setPrograms] = useState<ProgramOption[]>([]);
  const [contracts, setContracts] = useState<ContractOption[]>([]);
  const [projectSearch, setProjectSearch] = useState('');
  const [saving, setSaving] = useState(false);
  // 박경수님 보고 fix (2026-05-26) — 수정 모드 증빙 (target.receipt_urls 초기값, 즉시 DB 반영)
  const [receiptUrls, setReceiptUrls] = useState<string[]>(target?.receipt_urls ?? []);
  // 박경수님 fix — 견적 카테고리 동적 로드 + PAYROLL_BASE_TYPES merge (중복 제거, 견적 우선)
  const { categories: estimateCats } = useEstimateCategories(form.program_id || null, form.project_id || null);
  const typeOptions = useMemo(() => Array.from(new Set([...estimateCats, ...PAYROLL_BASE_TYPES])), [estimateCats]);

  useEffect(() => {
    if (!open) return;
    let cancelled = false;
    void (async () => {
      // STEP-ACCOUNTING-FOLLOWUP7 — contracts 도 함께 fetch
      const [pRes, gRes, cRes] = await Promise.all([
        supabase.from('projects').select('id, name')
          .is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('programs').select('id, name, project_id')
          .is('deleted_at', null).order('created_at', { ascending: false }),
        supabase.from('income_contracts').select('id, contract_name, project_id, program_id, consortium_id, client_id')
          .is('deleted_at', null).order('created_at', { ascending: false }),
      ]);
      if (cancelled) return;
      if (pRes.error) console.error('[PayrollExpenseFormModal] projects 조회 실패:', pRes.error.message);
      if (gRes.error) console.error('[PayrollExpenseFormModal] programs 조회 실패:', gRes.error.message);
      if (cRes.error) console.error('[PayrollExpenseFormModal] contracts 조회 실패:', cRes.error.message);
      setProjects((pRes.data as RefOption[] | null) ?? []);
      setPrograms((gRes.data as ProgramOption[] | null) ?? []);
      setContracts((cRes.data as ContractOption[] | null) ?? []);
    })();
    return () => { cancelled = true; };
  }, [open]);

  useEffect(() => {
    if (!open) return;
    if (target) {
      setForm({
        expense_type: target.expense_type,
        description: target.description ?? '',
        payee_name: target.payee_name,
        payee_id_no: target.payee_id_no ?? '',
        biz_reg_no: target.biz_reg_no ?? '',
        bank_name: target.bank_name ?? '',
        bank_account: target.bank_account ?? '',
        unit_price: String(target.unit_price ?? ''),
        quantity: String(target.quantity ?? '1'),
        tax_rate_type: target.tax_rate_type,
        payment_status: target.payment_status,
        paid_at: target.paid_at ? target.paid_at.slice(0, 10) : '',
        project_id: target.project_id ?? '',
        program_id: target.program_id ?? '',
        contract_id: target.contract_id ?? '',
        memo: target.memo ?? '',
      });
      const projName = (target as PayrollRow).project?.name;
      setProjectSearch(projName ?? '');
      setReceiptUrls(target.receipt_urls ?? []);
    } else {
      const empty = emptyForm(defaultType);
      // STEP-ACCOUNTING-FOLLOWUP7 — 계약 상세에서 [+ 추가] 로 열린 경우, 그 계약의 정보 자동 prefill
      if (defaultContractId && contracts.length > 0) {
        const c = contracts.find((x) => x.id === defaultContractId);
        if (c) {
          empty.contract_id = c.id;
          if (c.project_id) empty.project_id = c.project_id;
          if (c.program_id) empty.program_id = c.program_id;
        }
      }
      setForm(empty);
      setProjectSearch('');
      setReceiptUrls([]);
    }
  }, [open, target, defaultType, defaultContractId, contracts]);

  // 프로젝트 검색 매칭 (자유 입력 → 후보 목록 필터)
  const projectMatches = useMemo(() => {
    const q = projectSearch.trim().toLowerCase();
    if (!q) return projects.slice(0, 8);
    return projects.filter((p) => p.name.toLowerCase().includes(q)).slice(0, 8);
  }, [projects, projectSearch]);

  // 선택된 project_id 에 묶인 program 목록만 노출
  const programMatches = useMemo(() => {
    if (!form.project_id) return [];
    return programs.filter((g) => g.project_id === form.project_id);
  }, [programs, form.project_id]);

  // 박경수님 + SkyClaw FORM-HARDFIX — 연결계약 select 삭제. 프로그램 onChange 의 자동 연결만 사용.

  const subtotal = useMemo(
    () => (Number(form.unit_price) || 0) * (Number(form.quantity) || 0),
    [form.unit_price, form.quantity],
  );
  const { taxAmount, netAmount } = useMemo(
    () => calcTax(subtotal, form.tax_rate_type),
    [subtotal, form.tax_rate_type],
  );

  async function handleSave() {
    if (!form.payee_name.trim()) { toast.error('성명을 입력해 주세요.'); return; }
    if (!form.unit_price || Number.isNaN(Number(form.unit_price))) {
      toast.error('단가를 숫자로 입력해 주세요.');
      return;
    }
    setSaving(true);
    try {
      // 박경수님 + SkyClaw FORM-HARDFIX — 인건비=payee_id_no / 외주=biz_reg_no. 반대편 컬럼은 null 저장
      const submitIsPerson = isPersonCategory(form.expense_type);
      const payload = {
        expense_type: form.expense_type.trim() || '강사료',
        description: form.description.trim() || null,
        payee_name: form.payee_name.trim(),
        payee_id_no: submitIsPerson ? (form.payee_id_no.trim() || null) : null,
        biz_reg_no: submitIsPerson ? null : (form.biz_reg_no.trim() || null),
        bank_name: form.bank_name || null,
        bank_account: form.bank_account.trim() || null,
        unit_price: Number(form.unit_price) || 0,
        quantity: Number(form.quantity) || 1,
        tax_rate_type: form.tax_rate_type,
        tax_amount: taxAmount,
        net_amount: netAmount,
        payment_status: form.payment_status,
        paid_at: form.paid_at ? new Date(form.paid_at).toISOString() : null,
        project_id: form.project_id || null,
        program_id: form.program_id || null,
        contract_id: form.contract_id || null,
        memo: form.memo.trim() || null,
        updated_at: new Date().toISOString(),
      };
      if (target) {
        const { error } = await supabase.from('payroll_expenses').update(payload).eq('id', target.id);
        if (error) throw error;
        toast.success('수정했어요.');
      } else {
        const { error } = await supabase.from('payroll_expenses').insert(payload);
        if (error) throw error;
        toast.success('등록했어요.');
      }
      onSaved();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[PayrollExpenseFormModal] 저장 오류:', msg);
      toast.error('저장 중 오류가 발생했어요.');
    } finally {
      setSaving(false);
    }
  }

  // 박경수님 + SkyClaw STEP-PAYROLL-FORM-HARDFIX (2026-05-26) — 인건비/외주 인라인 분기
  // isPersonCategory 한글 키워드 매칭 ('인건비'·'강사'·'멘토'·'운영진'·'TA'·'튜터'·'컨설') 활용.
  // expense_type 이 '운영비-숙식 및 임차' 같은 자유 카테고리도 정상 분기됨.
  const isPerson = isPersonCategory(form.expense_type);
  const isCompany = !isPerson;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={target ? '외주/급여 수정' : '신규 등록'}
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
          <Button variant="primary" onClick={() => void handleSave()} loading={saving}>저장하기</Button>
        </div>
      }
    >
      <div className="space-y-4">
        {/* 박경수님 + SkyClaw STEP-PAYROLL-FORM-HARDFIX (2026-05-26) — 연결 계약 select 숨김. */}
        {/* 프로그램 선택 시 백그라운드 자동 연결 (아래 onChange). 사용자 노출 X. */}

        <div className="grid grid-cols-2 gap-3">
          {/* 박경수님 보고 fix (2026-05-26) — 견적 카테고리 동적 + 기본 5개 + 자유 입력 통합 datalist */}
          <Field label="항목 (견적·기본 + 자유 입력)" required>
            <Input
              list="payroll-expense-types"
              value={form.expense_type}
              onChange={(e) => { const t = e.target.value; setForm((p) => ({ ...p, expense_type: t as PayrollExpenseType, tax_rate_type: isOperationType(t) ? '10' : isOutsourceType(t) ? '3.3' : p.tax_rate_type })); }}
              placeholder="예: 강사료, 숙식 및 임차, 운영비-사무용품"
            />
            <datalist id="payroll-expense-types">
              {typeOptions.map((t) => <option key={t} value={t} />)}
            </datalist>
            <p className="text-[10px] text-slate-400 mt-1">{estimateCats.length > 0 ? `📋 견적 ${estimateCats.length}개 + 기본 5개 + 자유 입력` : '💡 프로젝트·프로그램 선택 시 견적 카테고리도 추천돼요'}</p>
          </Field>
          <Field label="연결 프로젝트 (검색 가능)">
            <div className="relative">
              <SearchIcon size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
              <Input
                list="payroll-project-options"
                value={projectSearch}
                onChange={(e) => {
                  setProjectSearch(e.target.value);
                  // 입력 텍스트와 정확히 일치하는 프로젝트 자동 선택
                  const match = projects.find((p) => p.name === e.target.value);
                  setForm((f) => ({ ...f, project_id: match?.id ?? '', program_id: '' }));
                }}
                placeholder="프로젝트명으로 검색"
                className="pl-9"
              />
              <datalist id="payroll-project-options">
                {projectMatches.map((p) => <option key={p.id} value={p.name} />)}
              </datalist>
            </div>
          </Field>
        </div>

        {/* 프로그램 선택 — 프로젝트 선택 시에만 노출, 해당 프로젝트의 프로그램만 */}
        {/* 박경수님 보고 fix (2026-05-26) — 프로그램 선택 시 해당 program_id 의 contract 자동 연결 (1건 한정) */}
        {form.project_id && programMatches.length > 0 && (
          <Field label="연결 프로그램 (선택)">
            <select
              value={form.program_id}
              onChange={(e) => {
                const newProgramId = e.target.value;
                const matchedContract = newProgramId
                  ? contracts.find((c) => c.program_id === newProgramId)
                  : null;
                setForm({
                  ...form,
                  program_id: newProgramId,
                  contract_id: matchedContract?.id ?? form.contract_id,
                });
              }}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">선택 안함</option>
              {programMatches.map((g) => <option key={g.id} value={g.id}>{g.name}</option>)}
            </select>
          </Field>
        )}

        <Field label="내용">
          <Input
            value={form.description}
            onChange={(e) => setForm({ ...form, description: e.target.value })}
            placeholder="예: OT 9/11, KME 강의"
          />
        </Field>

        <div className="grid grid-cols-2 gap-3">
          <Field label={isPerson ? '성명' : '거래처명'} required>
            <Input value={form.payee_name} onChange={(e) => setForm({ ...form, payee_name: e.target.value })} placeholder={isPerson ? '홍길동' : '(주)OO상사'} />
          </Field>
          {/* 박경수님 + SkyClaw FORM-HARDFIX — 주민번호는 인건비만, 사업자번호는 외주만 */}
          {isPerson && (
            <Field label="주민번호 (선택)">
              <Input value={form.payee_id_no} onChange={(e) => setForm({ ...form, payee_id_no: e.target.value })} placeholder="앞 6자리만 노출됩니다" />
            </Field>
          )}
          {isCompany && (
            <Field label="사업자번호 (선택)">
              <Input value={form.biz_reg_no} onChange={(e) => setForm({ ...form, biz_reg_no: e.target.value })} placeholder="000-00-00000" />
            </Field>
          )}
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="은행명">
            <select
              value={form.bank_name}
              onChange={(e) => setForm({ ...form, bank_name: e.target.value })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              <option value="">선택 안함</option>
              {BANK_OPTIONS.map((b) => <option key={b} value={b}>{b}</option>)}
            </select>
          </Field>
          <Field label="계좌번호">
            <Input value={form.bank_account} onChange={(e) => setForm({ ...form, bank_account: e.target.value })} placeholder="123-456789-01-234" />
          </Field>
        </div>

        <div className="grid grid-cols-4 gap-3">
          <Field label="단가" required>
            <Input type="number" value={form.unit_price} onChange={(e) => setForm({ ...form, unit_price: e.target.value })} />
          </Field>
          <Field label="회수" required>
            <Input type="number" value={form.quantity} onChange={(e) => setForm({ ...form, quantity: e.target.value })} />
          </Field>
          <Field label="합계 (자동)">
            <div className="h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm flex items-center font-bold tabular-nums">
              {formatMoney(subtotal)}
            </div>
          </Field>
          <Field label="세액구분">
            <select
              value={form.tax_rate_type}
              onChange={(e) => setForm({ ...form, tax_rate_type: e.target.value as PayrollTaxRateType })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {TAX_RATE_VALUES.map((t) => <option key={t} value={t}>{TAX_RATE_LABEL[t]}</option>)}
            </select>
          </Field>
        </div>

        {/* 박경수님 + SkyClaw FORM-HARDFIX — 인건비=원천세 / 외주=부가세 레이블 + 색상 분기 */}
        <div className="grid grid-cols-2 gap-3">
          <Field label={isPerson ? '원천세 (자동)' : '부가세 (포함)'}>
            <div className={`h-10 rounded-xl border border-slate-200 bg-slate-50 px-3 text-sm flex items-center font-semibold tabular-nums ${isPerson ? 'text-rose-600' : 'text-blue-600'}`}>
              {isPerson ? '-' : '+'}{formatMoney(taxAmount)}
            </div>
          </Field>
          <Field label="실지급액 (자동)">
            <div className="h-10 rounded-xl border border-violet-200 bg-violet-50/40 px-3 text-sm flex items-center text-violet-700 font-bold tabular-nums">
              {formatMoney(netAmount)}
            </div>
          </Field>
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Field label="지급일">
            <Input type="date" value={form.paid_at} onChange={(e) => setForm({ ...form, paid_at: e.target.value })} />
          </Field>
          <Field label="지급상태">
            <select
              value={form.payment_status}
              onChange={(e) => setForm({ ...form, payment_status: e.target.value as PayrollPaymentStatus })}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm"
            >
              {PAYROLL_STATUS_VALUES.map((s) => <option key={s} value={s}>{s}</option>)}
            </select>
          </Field>
        </div>

        <Field label="비고">
          <textarea value={form.memo} onChange={(e) => setForm({ ...form, memo: e.target.value })} rows={2}
            className="w-full rounded-xl border border-slate-200 px-3 py-2 text-sm" placeholder="추가 메모" />
        </Field>

        {/* 박경수님 보고 fix (2026-05-26) — 수정 모드에서만 증빙 업로드 (id 필요). 신규 등록은 저장 후 다시 열어서 업로드 */}
        {target?.id && (
          <PayrollReceiptUpload payrollId={target.id} receiptUrls={receiptUrls} onChange={setReceiptUrls} disabled={saving} />
        )}
        {!target?.id && (
          <p className="text-[10px] text-slate-400">💡 증빙은 저장 후 다시 [수정] 으로 열어 업로드할 수 있어요.</p>
        )}
      </div>
    </Modal>
  );
}

function Field({ label, required, children }: { label: string; required?: boolean; children: React.ReactNode }) {
  return (
    <div>
      <label className="block text-xs font-semibold text-slate-600 mb-1">{label}{required && <span className="text-rose-500 ml-0.5">*</span>}</label>
      {children}
    </div>
  );
}
