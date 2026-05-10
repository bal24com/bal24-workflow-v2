// bal24 v2 — STEP-PROGRAM-BUNDLE 기관·부서·교육대상·정원 입력 묶음

import { Input } from '../../components/ui';

export interface ProgramOrgValues {
  clientOrg: string;
  department: string;
  targetAudience: string;
  maxParticipants: string;
}

export const EMPTY_ORG_VALUES: ProgramOrgValues = {
  clientOrg: '',
  department: '',
  targetAudience: '',
  maxParticipants: '',
};

interface Props {
  values: ProgramOrgValues;
  onChange: (next: ProgramOrgValues) => void;
  disabled?: boolean;
}

export default function ProgramOrgFields({ values, onChange, disabled }: Props) {
  const set = <K extends keyof ProgramOrgValues>(key: K, v: ProgramOrgValues[K]) =>
    onChange({ ...values, [key]: v });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <Input
        label="기관/단체명"
        value={values.clientOrg}
        onChange={(e) => set('clientOrg', e.target.value)}
        disabled={disabled}
        placeholder="예) 한국교육개발원"
      />
      <Input
        label="부서"
        value={values.department}
        onChange={(e) => set('department', e.target.value)}
        disabled={disabled}
        placeholder="예) 교육지원팀"
      />
      <Input
        label="교육 대상"
        value={values.targetAudience}
        onChange={(e) => set('targetAudience', e.target.value)}
        disabled={disabled}
        placeholder="예) 중간관리자, 신입사원"
      />
      <Input
        label="모집 정원"
        inputMode="numeric"
        value={values.maxParticipants}
        onChange={(e) => set('maxParticipants', e.target.value)}
        disabled={disabled}
        placeholder="예) 50"
        helperText="장소 정원과 별개. 모집 가능한 최대 인원"
      />
    </div>
  );
}
