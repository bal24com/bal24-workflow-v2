// bal24 v2 — 프로그램 수정 풀 페이지 · ② 시간·공개 설정
// start_date·end_date·status·venue·capacity.

import CardShell, { Field, inputClass } from './CardShell';
import { PROGRAM_STATUS_VALUES } from '../../programStatus';
import type { ProgramStatus } from '../../../../types/database';
import type { ProgramEditForm } from '../programEditUtils';

interface Props {
  form: ProgramEditForm;
  onChange: <K extends keyof ProgramEditForm>(key: K, value: ProgramEditForm[K]) => void;
  errorField?: keyof ProgramEditForm;
}

export default function ScheduleCard({ form, onChange, errorField }: Props) {
  return (
    <CardShell
      step="②"
      title="시간·공개 설정"
      description="진행 기간 · 장소 · 정원 · 상태."
    >
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="시작일">
          <input
            type="date"
            value={form.start_date}
            onChange={(e) => onChange('start_date', e.target.value)}
            className={inputClass}
          />
        </Field>
        <Field label="종료일">
          <input
            type="date"
            value={form.end_date}
            onChange={(e) => onChange('end_date', e.target.value)}
            className={`${inputClass} ${errorField === 'end_date' ? 'border-rose-400 focus:border-rose-500' : ''}`}
          />
        </Field>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <Field label="장소">
          <input
            type="text"
            value={form.venue}
            onChange={(e) => onChange('venue', e.target.value)}
            placeholder="예) 서울 코엑스 컨퍼런스홀 3F"
            className={inputClass}
          />
        </Field>
        <Field label="정원" hint="명 — 비어 있으면 미지정">
          <input
            type="text"
            inputMode="numeric"
            value={form.capacity}
            onChange={(e) => onChange('capacity', e.target.value)}
            placeholder="예) 40"
            className={`${inputClass} ${errorField === 'capacity' ? 'border-rose-400 focus:border-rose-500' : ''}`}
          />
        </Field>
      </div>

      <Field label="상태">
        <select
          value={form.status}
          onChange={(e) => onChange('status', e.target.value as ProgramStatus)}
          className={inputClass}
        >
          {PROGRAM_STATUS_VALUES.map((v) => (
            <option key={v} value={v}>
              {v}
            </option>
          ))}
        </select>
      </Field>
    </CardShell>
  );
}
