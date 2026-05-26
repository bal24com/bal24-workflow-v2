// 내 급여명세서 페이지 — 박경수님 + SkyClaw STEP-PAYROLL-MYPAGE (2026-05-28)
// 본인 employee_details → payroll_slips 조회. 연도 필터 + 행 클릭 → 상세 모달 → PDF 다운로드.

import { useCallback, useEffect, useState } from 'react';
import { FileText, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { formatMoney, formatDateKo } from '../../lib/utils';
import EmptyState from '../../components/EmptyState';
import PayrollSlipDetailModal, { type MySlip } from './PayrollSlipDetailModal';

interface EmployeeInfo { id: string; employee_no: string | null; profile: { name: string } | null }

export default function MyPayrollPage() {
  const { user } = useAuth();
  const [employee, setEmployee] = useState<EmployeeInfo | null>(null);
  const [slips, setSlips] = useState<MySlip[]>([]);
  const [loading, setLoading] = useState(true);
  const [notRegistered, setNotRegistered] = useState(false);
  const [selectedYear, setSelectedYear] = useState<number | null>(null);
  const [selected, setSelected] = useState<MySlip | null>(null);
  const [modalOpen, setModalOpen] = useState(false);

  const reload = useCallback(async () => {
    if (!user) { setLoading(false); return; }
    setLoading(true);
    // 1) 본인 employee_details
    const { data: emp, error: empErr } = await supabase.from('employee_details')
      .select('id, employee_no, profile:profiles!employee_details_profile_id_fkey(name)')
      .eq('profile_id', user.id).is('deleted_at', null).maybeSingle();
    if (empErr) console.error('[MyPayrollPage] employee 조회 실패:', empErr.message);
    if (!emp) { setNotRegistered(true); setLoading(false); return; }
    setEmployee(emp as unknown as EmployeeInfo);
    // 2) 본인 명세서 + register join
    const { data, error } = await supabase.from('payroll_slips')
      .select('*, register:payroll_registers!payroll_slips_register_id_fkey(year, month, payment_date)')
      .eq('employee_id', (emp as { id: string }).id).order('created_at', { ascending: false });
    if (error) console.error('[MyPayrollPage] slips 조회 실패:', error.message);
    setSlips((data ?? []) as unknown as MySlip[]);
    setLoading(false);
  }, [user]);

  useEffect(() => { void reload(); }, [reload]);

  const years = Array.from(new Set(slips.map((s) => s.register?.year).filter(Boolean) as number[])).sort((a, b) => b - a);
  const visible = selectedYear ? slips.filter((s) => s.register?.year === selectedYear) : slips;

  return (
    <div className="space-y-5 max-w-[1100px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <FileText size={22} aria-hidden="true" />
        내 급여명세서
      </h1>

      {loading ? (
        <div className="flex items-center justify-center py-12 text-sm text-slate-400">
          <Loader2 size={16} className="animate-spin mr-2" aria-hidden="true" /> 불러오는 중…
        </div>
      ) : notRegistered ? (
        <EmptyState emoji="📭" title="아직 직원 등록이 되어있지 않아요."
          description="재무 담당자에게 직원 등록을 요청해 주세요. 등록 후 매월 급여대장이 생성되면 여기에 표시됩니다." />
      ) : slips.length === 0 ? (
        <EmptyState emoji="📭" title="아직 등록된 급여명세서가 없어요."
          description="재무 담당자가 매월 급여대장을 생성하면 자동으로 표시됩니다." />
      ) : (
        <>
          <div className="flex items-center gap-2 flex-wrap">
            <span className="text-xs text-slate-500">연도</span>
            <div className="inline-flex rounded-lg border border-slate-200 bg-white p-0.5">
              <button type="button" onClick={() => setSelectedYear(null)}
                className={`px-3 py-1 rounded-md text-xs font-semibold ${selectedYear === null ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>전체</button>
              {years.map((y) => (
                <button key={y} type="button" onClick={() => setSelectedYear(y)}
                  className={`px-3 py-1 rounded-md text-xs font-semibold ${selectedYear === y ? 'bg-violet-600 text-white' : 'text-slate-600 hover:bg-slate-50'}`}>
                  {y}년
                </button>
              ))}
            </div>
          </div>

          <div className="space-y-2">
            {visible.map((s) => (
              <button key={s.id} type="button" onClick={() => { setSelected(s); setModalOpen(true); }}
                className="w-full flex items-center justify-between p-4 bg-white border border-slate-200 rounded-xl hover:bg-violet-50/40 hover:border-violet-200 transition cursor-pointer text-left">
                <div className="space-y-0.5">
                  <span className="text-sm font-bold text-slate-800">{s.register?.year}년 {s.register?.month}월</span>
                  {s.register?.payment_date && (
                    <p className="text-[11px] text-slate-500">지급일 {formatDateKo(s.register.payment_date)}</p>
                  )}
                </div>
                <div className="flex items-center gap-3">
                  <div className="text-right">
                    <p className="text-[10px] text-slate-400">차인지급</p>
                    <p className="text-base font-bold text-violet-700 tabular-nums">{formatMoney(s.net_payment)}</p>
                  </div>
                  <span className="px-3 py-1.5 text-xs border border-violet-300 text-violet-700 rounded-lg group-hover:bg-violet-50">📄 보기</span>
                </div>
              </button>
            ))}
          </div>
        </>
      )}

      <PayrollSlipDetailModal open={modalOpen} slip={selected}
        employeeName={employee?.profile?.name ?? '-'}
        employeeNo={employee?.employee_no ?? ''}
        onClose={() => { setModalOpen(false); setSelected(null); }} />
    </div>
  );
}
