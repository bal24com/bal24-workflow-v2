// 급여 관리 메인 페이지 — 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28)
// 4탭 구조: 직원 관리 / 급여대장 / 급여명세서 / 지출결의서

import { useState } from 'react';
import { Users, UserCog, Table2, FileText, Receipt } from 'lucide-react';
import EmployeeTab from './EmployeeTab';
import PayrollRegisterTab from './PayrollRegisterTab';
import PayrollSlipTab from './PayrollSlipTab';
import ExpenseClaimTab from './ExpenseClaimTab';
// 박경수님 + SkyClaw STEP-RBAC-SETUP (2026-05-28) — 재무 권한 가드 (admin/finance 만)
import { useFinanceGuard, FinanceGuardLoader } from '../../hooks/useFinanceGuard';

type TabKey = 'employee' | 'register' | 'slip' | 'claim';

const TABS: Array<{ key: TabKey; label: string; Icon: typeof Users }> = [
  { key: 'employee', label: '직원 관리', Icon: UserCog },
  { key: 'register', label: '급여대장', Icon: Table2 },
  { key: 'slip', label: '급여명세서', Icon: FileText },
  { key: 'claim', label: '지출결의서', Icon: Receipt },
];

export default function PayrollMgmtPage() {
  const [tab, setTab] = useState<TabKey>('employee');
  // 박경수님 + SkyClaw STEP-RBAC-SETUP (2026-05-28) — 재무·관리자만 진입 허용
  const { loading, allowed } = useFinanceGuard();
  if (loading) return <FinanceGuardLoader />;
  if (!allowed) return null;

  return (
    <div className="space-y-5 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <Users size={22} aria-hidden="true" />
        급여 관리
      </h1>

      <nav role="tablist" aria-label="급여 관리 탭" className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {TABS.map(({ key, label, Icon }) => {
          const active = tab === key;
          return (
            <button key={key} type="button" role="tab" aria-selected={active} onClick={() => setTab(key)}
              className={`inline-flex items-center gap-1.5 px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap ${active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'}`}>
              <Icon size={14} aria-hidden="true" />
              {label}
            </button>
          );
        })}
      </nav>

      <div role="tabpanel">
        {tab === 'employee' && <EmployeeTab />}
        {tab === 'register' && <PayrollRegisterTab />}
        {tab === 'slip' && <PayrollSlipTab />}
        {tab === 'claim' && <ExpenseClaimTab />}
      </div>
    </div>
  );
}
