// 지급요청 운영비/외주 폼 필드 그룹 (거래처 select + 사업자번호·은행·계좌 자동 + 부가세 10%)
// PaymentRequestFormModal V-1 분리

import { useState } from 'react';
import { Input } from '../../../components/ui';
import { formatMoney } from '../../../lib/utils';
import { calcTax } from '../../../utils/taxUtils';

export interface CompanyClient {
  id: string;
  name: string;
  business_number?: string | null;  // clients 의 사업자번호 컬럼
  bank_name?: string | null;
  bank_account?: string | null;
}

export interface CompanyValues {
  client_id: string;           // clients FK
  payee_name: string;          // 자동 채움 (거래처 이름) 또는 직접 입력
  biz_reg_no: string;          // 사업자번호
  bank_name: string;
  bank_account: string;
}

export const EMPTY_COMPANY: CompanyValues = {
  client_id: '', payee_name: '', biz_reg_no: '', bank_name: '', bank_account: '',
};

interface Props {
  values: CompanyValues;
  totalAmount: number;
  clients: CompanyClient[];
  onChange: (next: CompanyValues) => void;
  disabled?: boolean;
}

export default function PaymentRequestCompanyFields({ values, totalAmount, clients, onChange, disabled }: Props) {
  const [manual, setManual] = useState(!values.client_id && !!values.payee_name);
  const set = <K extends keyof CompanyValues>(k: K, v: CompanyValues[K]) => onChange({ ...values, [k]: v });
  // 부가세 10% 포함 — calcTax('10') 사용
  const calc = calcTax(totalAmount, '10');
  const supply = totalAmount - calc.taxAmount;

  function pickClient(id: string) {
    const c = clients.find((x) => x.id === id);
    if (!c) { onChange({ ...values, client_id: '', payee_name: '', biz_reg_no: '', bank_name: '', bank_account: '' }); return; }
    onChange({
      client_id: c.id, payee_name: c.name,
      biz_reg_no: c.business_number ?? '',
      bank_name: c.bank_name ?? '', bank_account: c.bank_account ?? '',
    });
  }

  return (
    <div className="space-y-3 rounded-xl border border-orange-100 bg-orange-50/30 p-3">
      <div className="flex items-center justify-between">
        <div className="text-xs font-bold text-orange-700">🏢 운영비/외주 (업체)</div>
        <label className="inline-flex items-center gap-1 text-[11px] text-slate-600">
          <input type="checkbox" checked={manual} onChange={(e) => { setManual(e.target.checked); if (e.target.checked) set('client_id', ''); }} disabled={disabled} />
          직접 입력 (clients 미등록)
        </label>
      </div>

      {!manual ? (
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">거래처 <span className="text-rose-500">*</span></label>
          <select value={values.client_id} onChange={(e) => pickClient(e.target.value)} disabled={disabled}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
            <option value="">— 선택 —</option>
            {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
          </select>
          <p className="text-[10px] text-slate-400">선택 시 사업자번호·은행·계좌 자동 채움 (clients 등록 정보 기준)</p>
        </div>
      ) : (
        <Input label="거래처명 (직접 입력)" required value={values.payee_name} onChange={(e) => set('payee_name', e.target.value)} disabled={disabled} placeholder="예) (주)홍길동렌탈" />
      )}

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="사업자번호" value={values.biz_reg_no} onChange={(e) => set('biz_reg_no', e.target.value)} disabled={disabled || !manual} placeholder="000-00-00000" />
        <Input label="은행명" value={values.bank_name} onChange={(e) => set('bank_name', e.target.value)} disabled={disabled || !manual} />
      </div>
      <Input label="계좌번호" value={values.bank_account} onChange={(e) => set('bank_account', e.target.value)} disabled={disabled || !manual} />

      <div className="rounded-lg bg-white border border-orange-200 p-2.5 text-xs space-y-1">
        <div className="flex justify-between text-slate-600">
          <span>합계 (부가세 포함)</span>
          <span className="tabular-nums font-semibold">{formatMoney(totalAmount)}</span>
        </div>
        <div className="flex justify-between text-slate-500">
          <span>└ 공급가액</span>
          <span className="tabular-nums">{formatMoney(supply)}</span>
        </div>
        <div className="flex justify-between text-blue-600">
          <span>└ 부가세 10%</span>
          <span className="tabular-nums">{formatMoney(calc.taxAmount)}</span>
        </div>
        <p className="text-[10px] text-slate-500 pt-1">영수증 가격(부가세 포함)을 그대로 입력하면 공급가액·부가세 자동 분리됩니다.</p>
      </div>
    </div>
  );
}
