// bal24 v2 — STEP-PROGRAM-BUNDLE 기관·부서·교육대상·정원 입력 묶음
// 박경수님 요청 — 기관/단체를 clients 드롭다운으로 (텍스트 자유 입력 폐기)

import { Input } from '../../components/ui';

export interface ProgramOrgValues {
  hostClientId: string;  // 박경수님 요청 — clients.id (선택 없음 = '')
  department: string;
  targetAudience: string;
  maxParticipants: string;
}

export const EMPTY_ORG_VALUES: ProgramOrgValues = {
  hostClientId: '',
  department: '',
  targetAudience: '',
  maxParticipants: '',
};

interface Props {
  values: ProgramOrgValues;
  onChange: (next: ProgramOrgValues) => void;
  clients: Array<{ id: string; name: string }>;
  disabled?: boolean;
}

const SELECT_CLASS = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export default function ProgramOrgFields({ values, onChange, clients, disabled }: Props) {
  const set = <K extends keyof ProgramOrgValues>(key: K, v: ProgramOrgValues[K]) =>
    onChange({ ...values, [key]: v });

  return (
    <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">주관기관 (운영)</label>
        <select value={values.hostClientId} onChange={(e) => set('hostClientId', e.target.value)}
          disabled={disabled} className={SELECT_CLASS}>
          <option value="">선택 안함</option>
          {clients.map((c) => <option key={c.id} value={c.id}>{c.name}</option>)}
        </select>
        <p className="text-[10px] text-slate-400">이 프로그램을 운영·주관하는 기관이에요. (수혜학교·지원기관과 별개) 목록에 없으면 고객사 메뉴에서 먼저 등록하세요.</p>
      </div>
      <Input label="부서" value={values.department} onChange={(e) => set('department', e.target.value)}
        disabled={disabled} placeholder="예) 교육지원팀" />
      <Input label="교육 대상" value={values.targetAudience} onChange={(e) => set('targetAudience', e.target.value)}
        disabled={disabled} placeholder="예) 중간관리자, 신입사원" />
      <Input label="모집 정원" inputMode="numeric" value={values.maxParticipants}
        onChange={(e) => set('maxParticipants', e.target.value)} disabled={disabled} placeholder="예) 50"
        helperText="장소 정원과 별개. 모집 가능한 최대 인원" />
    </div>
  );
}
