// bal24 v2 — STEP-MEMBER-REPORT-PORTAL § 1 기본정보 + 정산총괄표

import { useEffect, useState } from 'react';
import { Save } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import type { PerformanceReport } from '../../types/performanceReport';

interface Props {
  report: PerformanceReport;
  readOnly: boolean;
  saving: boolean;
  onSave: (fields: Partial<PerformanceReport>) => Promise<boolean>;
}

export default function ReportBasicSection({ report, readOnly, saving, onSave }: Props) {
  const [companyName, setCompanyName] = useState('');
  const [repName, setRepName] = useState('');
  const [managerName, setManagerName] = useState('');
  const [partnerCompany, setPartnerCompany] = useState('');
  const [totalBudget, setTotalBudget] = useState('');
  const [grantBudget, setGrantBudget] = useState('');
  const [selfBudget, setSelfBudget] = useState('');
  const [totalExecuted, setTotalExecuted] = useState('');
  const [grantExecuted, setGrantExecuted] = useState('');
  const [selfExecuted, setSelfExecuted] = useState('');

  useEffect(() => {
    setCompanyName(report.company_name ?? '');
    setRepName(report.rep_name ?? '');
    setManagerName(report.manager_name ?? '');
    setPartnerCompany(report.partner_company ?? '');
    setTotalBudget(report.total_budget != null ? String(report.total_budget) : '');
    setGrantBudget(report.grant_budget != null ? String(report.grant_budget) : '');
    setSelfBudget(report.self_budget != null ? String(report.self_budget) : '');
    setTotalExecuted(report.total_executed != null ? String(report.total_executed) : '');
    setGrantExecuted(report.grant_executed != null ? String(report.grant_executed) : '');
    setSelfExecuted(report.self_executed != null ? String(report.self_executed) : '');
  }, [report]);

  const toNum = (v: string): number | null => {
    const n = Number(v.replace(/,/g, ''));
    return v.trim() === '' ? null : (Number.isFinite(n) ? n : null);
  };

  const handleSave = () => {
    void onSave({
      company_name: companyName.trim() || null,
      rep_name: repName.trim() || null,
      manager_name: managerName.trim() || null,
      partner_company: partnerCompany.trim() || null,
      total_budget: toNum(totalBudget),
      grant_budget: toNum(grantBudget),
      self_budget: toNum(selfBudget),
      total_executed: toNum(totalExecuted),
      grant_executed: toNum(grantExecuted),
      self_executed: toNum(selfExecuted),
    });
  };

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#1E1B4B]">① 기본정보 및 정산총괄표</h2>
        {!readOnly && (
          <Button variant="outline" size="sm" leftIcon={<Save size={12} />} onClick={handleSave} loading={saving}>
            임시저장
          </Button>
        )}
      </header>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Input label="기업명" required value={companyName} onChange={(e) => setCompanyName(e.target.value)} disabled={readOnly} />
        <Input label="대표자명" value={repName} onChange={(e) => setRepName(e.target.value)} disabled={readOnly} />
        <Input label="담당자명" required value={managerName} onChange={(e) => setManagerName(e.target.value)} disabled={readOnly} />
        <Input label="협업기업 (선택)" value={partnerCompany} onChange={(e) => setPartnerCompany(e.target.value)} disabled={readOnly} />
      </div>

      <div className="rounded-xl border border-violet-100 bg-violet-50/40 p-3 overflow-x-auto">
        <p className="text-xs font-bold text-violet-700 mb-2">정산총괄표 (단위: 원)</p>
        <table className="w-full text-sm">
          <thead className="text-xs text-slate-500">
            <tr>
              <th className="text-left px-2 py-1 font-semibold">구분</th>
              <th className="text-right px-2 py-1 font-semibold">계획</th>
              <th className="text-right px-2 py-1 font-semibold">집행</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-violet-100">
            <BudgetRow label="총사업비" plan={totalBudget} setPlan={setTotalBudget} exec={totalExecuted} setExec={setTotalExecuted} disabled={readOnly} />
            <BudgetRow label="지원금"   plan={grantBudget} setPlan={setGrantBudget} exec={grantExecuted} setExec={setGrantExecuted} disabled={readOnly} />
            <BudgetRow label="자부담"   plan={selfBudget}  setPlan={setSelfBudget}  exec={selfExecuted}  setExec={setSelfExecuted}  disabled={readOnly} />
          </tbody>
        </table>
      </div>
    </section>
  );
}

interface BRow { label: string; plan: string; setPlan: (v: string) => void; exec: string; setExec: (v: string) => void; disabled: boolean }
function BudgetRow({ label, plan, setPlan, exec, setExec, disabled }: BRow) {
  return (
    <tr>
      <td className="px-2 py-1.5 text-xs font-semibold text-[#1E1B4B]">{label}</td>
      <td className="px-2 py-1">
        <input type="number" inputMode="numeric" value={plan} onChange={(e) => setPlan(e.target.value)} disabled={disabled}
          placeholder="0" className="w-full text-right rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums disabled:opacity-60" />
      </td>
      <td className="px-2 py-1">
        <input type="number" inputMode="numeric" value={exec} onChange={(e) => setExec(e.target.value)} disabled={disabled}
          placeholder="0" className="w-full text-right rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums disabled:opacity-60" />
      </td>
    </tr>
  );
}
