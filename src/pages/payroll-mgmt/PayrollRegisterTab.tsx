// 급여대장 탭 — 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28)
// 월별 헤더 + 직원별 슬립 자동 생성. 직전월 슬립값을 새 달에 복사 (소득세 등).

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Table2 } from 'lucide-react';
import { Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import { calcDeductions, calcNetPayment } from './payrollMgmtUtils';

interface RegisterRow { id: string; year: number; month: number; payment_date: string | null; status: string; }
interface SlipRow {
  id: string; register_id: string; employee_id: string;
  base_salary: number; national_pension: number; health_insurance: number;
  employment_insurance: number; long_term_care: number; income_tax: number;
  local_income_tax: number; total_payment: number; total_deduction: number; net_payment: number;
  employee: { id: string; employee_no: string | null; profile: { name: string } | null } | null;
}

export default function PayrollRegisterTab() {
  const toast = useToast();
  const now = new Date();
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [registers, setRegisters] = useState<RegisterRow[]>([]);
  const [register, setRegister] = useState<RegisterRow | null>(null);
  const [slips, setSlips] = useState<SlipRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const [regsRes, curRes] = await Promise.all([
      supabase.from('payroll_registers').select('*').order('year', { ascending: false }).order('month', { ascending: false }),
      supabase.from('payroll_registers').select('*').eq('year', year).eq('month', month).maybeSingle(),
    ]);
    setRegisters((regsRes.data ?? []) as RegisterRow[]);
    const cur = (curRes.data as RegisterRow | null) ?? null;
    setRegister(cur);
    if (cur) {
      const { data: slipData, error: slipErr } = await supabase.from('payroll_slips')
        .select('*, employee:employee_details!payroll_slips_employee_id_fkey(id, employee_no, profile:profiles!employee_details_profile_id_fkey(name))')
        .eq('register_id', cur.id).order('created_at');
      if (slipErr) console.error('[PayrollRegisterTab] 슬립 조회 실패:', slipErr.message);
      setSlips((slipData ?? []) as unknown as SlipRow[]);
    } else { setSlips([]); }
    setLoading(false);
  }, [year, month]);

  useEffect(() => { void reload(); }, [reload]);

  async function createRegister() {
    setCreating(true);
    // 1) register insert
    const { data: regIns, error: regErr } = await supabase.from('payroll_registers').insert({ year, month }).select('*').single();
    if (regErr) { console.error('[PayrollRegisterTab] 대장 생성 실패:', regErr.message); toast.error('급여대장 생성 실패'); setCreating(false); return; }
    // 2) 재직 직원 조회
    const { data: emps } = await supabase.from('employee_details').select('id, base_salary').is('deleted_at', null);
    const employees = (emps ?? []) as Array<{ id: string; base_salary: number }>;
    // 3) 직전월 슬립 (소득세 복사용) — 박경수님 가이드 Plan B
    const prevMonth = month === 1 ? 12 : month - 1;
    const prevYear = month === 1 ? year - 1 : year;
    const { data: prevReg } = await supabase.from('payroll_registers').select('id').eq('year', prevYear).eq('month', prevMonth).maybeSingle();
    const prevTaxMap = new Map<string, { income_tax: number; local_income_tax: number }>();
    if (prevReg) {
      const { data: prevSlips } = await supabase.from('payroll_slips').select('employee_id, income_tax, local_income_tax').eq('register_id', (prevReg as { id: string }).id);
      ((prevSlips ?? []) as Array<{ employee_id: string; income_tax: number; local_income_tax: number }>).forEach((s) => prevTaxMap.set(s.employee_id, { income_tax: s.income_tax, local_income_tax: s.local_income_tax }));
    }
    // 4) 슬립 일괄 생성
    const slipsPayload = employees.map((e) => {
      const d = calcDeductions(e.base_salary);
      const prevTax = prevTaxMap.get(e.id) ?? { income_tax: 0, local_income_tax: 0 };
      const total_deduction = d.total + prevTax.income_tax + prevTax.local_income_tax;
      return { register_id: (regIns as RegisterRow).id, employee_id: e.id, base_salary: e.base_salary, national_pension: d.nationalPension, health_insurance: d.healthInsurance, long_term_care: d.longTermCare, employment_insurance: d.employmentInsurance, income_tax: prevTax.income_tax, local_income_tax: prevTax.local_income_tax, total_payment: e.base_salary, total_deduction, net_payment: calcNetPayment(e.base_salary, total_deduction) };
    });
    if (slipsPayload.length > 0) {
      const { error: slipErr } = await supabase.from('payroll_slips').insert(slipsPayload);
      if (slipErr) console.error('[PayrollRegisterTab] 슬립 insert 실패:', slipErr.message);
    }
    setCreating(false);
    toast.success(`${year}년 ${month}월 급여대장을 생성했어요 (직원 ${employees.length}명).`);
    void reload();
  }

  const totals = slips.reduce((acc, s) => ({ payment: acc.payment + s.total_payment, deduction: acc.deduction + s.total_deduction, net: acc.net + s.net_payment }), { payment: 0, deduction: 0, net: 0 });

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-slate-800 inline-flex items-center gap-1.5"><Table2 size={14} aria-hidden="true" />급여대장</h3>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-8 rounded-lg border border-slate-200 px-2 text-xs">
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-8 rounded-lg border border-slate-200 px-2 text-xs">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
        </select>
        {!register && (
          <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={() => void createRegister()} loading={creating}>새 급여대장 생성</Button>
        )}
        {register && <span className="ml-auto text-[11px] text-slate-500">상태: {register.status} · 등록 {registers.length}개월</span>}
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-slate-400"><Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" /> 불러오는 중…</div>
      ) : !register ? (
        <p className="text-center py-8 text-xs text-slate-400">{year}년 {month}월 급여대장이 없어요. [새 급여대장 생성] 으로 만드세요.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold">사원번호</th>
                <th className="text-left px-3 py-2.5 font-semibold">성명</th>
                <th className="text-right px-3 py-2.5 font-semibold">기본급</th>
                <th className="text-right px-3 py-2.5 font-semibold">국민연금</th>
                <th className="text-right px-3 py-2.5 font-semibold">건강보험</th>
                <th className="text-right px-3 py-2.5 font-semibold">고용보험</th>
                <th className="text-right px-3 py-2.5 font-semibold">장기요양</th>
                <th className="text-right px-3 py-2.5 font-semibold">소득세</th>
                <th className="text-right px-3 py-2.5 font-semibold">지방세</th>
                <th className="text-right px-3 py-2.5 font-semibold">공제합계</th>
                <th className="text-right px-3 py-2.5 font-semibold">차인지급액</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {slips.map((s) => (
                <tr key={s.id} className="hover:bg-violet-50/40">
                  <td className="px-3 py-2 text-xs">{s.employee?.employee_no ?? '-'}</td>
                  <td className="px-3 py-2 text-sm font-semibold">{s.employee?.profile?.name ?? '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(s.base_salary)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.national_pension)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.health_insurance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.employment_insurance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.long_term_care)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.income_tax)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.local_income_tax)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-rose-600">{formatMoney(s.total_deduction)}</td>
                  <td className="px-3 py-2 text-right tabular-nums font-bold text-violet-700">{formatMoney(s.net_payment)}</td>
                </tr>
              ))}
              <tr className="bg-slate-50 font-bold">
                <td className="px-3 py-2" colSpan={2}>합 계</td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.payment)}</td>
                <td className="px-3 py-2 text-right" colSpan={6}></td>
                <td className="px-3 py-2 text-right tabular-nums text-rose-600">{formatMoney(totals.deduction)}</td>
                <td className="px-3 py-2 text-right tabular-nums text-violet-700">{formatMoney(totals.net)}</td>
              </tr>
            </tbody>
          </table>
        </div>
      )}
    </div>
  );
}
