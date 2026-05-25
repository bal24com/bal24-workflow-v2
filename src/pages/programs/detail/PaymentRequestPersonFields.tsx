// 지급요청 인건비 폼 필드 그룹 (수취인·주민번호·원천세·계좌)
// PaymentRequestFormModal V-1 분리

import { Input } from '../../../components/ui';
import { formatMoney } from '../../../lib/utils';
import { calcTax } from '../../../utils/taxUtils';

export interface PersonValues {
  payee_name: string;
  payee_id_no: string;
  bank_name: string;
  bank_account: string;
  tax_rate_type: '3.3' | '8.8' | '면세' | '없음';
}

export const EMPTY_PERSON: PersonValues = {
  payee_name: '', payee_id_no: '', bank_name: '', bank_account: '', tax_rate_type: '3.3',
};

function maskRrn(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 13);
  if (d.length < 7) return d;
  return `${d.slice(0, 6)}-${d[6]}******`;
}

interface Props {
  values: PersonValues;
  totalAmount: number;
  onChange: (next: PersonValues) => void;
  disabled?: boolean;
}

export default function PaymentRequestPersonFields({ values, totalAmount, onChange, disabled }: Props) {
  const set = <K extends keyof PersonValues>(k: K, v: PersonValues[K]) => onChange({ ...values, [k]: v });
  const calc = calcTax(totalAmount, values.tax_rate_type);

  return (
    <div className="space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/30 p-3">
      <div className="text-xs font-bold text-cyan-700">💼 인건비 (개인)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="수취인명" required value={values.payee_name} onChange={(e) => set('payee_name', e.target.value)} disabled={disabled} placeholder="예) 홍길동" />
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">주민번호</label>
          <input type="text" value={values.payee_id_no} onChange={(e) => set('payee_id_no', e.target.value.replace(/\D/g, '').slice(0, 13))}
            disabled={disabled} placeholder="000000-0000000"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
          {values.payee_id_no && <p className="text-[10px] text-slate-500">표시 마스킹: {maskRrn(values.payee_id_no)}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">원천세 구분</label>
        <select value={values.tax_rate_type} onChange={(e) => set('tax_rate_type', e.target.value as PersonValues['tax_rate_type'])}
          disabled={disabled} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
          <option value="3.3">사업소득 3.3%</option>
          <option value="8.8">기타소득 8.8%</option>
          <option value="면세">면세</option>
          <option value="없음">해당없음</option>
        </select>
      </div>

      <div className="rounded-lg bg-white border border-cyan-200 p-2.5 text-xs space-y-1">
        <div className="flex justify-between text-slate-600">
          <span>세전 합계</span>
          <span className="tabular-nums font-semibold">{formatMoney(totalAmount)}</span>
        </div>
        <div className="flex justify-between text-rose-600">
          <span>└ 원천세 ({values.tax_rate_type})</span>
          <span className="tabular-nums">▲ {formatMoney(calc.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-violet-700 pt-1 border-t border-cyan-100">
          <span>실수령</span>
          <span className="tabular-nums">{formatMoney(calc.netAmount)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="은행명" value={values.bank_name} onChange={(e) => set('bank_name', e.target.value)} disabled={disabled} placeholder="예) 국민은행" />
        <Input label="계좌번호" value={values.bank_account} onChange={(e) => set('bank_account', e.target.value)} disabled={disabled} placeholder="123-456-789" />
      </div>
    </div>
  );
}
