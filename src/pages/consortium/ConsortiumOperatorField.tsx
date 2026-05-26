// 박경수님 2026-05-27 STEP-CONSORTIUM-FORM-V2 — 운영사(밸런스닷·총괄) 섹션.
// 의뢰기관(발주처) 다음, 참여사 위에 위치. clients 드롭다운에서 직접 선택 + 담당자 3필드.

import { Input } from '../../components/ui';
import type { Client } from '../../types/database';
import type { OperatorDraft } from './consortiumMembersUtils';

type ClientOption = Pick<Client, 'id' | 'name'> & { is_own_company?: boolean };

interface Props {
  value: OperatorDraft;
  onChange: (next: OperatorDraft) => void;
  clients: ClientOption[];
  loadingRefs: boolean;
  submitting: boolean;
}

const SELECT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export default function ConsortiumOperatorField({
  value, onChange, clients, loadingRefs, submitting,
}: Props) {
  const patch = (next: Partial<OperatorDraft>) => onChange({ ...value, ...next });

  return (
    <section className="space-y-3">
      <div className="flex items-center gap-2">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          ⭐ 운영사 (총괄)
        </h3>
        <span className="text-[10px] text-slate-400">컨소시엄 총괄 운영 주체 — 보통 밸런스닷(자사)</span>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">운영사 선택</label>
          <select
            value={value.clientId}
            onChange={(e) => patch({ clientId: e.target.value })}
            disabled={submitting || loadingRefs}
            className={SELECT_CLASS}
          >
            <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
            {clients.map((c) => (
              <option key={c.id} value={c.id}>
                {c.is_own_company ? `⭐ ${c.name} (자사)` : c.name}
              </option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">자사(밸런스닷)는 ⭐ 표시로 최상단에 노출돼요.</p>
        </div>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input
          label="담당자 이름"
          value={value.contactName}
          onChange={(e) => patch({ contactName: e.target.value })}
          disabled={submitting}
          placeholder="예) 박경수"
        />
        <Input
          label="담당자 연락처"
          inputMode="tel"
          value={value.contactPhone}
          onChange={(e) => patch({ contactPhone: e.target.value })}
          disabled={submitting}
          placeholder="예) 010-1234-5678"
        />
        <Input
          label="담당자 이메일"
          type="email"
          value={value.contactEmail}
          onChange={(e) => patch({ contactEmail: e.target.value })}
          disabled={submitting}
          placeholder="예) park@balance.com"
        />
      </div>
    </section>
  );
}
