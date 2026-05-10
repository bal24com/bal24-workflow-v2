// bal24 v2 — STEP-PROGRAM-CREATION-WIZARD 신청·지원금 카드
// application_type / 신청 기간·정원 / grant_enabled / grant_budget 통합 입력.

import CardShell, { Field, inputClass } from './CardShell';
import { APPLICATION_TYPE_LABELS } from '../../../../constants/programTypes';
import type { ProgramEditForm, ApplicationType } from '../programEditUtils';

interface Props {
  form: ProgramEditForm;
  onChange: <K extends keyof ProgramEditForm>(key: K, value: ProgramEditForm[K]) => void;
  errorField?: keyof ProgramEditForm;
}

const APPLICATION_TYPE_VALUES: ApplicationType[] = ['open', 'evaluation'];

export default function ApplicationCard({ form, onChange, errorField }: Props) {
  const isEvaluation = form.application_type === 'evaluation';
  return (
    <CardShell
      step="⑧"
      title="신청·지원금"
      description="모집 방식과 지원금 관리 옵션을 설정해요."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="신청 방식" required>
          <select
            value={form.application_type}
            onChange={(e) => onChange('application_type', e.target.value as ApplicationType)}
            className={inputClass}
          >
            {APPLICATION_TYPE_VALUES.map((v) => (
              <option key={v} value={v}>{APPLICATION_TYPE_LABELS[v]}</option>
            ))}
          </select>
        </Field>
        <Field label="지원금 관리" hint="활성화 시 예산 입력 칸이 노출돼요">
          <label className="inline-flex items-center gap-2 px-3 py-2 rounded-xl border border-violet-100 bg-white cursor-pointer hover:border-violet-300">
            <input
              type="checkbox"
              checked={form.grant_enabled}
              onChange={(e) => onChange('grant_enabled', e.target.checked)}
              className="w-4 h-4 rounded text-violet-600 focus:ring-violet-300"
            />
            <span className="text-sm text-[#1E1B4B]">
              {form.grant_enabled ? '사용 중' : '사용 안 함'}
            </span>
          </label>
        </Field>
      </div>

      {isEvaluation && (
        <div className="rounded-xl bg-violet-50/40 border border-violet-100 p-3 space-y-3">
          <p className="text-[11px] font-bold text-violet-700">📋 평가형 선발 — 신청 기간·인원</p>
          <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
            <Field label="신청 시작일">
              <input
                type="date"
                value={form.application_start_date}
                onChange={(e) => onChange('application_start_date', e.target.value)}
                className={inputClass}
              />
            </Field>
            <Field label="신청 종료일">
              <input
                type="date"
                value={form.application_end_date}
                onChange={(e) => onChange('application_end_date', e.target.value)}
                className={`${inputClass} ${errorField === 'application_end_date' ? 'border-rose-400 focus:border-rose-500' : ''}`}
              />
            </Field>
            <Field label="선발 인원" hint="비워두면 무제한">
              <input
                type="number"
                inputMode="numeric"
                value={form.max_applicants}
                onChange={(e) => onChange('max_applicants', e.target.value)}
                placeholder="예) 30"
                className={`${inputClass} ${errorField === 'max_applicants' ? 'border-rose-400 focus:border-rose-500' : ''}`}
              />
            </Field>
          </div>
        </div>
      )}

      {form.grant_enabled && (
        <div className="rounded-xl bg-amber-50/50 border border-amber-100 p-3">
          <Field label="지원금 예산 (원)" hint="총 배정 예산. 예) 5,000,000">
            <input
              type="number"
              inputMode="numeric"
              value={form.grant_budget}
              onChange={(e) => onChange('grant_budget', e.target.value)}
              placeholder="예) 5000000"
              className={`${inputClass} ${errorField === 'grant_budget' ? 'border-rose-400 focus:border-rose-500' : ''}`}
            />
          </Field>
        </div>
      )}
    </CardShell>
  );
}
