// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 의뢰기관(주관기관·발주처) 섹션.
// 의뢰기관은 컨소시엄 멤버가 아닌 발주처. 역할은 감수·검수만 (선택).

import type { Client } from '../../types/database';
import { CONSORTIUM_LEAD_ROLE_VALUES, type ConsortiumLeadRole } from './consortiumStatus';

type ClientOption = Pick<Client, 'id' | 'name'>;

interface Props {
  leadClientId: string;
  leadRole: ConsortiumLeadRole | '';
  onClientChange: (id: string) => void;
  onRoleChange: (role: ConsortiumLeadRole | '') => void;
  clients: ClientOption[];
  loadingRefs: boolean;
  submitting: boolean;
}

const SELECT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export default function ConsortiumLeadOrgField({
  leadClientId, leadRole, onClientChange, onRoleChange,
  clients, loadingRefs, submitting,
}: Props) {
  return (
    <section className="space-y-3">
      <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">🏛️ 의뢰기관 (주관기관 · 발주처)</h3>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">의뢰기관</label>
          <select
            value={leadClientId}
            onChange={(e) => onClientChange(e.target.value)}
            disabled={submitting || loadingRefs}
            className={SELECT_CLASS}
          >
            <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
            {clients.map((c) => (<option key={c.id} value={c.id}>{c.name}</option>))}
          </select>
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">
            의뢰기관 역할 <span className="text-slate-400 text-xs font-normal">(선택)</span>
          </label>
          <select
            value={leadRole}
            onChange={(e) => onRoleChange(e.target.value as ConsortiumLeadRole | '')}
            disabled={submitting || !leadClientId}
            className={SELECT_CLASS}
          >
            <option value="">선택 없음</option>
            {CONSORTIUM_LEAD_ROLE_VALUES.map((r) => (<option key={r} value={r}>{r}</option>))}
          </select>
        </div>
      </div>
      <p className="text-xs text-muted">
        의뢰기관은 컨소시엄 멤버가 아닌 발주처예요. 역할은 감수·검수 정도로 명시할 수 있어요.
      </p>
    </section>
  );
}
