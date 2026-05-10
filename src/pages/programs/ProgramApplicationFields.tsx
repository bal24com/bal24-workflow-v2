// bal24 v2 — STEP-PROGRAM-CREATION-WIZARD 신청·지원금 섹션 (ProgramFormModal 분리)
// application_type · 평가형 신청 기간·정원 · grant_enabled · grant_budget.

import { Input } from '../../components/ui';

interface Props {
  applicationType: 'open' | 'evaluation';
  setApplicationType: (v: 'open' | 'evaluation') => void;
  applicationStartDate: string;
  setApplicationStartDate: (v: string) => void;
  applicationEndDate: string;
  setApplicationEndDate: (v: string) => void;
  maxApplicants: string;
  setMaxApplicants: (v: string) => void;
  grantEnabled: boolean;
  setGrantEnabled: (v: boolean) => void;
  grantBudget: string;
  setGrantBudget: (v: string) => void;
  submitting: boolean;
}

export default function ProgramApplicationFields(props: Props) {
  const {
    applicationType, setApplicationType,
    applicationStartDate, setApplicationStartDate,
    applicationEndDate, setApplicationEndDate,
    maxApplicants, setMaxApplicants,
    grantEnabled, setGrantEnabled,
    grantBudget, setGrantBudget,
    submitting,
  } = props;
  return (
    <>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label htmlFor="program-app-type" className="text-sm font-semibold text-slate-700">신청 방식</label>
          <select
            id="program-app-type"
            value={applicationType}
            onChange={(e) => setApplicationType(e.target.value as 'open' | 'evaluation')}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          >
            <option value="open">일반 접수</option>
            <option value="evaluation">평가형 선발</option>
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">지원금 관리</label>
          <label className="inline-flex items-center gap-2 px-4 py-2.5 rounded-xl border border-slate-200 bg-white cursor-pointer hover:border-violet-300">
            <input
              type="checkbox"
              checked={grantEnabled}
              onChange={(e) => setGrantEnabled(e.target.checked)}
              disabled={submitting}
              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-300"
            />
            <span className="text-sm text-slate-800">{grantEnabled ? '사용 중' : '사용 안 함'}</span>
          </label>
        </div>
      </div>

      {applicationType === 'evaluation' && (
        <div className="rounded-xl bg-violet-50/40 border border-violet-100 p-3 space-y-2">
          <p className="text-[11px] font-bold text-violet-700">📋 평가형 선발 — 신청 기간·인원</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Input type="date" label="신청 시작" value={applicationStartDate}
              onChange={(e) => setApplicationStartDate(e.target.value)} disabled={submitting} />
            <Input type="date" label="신청 종료" value={applicationEndDate}
              onChange={(e) => setApplicationEndDate(e.target.value)} disabled={submitting} />
            <Input type="number" label="선발 인원" inputMode="numeric" value={maxApplicants}
              onChange={(e) => setMaxApplicants(e.target.value)} disabled={submitting}
              placeholder="예) 30" helperText="비워두면 무제한" />
          </div>
        </div>
      )}

      {grantEnabled && (
        <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-3">
          <Input type="number" label="지원금 예산 (원)" inputMode="numeric" value={grantBudget}
            onChange={(e) => setGrantBudget(e.target.value)} disabled={submitting}
            placeholder="예) 5000000" helperText="총 배정 예산" />
        </div>
      )}
    </>
  );
}
