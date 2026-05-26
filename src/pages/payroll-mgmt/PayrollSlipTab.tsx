// 급여명세서 탭 (개인별 조회) — 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28)
// 직원 선택 + 월 선택 → 해당 명세서 표시.

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';

interface EmpOpt { id: string; employee_no: string | null; profile: { name: string } | null }
interface Slip {
  id: string; base_salary: number;
  national_pension: number; health_insurance: number; long_term_care: number;
  employment_insurance: number; income_tax: number; local_income_tax: number;
  total_payment: number; total_deduction: number; net_payment: number;
  register: { year: number; month: number; payment_date: string | null } | null;
}

export default function PayrollSlipTab() {
  const now = new Date();
  const [employees, setEmployees] = useState<EmpOpt[]>([]);
  const [empId, setEmpId] = useState('');
  const [year, setYear] = useState(now.getFullYear());
  const [month, setMonth] = useState(now.getMonth() + 1);
  const [slip, setSlip] = useState<Slip | null>(null);
  const [loading, setLoading] = useState(false);

  useEffect(() => {
    void supabase.from('employee_details')
      .select('id, employee_no, profile:profiles!employee_details_profile_id_fkey(name)')
      .is('deleted_at', null).order('employee_no')
      .then(({ data }) => {
        const list = (data ?? []) as unknown as EmpOpt[];
        setEmployees(list); if (list.length > 0 && !empId) setEmpId(list[0].id);
      });
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  const reload = useCallback(async () => {
    if (!empId) return;
    setLoading(true);
    const { data: reg } = await supabase.from('payroll_registers').select('id').eq('year', year).eq('month', month).maybeSingle();
    if (!reg) { setSlip(null); setLoading(false); return; }
    const { data, error } = await supabase.from('payroll_slips')
      .select('*, register:payroll_registers!payroll_slips_register_id_fkey(year, month, payment_date)')
      .eq('register_id', (reg as { id: string }).id).eq('employee_id', empId).maybeSingle();
    setLoading(false);
    if (error) { console.error('[PayrollSlipTab] 조회 실패:', error.message); setSlip(null); return; }
    setSlip((data as Slip | null) ?? null);
  }, [empId, year, month]);

  useEffect(() => { void reload(); }, [reload]);

  const empName = employees.find((e) => e.id === empId)?.profile?.name ?? '-';

  return (
    <div className="space-y-4">
      <div className="flex items-center gap-2 flex-wrap">
        <h3 className="text-sm font-bold text-slate-800 inline-flex items-center gap-1.5"><FileText size={14} aria-hidden="true" />급여명세서</h3>
        <select value={empId} onChange={(e) => setEmpId(e.target.value)} className="h-8 rounded-lg border border-slate-200 px-2 text-xs">
          {employees.map((e) => <option key={e.id} value={e.id}>{e.employee_no ? `[${e.employee_no}] ` : ''}{e.profile?.name ?? '-'}</option>)}
        </select>
        <select value={year} onChange={(e) => setYear(Number(e.target.value))} className="h-8 rounded-lg border border-slate-200 px-2 text-xs">
          {Array.from({ length: 5 }, (_, i) => now.getFullYear() - 2 + i).map((y) => <option key={y} value={y}>{y}년</option>)}
        </select>
        <select value={month} onChange={(e) => setMonth(Number(e.target.value))} className="h-8 rounded-lg border border-slate-200 px-2 text-xs">
          {Array.from({ length: 12 }, (_, i) => i + 1).map((m) => <option key={m} value={m}>{m}월</option>)}
        </select>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-slate-400"><Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" /> 불러오는 중…</div>
      ) : !slip ? (
        <p className="text-center py-8 text-xs text-slate-400">{year}년 {month}월 {empName} 명세서가 없어요. 급여대장에서 먼저 생성하세요.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 p-5 max-w-2xl mx-auto space-y-4">
          <header className="text-center border-b border-slate-200 pb-3">
            <h4 className="text-lg font-bold text-slate-800">{year}년 {month}월 급여명세서</h4>
            <p className="text-xs text-slate-500 mt-1">{empName} · 지급일 {slip.register?.payment_date ?? '미정'}</p>
          </header>
          <div className="grid grid-cols-2 gap-3 text-sm">
            <Row label="기본급" value={slip.base_salary} tone="default" />
            <Row label="지급액계" value={slip.total_payment} tone="primary" />
            <Row label="국민연금" value={slip.national_pension} tone="muted" />
            <Row label="건강보험" value={slip.health_insurance} tone="muted" />
            <Row label="장기요양" value={slip.long_term_care} tone="muted" />
            <Row label="고용보험" value={slip.employment_insurance} tone="muted" />
            <Row label="소득세" value={slip.income_tax} tone="muted" />
            <Row label="지방소득세" value={slip.local_income_tax} tone="muted" />
          </div>
          <div className="border-t border-slate-200 pt-3 grid grid-cols-2 gap-3">
            <Row label="공제합계" value={slip.total_deduction} tone="rose" />
            <Row label="차인지급액" value={slip.net_payment} tone="violet" />
          </div>
        </div>
      )}
    </div>
  );
}

function Row({ label, value, tone }: { label: string; value: number; tone: 'default' | 'primary' | 'muted' | 'rose' | 'violet' }) {
  const cls = tone === 'primary' ? 'text-slate-800 font-bold' : tone === 'muted' ? 'text-slate-500 text-xs' : tone === 'rose' ? 'text-rose-600 font-bold' : tone === 'violet' ? 'text-violet-700 font-bold' : 'text-slate-800';
  return (
    <div className="flex items-center justify-between">
      <span className={tone === 'muted' ? 'text-xs text-slate-500' : 'text-sm text-slate-600'}>{label}</span>
      <span className={`tabular-nums ${cls}`}>{formatMoney(value)}</span>
    </div>
  );
}
