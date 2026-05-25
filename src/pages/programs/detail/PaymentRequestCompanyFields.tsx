// 지급요청 운영비/외주 폼 필드 그룹 (거래처 검색 + 사업자번호·은행·계좌 자동 + 부가세 10%)
// 박경수님 + SkyClaw 2026-05-26 — 거래처 select → 검색·미리보기·임시등록 통합 input

import { useEffect, useRef, useState } from 'react';
import { Input } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/utils';
import { calcTax } from '../../../utils/taxUtils';

export interface CompanyClient {
  id: string;
  name: string;
  business_number?: string | null;
  bank_name?: string | null;
  bank_account?: string | null;
}

export interface CompanyValues {
  client_id: string;
  payee_name: string;
  biz_reg_no: string;
  bank_name: string;
  bank_account: string;
  // 박경수님 요청 (2026-05-26) — 부가세 처리 모드. 폼 state 만 (DB 저장은 tax_rate_type 매핑)
  // included = 입력가가 부가세 포함, exclusive = 공급가(별도), none = 면세/없음
  vat_mode: 'included' | 'exclusive' | 'none';
}

export const EMPTY_COMPANY: CompanyValues = {
  client_id: '', payee_name: '', biz_reg_no: '', bank_name: '', bank_account: '',
  vat_mode: 'included',
};

interface Props {
  values: CompanyValues;
  totalAmount: number;
  clients: CompanyClient[]; // 부모에서 prefetch — 미사용 시에도 prop 유지 (호환)
  onChange: (next: CompanyValues) => void;
  disabled?: boolean;
}

export default function PaymentRequestCompanyFields({ values, totalAmount, clients, onChange, disabled }: Props) {
  const set = <K extends keyof CompanyValues>(k: K, v: CompanyValues[K]) => onChange({ ...values, [k]: v });
  // 박경수님 요청 — vat_mode 별 합계 분기
  // included: 입력가가 부가세 포함 (영수증가) → 공급가 = 입력/1.1, 부가세 = 차액, 실지급 = 입력
  // exclusive: 입력가가 공급가 (부가세 별도) → 부가세 = 입력*0.1 추가, 실지급 = 입력 + 부가세
  // none: 면세 → 부가세 0, 실지급 = 입력
  let supply: number; let vat: number; let payable: number;
  if (values.vat_mode === 'exclusive') {
    supply = totalAmount;
    vat = Math.floor(totalAmount * 0.1);
    payable = supply + vat;
  } else if (values.vat_mode === 'none') {
    supply = totalAmount; vat = 0; payable = totalAmount;
  } else {
    // included (기본) — calcTax('10') 와 동일 결과
    const c = calcTax(totalAmount, '10');
    vat = c.taxAmount;
    supply = totalAmount - vat;
    payable = totalAmount;
  }

  // 거래처 검색 + 미리보기
  const [results, setResults] = useState<CompanyClient[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const [tempSaving, setTempSaving] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  async function runSearch(q: string) {
    setSearching(true);
    const trimmed = q.trim();
    const isPreview = trimmed.length === 0;
    let qBuilder = supabase.from('clients')
      .select('id, name, business_number, bank_name, bank_account')
      .is('deleted_at', null)
      .order('name')
      .limit(isPreview ? 8 : 10);
    if (!isPreview) {
      const like = `%${trimmed}%`;
      qBuilder = qBuilder.or(`name.ilike.${like},business_number.ilike.${like}`);
    }
    const { data, error } = await qBuilder;
    setSearching(false);
    if (error) {
      console.error('[PaymentRequestCompanyFields] 거래처 검색 실패:', error.message);
      // 부모에서 prefetch 한 clients 로 fallback
      setResults(clients.slice(0, 8));
    } else {
      setResults((data ?? []) as CompanyClient[]);
    }
    setShowDropdown(true);
  }

  function handleNameChange(v: string) {
    // 직접 입력 즉시 반영. client_id 는 비움 (선택 해제)
    onChange({ ...values, payee_name: v, client_id: '' });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { void runSearch(v); }, 200);
  }

  function pickClient(c: CompanyClient) {
    onChange({
      client_id: c.id, payee_name: c.name,
      biz_reg_no: c.business_number ?? '',
      bank_name: c.bank_name ?? '', bank_account: c.bank_account ?? '',
      vat_mode: values.vat_mode, // 박경수님 요청 — 부가세 모드 유지
    });
    setShowDropdown(false);
  }

  async function handleTempRegister() {
    const name = values.payee_name.trim();
    if (!name) return;
    setTempSaving(true);
    const { data, error } = await supabase.from('clients')
      .insert({ name, note: '임시등록' })
      .select('id, name, business_number, bank_name, bank_account').single();
    setTempSaving(false);
    if (error || !data) {
      console.error('[PaymentRequestCompanyFields] 임시등록 실패:', error?.message);
      return;
    }
    onChange({
      client_id: data.id, payee_name: data.name,
      biz_reg_no: data.business_number ?? '',
      bank_name: data.bank_name ?? '', bank_account: data.bank_account ?? '',
      vat_mode: values.vat_mode,
    });
    setShowDropdown(false);
  }

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  const exactMatch = results.some((c) => c.name === values.payee_name.trim());

  return (
    <div className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/30 p-3">
      <div className="text-xs font-bold text-orange-700">🏢 운영비/외주 (업체)</div>

      <div className="relative space-y-1.5" ref={wrapperRef}>
        <label className="text-sm font-semibold text-slate-700">
          거래처 <span className="text-rose-500">*</span>
          {values.client_id && <span className="ml-2 text-[10px] text-emerald-600">✓ 등록 거래처 선택됨</span>}
        </label>
        <input type="text" value={values.payee_name}
          onChange={(e) => handleNameChange(e.target.value)}
          onFocus={() => { void runSearch(values.payee_name); }}
          disabled={disabled}
          placeholder="거래처명 클릭/입력 — 등록된 회사 목록"
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
        {showDropdown && (
          <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-64 overflow-y-auto">
            {searching && <div className="px-3 py-2 text-xs text-slate-400">불러오는 중…</div>}
            {!searching && results.length === 0 && (
              <div className="px-3 py-2 text-xs text-slate-400">
                {values.payee_name.trim() ? '검색 결과 없음' : '등록된 거래처가 없어요.'}
              </div>
            )}
            {results.map((c) => (
              <button key={c.id} type="button" onClick={() => pickClient(c)}
                className="block w-full text-left px-3 py-2 text-sm hover:bg-violet-50 border-b border-slate-50">
                <div className="font-semibold text-text">{c.name}</div>
                <div className="text-[10px] text-slate-400">
                  {c.business_number || '사업자번호 미등록'}
                  {c.bank_name && ` · ${c.bank_name} ${c.bank_account ?? ''}`}
                </div>
              </button>
            ))}
            {/* 인라인 임시등록 */}
            {!searching && values.payee_name.trim().length > 0 && !exactMatch && (
              <button type="button" onClick={() => void handleTempRegister()} disabled={tempSaving}
                className="block w-full text-left px-3 py-2.5 text-xs font-bold text-orange-700 bg-orange-50/60 hover:bg-orange-100 border-t border-orange-200">
                {tempSaving ? '등록 중…' : `🆕 "${values.payee_name.trim()}" 거래처로 임시등록`}
              </button>
            )}
          </div>
        )}
        <p className="text-[10px] text-slate-400">선택 시 사업자번호·은행·계좌 자동 채움. 미등록 거래처는 임시등록 후 사용하세요.</p>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="사업자번호" value={values.biz_reg_no} onChange={(e) => set('biz_reg_no', e.target.value)} disabled={disabled} placeholder="000-00-00000" />
        <Input label="은행명" value={values.bank_name} onChange={(e) => set('bank_name', e.target.value)} disabled={disabled} />
      </div>
      <Input label="계좌번호" value={values.bank_account} onChange={(e) => set('bank_account', e.target.value)} disabled={disabled} />

      {/* 박경수님 요청 — 부가세 처리 모드 선택 (3가지) */}
      <div className="rounded-lg bg-white border border-orange-200 p-2.5 text-xs space-y-2">
        <div className="font-bold text-slate-700">부가세 처리</div>
        <div className="flex flex-wrap gap-3">
          {([
            { v: 'included', label: '부가세 포함가 (10% 자동 분리)' },
            { v: 'exclusive', label: '공급가 (10% 별도 추가)' },
            { v: 'none', label: '면세 / 부가세 없음' },
          ] as const).map((o) => (
            <label key={o.v} className="inline-flex items-center gap-1 cursor-pointer">
              <input type="radio" name="vat_mode" disabled={disabled}
                checked={values.vat_mode === o.v}
                onChange={() => set('vat_mode', o.v)}
                className="text-violet-600 focus:ring-violet-500" />
              <span className="text-slate-700">{o.label}</span>
            </label>
          ))}
        </div>
        <div className="border-t border-orange-100 pt-1.5 space-y-1">
          <div className="flex justify-between text-slate-600">
            <span>{values.vat_mode === 'exclusive' ? '입력가 (공급가)' : '입력가'}</span>
            <span className="tabular-nums font-semibold">{formatMoney(totalAmount)}</span>
          </div>
          {values.vat_mode !== 'none' && (
            <>
              <div className="flex justify-between text-slate-500">
                <span>└ 공급가액</span>
                <span className="tabular-nums">{formatMoney(supply)}</span>
              </div>
              <div className="flex justify-between text-blue-600">
                <span>└ 부가세 10%</span>
                <span className="tabular-nums">{values.vat_mode === 'exclusive' ? '+' : ''}{formatMoney(vat)}</span>
              </div>
            </>
          )}
          <div className="flex justify-between font-bold text-violet-700 pt-1 border-t border-orange-100">
            <span>실지급 (총 청구액)</span>
            <span className="tabular-nums">{formatMoney(payable)}</span>
          </div>
        </div>
        <p className="text-[10px] text-slate-500">
          {values.vat_mode === 'included' && '영수증·계산서 가격(부가세 포함)을 그대로 입력하세요.'}
          {values.vat_mode === 'exclusive' && '공급가를 입력하면 부가세 10% 자동 추가 → 총 청구액 계산.'}
          {values.vat_mode === 'none' && '면세 거래·간이과세자 등 부가세가 없는 항목.'}
        </p>
      </div>
    </div>
  );
}
