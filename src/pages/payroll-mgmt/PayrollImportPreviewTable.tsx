// 급여 파일 임포트 미리보기 테이블 — 박경수님 + SkyClaw STEP-PAYROLL-IMPORT (2026-05-28)
// 분리 컴포넌트 (V-1 보호). 매칭 결과 + 미매칭 수동 선택 + 상세 토글.

import { useState } from 'react';
import { ChevronDown, ChevronUp, AlertCircle, CheckCircle2 } from 'lucide-react';
import { formatMoney } from '../../lib/utils';
import type { ParsedPayrollSlip, EmployeeOption } from './payrollImportUtils';

interface Props {
  slips: ParsedPayrollSlip[];
  employees: EmployeeOption[];
  onMatchChange: (idx: number, employeeId: string | null) => void;
}

export default function PayrollImportPreviewTable({ slips, employees, onMatchChange }: Props) {
  const [expanded, setExpanded] = useState(false);
  const totals = slips.reduce(
    (a, s) => ({ payment: a.payment + s.totalPayment, deduction: a.deduction + s.totalDeduction, net: a.net + s.netPayment }),
    { payment: 0, deduction: 0, net: 0 },
  );
  const unmatchedCount = slips.filter((s) => !s.matchedEmployeeId).length;

  return (
    <div className="space-y-3">
      {unmatchedCount > 0 && (
        <div className="flex items-center gap-2 px-3 py-2 bg-amber-50 border border-amber-200 rounded-lg text-xs text-amber-700">
          <AlertCircle size={13} aria-hidden="true" />
          매칭이 필요한 항목이 {unmatchedCount}건 있어요. 드롭다운으로 직원을 선택해 주세요.
        </div>
      )}

      <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-slate-500 text-xs">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">사원번호</th>
              <th className="text-left px-3 py-2 font-semibold">성명 / 매칭</th>
              <th className="text-right px-3 py-2 font-semibold">기본급</th>
              {expanded && <>
                <th className="text-right px-3 py-2 font-semibold">국민연금</th>
                <th className="text-right px-3 py-2 font-semibold">건강</th>
                <th className="text-right px-3 py-2 font-semibold">장기요양</th>
                <th className="text-right px-3 py-2 font-semibold">고용</th>
                <th className="text-right px-3 py-2 font-semibold">소득세</th>
                <th className="text-right px-3 py-2 font-semibold">지방세</th>
                <th className="text-right px-3 py-2 font-semibold">건강정산</th>
                <th className="text-right px-3 py-2 font-semibold">요양정산</th>
              </>}
              <th className="text-right px-3 py-2 font-semibold">공제합계</th>
              <th className="text-right px-3 py-2 font-semibold">차인지급</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {slips.map((s, idx) => (
              <tr key={idx} className={s.matchedEmployeeId ? '' : 'bg-amber-50/40'}>
                <td className="px-3 py-2 text-xs">{s.employeeNo || '-'}</td>
                <td className="px-3 py-2 text-xs">
                  <div className="flex items-center gap-2">
                    <span className="font-semibold">{s.employeeName}</span>
                    {s.matchedEmployeeId ? (
                      <span className="inline-flex items-center gap-0.5 text-[10px] text-emerald-600">
                        <CheckCircle2 size={10} aria-hidden="true" /> 매칭
                      </span>
                    ) : (
                      <select value="" onChange={(e) => onMatchChange(idx, e.target.value || null)}
                        className="text-[11px] border border-amber-300 rounded px-1 py-0.5">
                        <option value="">── 직원 선택 ──</option>
                        {employees.map((e) => (
                          <option key={e.id} value={e.id}>
                            {e.employee_no ? `[${e.employee_no}] ` : ''}{e.profile?.name ?? '-'}
                          </option>
                        ))}
                      </select>
                    )}
                  </div>
                </td>
                <td className="px-3 py-2 text-right tabular-nums">{formatMoney(s.baseSalary)}</td>
                {expanded && <>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.nationalPension)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.healthInsurance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.longTermCare)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.employmentInsurance)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.incomeTax)}</td>
                  <td className="px-3 py-2 text-right tabular-nums text-xs">{formatMoney(s.localIncomeTax)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums text-xs ${s.healthAdjustment < 0 ? 'text-emerald-600' : ''}`}>{formatMoney(s.healthAdjustment)}</td>
                  <td className={`px-3 py-2 text-right tabular-nums text-xs ${s.careAdjustment < 0 ? 'text-emerald-600' : ''}`}>{formatMoney(s.careAdjustment)}</td>
                </>}
                <td className="px-3 py-2 text-right tabular-nums text-rose-600">{formatMoney(s.totalDeduction)}</td>
                <td className="px-3 py-2 text-right tabular-nums font-bold text-violet-700">{formatMoney(s.netPayment)}</td>
              </tr>
            ))}
            <tr className="bg-slate-50 font-bold">
              <td className="px-3 py-2" colSpan={2}>합 계 ({slips.length}명)</td>
              <td className="px-3 py-2 text-right tabular-nums">{formatMoney(totals.payment)}</td>
              {expanded && <td className="px-3 py-2" colSpan={8}></td>}
              <td className="px-3 py-2 text-right tabular-nums text-rose-600">{formatMoney(totals.deduction)}</td>
              <td className="px-3 py-2 text-right tabular-nums text-violet-700">{formatMoney(totals.net)}</td>
            </tr>
          </tbody>
        </table>
      </div>

      <button type="button" onClick={() => setExpanded((p) => !p)}
        className="inline-flex items-center gap-1 text-xs text-violet-600 hover:underline">
        {expanded ? <><ChevronUp size={12} aria-hidden="true" />상세 항목 접기</> : <><ChevronDown size={12} aria-hidden="true" />상세 항목 보기 (공제 전체)</>}
      </button>
    </div>
  );
}
