// 프로그램 [지급요청] 모달 — 신규/수정 통합 + 인건비/업체 폼 분기
// 박경수님 보고 fix:
// - 수정 시 program_id 등 누락 → null 덮어쓰기로 행 사라짐
// - payload 에 undefined 필드 포함 시 Supabase 가 null 로 저장
// - PaymentRequestPersonFields (인건비) / PaymentRequestCompanyFields (업체) 분리

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import PaymentRequestPersonFields, { EMPTY_PERSON, type PersonValues } from './PaymentRequestPersonFields';
import PaymentRequestCompanyFields, { EMPTY_COMPANY, type CompanyClient, type CompanyValues } from './PaymentRequestCompanyFields';
// 박경수님 + SkyClaw 2026-05-26 — 견적 항목 동적 로드
import { useEstimateCategories } from '../../../hooks/useEstimateCategories';
import { isPersonCategory } from '../../payroll/payrollUtils';

type Group = 'outsource' | 'operation';

export interface PaymentTarget {
  id: string;
  expense_type: string;
  description: string | null;
  payee_name: string | null;
  payee_id_no: string | null;
  bank_name: string | null;
  bank_account: string | null;
  unit_price: number;
  quantity: number;
  tax_rate_type: string | null;
  paid_at: string | null;
  memo: string | null;
  program_id: string | null;
  project_id: string | null;
  client_id?: string | null;
  biz_reg_no?: string | null;
}

interface Props {
  open: boolean;
  programId: string;
  projectId: string | null;
  group: Group;
  /** 박경수님 요청 — 수정 모드. null/undefined 면 신규 */
  target?: PaymentTarget | null;
  onClose: () => void;
  onSaved: () => void;
}

// 박경수님 + SkyClaw — 견적 항목이 없을 때 fallback 기본값. 견적 등록 후에는 견적 카테고리가 우선.
const FALLBACK_CATEGORY_BY_GROUP: Record<Group, string[]> = {
  outsource: ['강사료', '촬영', '통역', '번역', '외주개발', '컨설팅', '기타외주'],
  operation: ['호텔', '버스', '재료비', '식비', '장비', '인쇄', '운영비', '기타'],
};

// 박경수님 보고 fix (2026-05-26) — isPersonCategory 는 payrollUtils 로 통일 (PaymentSummaryCards·PaymentRequestTab 공용).
function filterByGroup(cats: string[], group: Group): string[] {
  if (group === 'outsource') return cats.filter(isPersonCategory);
  return cats.filter((c) => !isPersonCategory(c));
}

function buildExpenseType(group: Group, category: string, custom: string): string {
  const c = category === '기타' ? (custom.trim() || '기타') : category;
  if (group === 'operation') return c === '운영비' ? '운영비' : `운영비-${c}`;
  return c;
}

// 박경수님 요청 — payload 에서 undefined 필드 제거 (Supabase 가 null 로 저장 방지)
function cleanPayload<T extends Record<string, unknown>>(obj: T): Partial<T> {
  return Object.fromEntries(Object.entries(obj).filter(([, v]) => v !== undefined)) as Partial<T>;
}

export default function PaymentRequestFormModal({ open, programId, projectId, group, target, onClose, onSaved }: Props) {
  const toast = useToast();
  const isEdit = !!target;
  // 박경수님 + SkyClaw — 견적 항목·세항목 동적 로드 (fallback merge + 그룹 필터)
  const { categories: estimateCats, descriptionsByCategory, loading: catsLoading } = useEstimateCategories(programId, projectId);
  const categoryOptions = useMemo(() => {
    const fromEstimate = filterByGroup(estimateCats, group);
    const fallback = FALLBACK_CATEGORY_BY_GROUP[group];
    // 견적 항목 우선, fallback 으로 누락 보강. 마지막은 항상 '기타' (직접 입력).
    const merged = Array.from(new Set([...fromEstimate, ...fallback]));
    const withoutEtc = merged.filter((c) => c !== '기타');
    return [...withoutEtc, '기타'];
  }, [estimateCats, group]);
  const [category, setCategory] = useState(categoryOptions[0]);
  const [customCategory, setCustomCategory] = useState('');
  const [description, setDescription] = useState('');
  const [unitPrice, setUnitPrice] = useState('');
  const [quantity, setQuantity] = useState('1');
  const [paidAt, setPaidAt] = useState('');
  const [memo, setMemo] = useState('');
  const [person, setPerson] = useState<PersonValues>(EMPTY_PERSON);
  const [company, setCompany] = useState<CompanyValues>(EMPTY_COMPANY);
  const [clients, setClients] = useState<CompanyClient[]>([]);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    setErrorMsg(null);
    // 신규 vs 수정 prefill
    if (target) {
      // 수정 모드 — target 기반 prefill (undefined 안전)
      const ty = target.expense_type ?? '';
      const matched = categoryOptions.find((c) => ty === c || ty.startsWith(`${c}-`) || ty.startsWith(`운영비-${c}`));
      setCategory(matched ?? '기타');
      setCustomCategory(!matched && ty ? ty.replace(/^운영비-/, '') : '');
      setDescription(target.description ?? '');
      setUnitPrice(String(target.unit_price ?? ''));
      setQuantity(String(target.quantity ?? 1));
      setPaidAt(target.paid_at ? target.paid_at.slice(0, 10) : '');
      setMemo(target.memo ?? '');
      setPerson({
        payee_name: target.payee_name ?? '', payee_id_no: target.payee_id_no ?? '',
        bank_name: target.bank_name ?? '', bank_account: target.bank_account ?? '',
        tax_rate_type: (target.tax_rate_type as PersonValues['tax_rate_type']) ?? '3.3',
      });
      setCompany({
        client_id: target.client_id ?? '', payee_name: target.payee_name ?? '',
        biz_reg_no: target.biz_reg_no ?? '',
        bank_name: target.bank_name ?? '', bank_account: target.bank_account ?? '',
        // 박경수님 요청 — vat_mode 복원. DB 의 tax_rate_type 으로 추정 ('면세'/'없음'=none, 그 외=included 기본)
        vat_mode: (target.tax_rate_type === '면세' || target.tax_rate_type === '없음') ? 'none' : 'included',
      });
    } else {
      setCategory(categoryOptions[0]); setCustomCategory(''); setDescription('');
      setUnitPrice(''); setQuantity('1'); setPaidAt(''); setMemo('');
      setPerson(EMPTY_PERSON); setCompany(EMPTY_COMPANY);
    }
    // 거래처 fetch (운영비/외주에서만 사용)
    let cancelled = false;
    void supabase.from('clients').select('id, name, business_number, bank_name, bank_account')
      .is('deleted_at', null).order('name')
      .then(({ data }) => { if (!cancelled) setClients((data ?? []) as CompanyClient[]); });
    return () => { cancelled = true; };
  }, [open, target, group]);

  const finalCategory = category === '기타' ? (customCategory.trim() || '기타') : category;
  const finalExpenseType = buildExpenseType(group, category, customCategory);
  const totalAmount = (Number(unitPrice || 0)) * (Number(quantity || 0));
  // 박경수님 fix (2026-05-26) — 세액·실지급 명시 계산. 운영비는 vat_mode 분기.
  function calcAmounts(group2: Group, taxRate: string, sub: number, vatMode?: CompanyValues['vat_mode']): { tax: number; net: number } {
    if (group2 === 'operation') {
      if (vatMode === 'none') return { tax: 0, net: sub };
      if (vatMode === 'exclusive') { const v = Math.floor(sub * 0.1); return { tax: v, net: sub + v }; }
      return { tax: Math.floor(sub / 11), net: sub }; // included 기본
    }
    if (taxRate === '3.3') { const t = Math.floor(sub * 0.033); return { tax: t, net: sub - t }; }
    if (taxRate === '8.8') { const t = Math.floor(sub * 0.088); return { tax: t, net: sub - t }; }
    return { tax: 0, net: sub };
  }

  async function handleSubmit(e: FormEvent) {
    e.preventDefault();
    setErrorMsg(null);
    // 그룹별 필수 검증
    if (group === 'outsource' && !person.payee_name.trim()) { setErrorMsg('수취인명을 입력해 주세요.'); return; }
    if (group === 'operation' && !company.client_id && !company.payee_name.trim()) { setErrorMsg('거래처를 선택하거나 직접 입력해 주세요.'); return; }
    if (totalAmount <= 0) { setErrorMsg('금액을 입력해 주세요.'); return; }

    setSubmitting(true);
    try {
      const isPerson = group === 'outsource';
      // 박경수님 fix (2026-05-26) — 운영비는 vat_mode 에 따라 tax_rate_type 매핑
      // included/exclusive → '10', none → '면세'
      const taxRate = isPerson
        ? person.tax_rate_type
        : (company.vat_mode === 'none' ? '면세' : '10');
      const amounts = calcAmounts(group, taxRate, totalAmount, isPerson ? undefined : company.vat_mode);
      // 박경수님 보고 fix — tax_amount/net_amount 명시. cleanPayload 로 undefined 제거 (기존 값 null 덮어쓰기 방지).
      const payload = cleanPayload({
        project_id: projectId ?? undefined,
        program_id: programId,
        expense_type: finalExpenseType,
        description: description.trim() || finalCategory,
        payee_name: isPerson ? person.payee_name.trim() : (company.payee_name.trim() || '미정'),
        payee_id_no: isPerson ? (person.payee_id_no.trim() || null) : null,
        bank_name: isPerson ? (person.bank_name.trim() || null) : (company.bank_name.trim() || null),
        bank_account: isPerson ? (person.bank_account.trim() || null) : (company.bank_account.trim() || null),
        unit_price: Number(unitPrice || 0),
        quantity: Number(quantity || 1),
        tax_rate_type: taxRate,
        tax_amount: amounts.tax,           // 박경수님 fix — 명시 (인건비=원천세, 운영비=부가세)
        net_amount: amounts.net,           // 박경수님 fix — 명시 (운영비=합계 그대로)
        paid_at: paidAt || null,
        memo: memo.trim() || null,
        client_id: !isPerson && company.client_id ? company.client_id : undefined,
        biz_reg_no: !isPerson ? (company.biz_reg_no.trim() || undefined) : undefined,
      });

      const res = isEdit
        ? await supabase.from('payroll_expenses').update(payload).eq('id', target!.id)
        : await supabase.from('payroll_expenses').insert({ ...payload, payment_status: '대기' });
      if (res.error) {
        const raw = res.error.message.toLowerCase();
        console.error('[PaymentRequest] 저장 실패:', res.error.message);
        if (raw.includes('row-level security')) setErrorMsg(`저장 권한이 없어요.\n(${res.error.message})`);
        else if (raw.includes('column') && raw.includes('does not exist')) setErrorMsg(`payroll_expenses 컬럼 누락. 마이그레이션 필요.\n(${res.error.message})`);
        else setErrorMsg(`저장 실패: ${res.error.message}`);
        return;
      }
      toast.success(isEdit ? '수정했어요.' : '지급요청을 등록했어요.');
      onSaved(); onClose();
    } finally { setSubmitting(false); }
  }

  const SELECT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';
  const title = `${group === 'outsource' ? '인건비' : '운영비'} ${isEdit ? '수정' : '추가'}`;

  return (
    <Modal open={open} onClose={onClose} title={title} size="md"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={submitting}>취소</Button>
        <Button type="submit" form="payment-request-form" variant="primary" loading={submitting}>{isEdit ? '수정' : '저장'}</Button>
      </>}>
      <form id="payment-request-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700 flex items-center gap-1.5">
              항목 <span className="text-rose-500">*</span>
              {/* 박경수님 + SkyClaw — 견적 카테고리 로드 상태 표시 */}
              {catsLoading && <span className="text-[10px] text-slate-400">(견적 불러오는 중…)</span>}
            </label>
            <select value={category} onChange={(e) => setCategory(e.target.value)} disabled={submitting || catsLoading} className={SELECT_CLASS}>
              {categoryOptions.map((c) => <option key={c} value={c}>{c}</option>)}
            </select>
            {/* 견적 항목 0건이면 안내 */}
            {!catsLoading && filterByGroup(estimateCats, group).length === 0 && (
              <p className="text-[10px] text-slate-400">💡 견적 탭에서 {group === 'outsource' ? '인건비' : '운영비'} 항목을 추가하면 여기 드롭다운에 자동 노출돼요.</p>
            )}
          </div>
          {category === '기타'
            ? <Input label="항목 직접 입력" value={customCategory} onChange={(e) => setCustomCategory(e.target.value)} disabled={submitting} placeholder="예) 통역료" />
            : (
              /* 박경수님 보고 fix (2026-05-26) — 세항목도 견적 description 옵션 자동완성 (datalist) + 자유 입력 */
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">세항목</label>
                <input list={`desc-opts-${category}`} value={description}
                  onChange={(e) => setDescription(e.target.value)} disabled={submitting}
                  placeholder={(descriptionsByCategory[category]?.length ?? 0) > 0
                    ? `예) ${descriptionsByCategory[category][0]} (선택·직접입력)`
                    : '예) 강사 1박 숙박'}
                  className={SELECT_CLASS} />
                <datalist id={`desc-opts-${category}`}>
                  {(descriptionsByCategory[category] ?? []).map((d) => <option key={d} value={d} />)}
                </datalist>
              </div>
            )
          }
        </div>

        <div className="grid grid-cols-2 gap-3">
          <Input type="number" inputMode="numeric" label="단가 (원)" value={unitPrice} onChange={(e) => setUnitPrice(e.target.value)} disabled={submitting} min={0} step={1000} placeholder="0" />
          <Input type="number" label="회수" value={quantity} onChange={(e) => setQuantity(e.target.value)} disabled={submitting} min={1} step={1} />
        </div>

        {/* 박경수님 요청 — expense_type group 기준 분기 (인건비 vs 업체) */}
        {group === 'outsource'
          ? <PaymentRequestPersonFields values={person} totalAmount={totalAmount} onChange={setPerson} disabled={submitting} />
          : <PaymentRequestCompanyFields values={company} totalAmount={totalAmount} clients={clients} onChange={setCompany} disabled={submitting} />
        }

        <Input type="date" label="지급 예정일 (선택)" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} disabled={submitting} />
        <Input label="메모" value={memo} onChange={(e) => setMemo(e.target.value)} disabled={submitting} placeholder="(선택)" />

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-xs text-danger whitespace-pre-wrap">{errorMsg}</div>
        )}
      </form>
    </Modal>
  );
}
