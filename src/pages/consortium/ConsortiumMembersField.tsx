// bal24 v2 — 컨소시엄 참여사 입력 섹션 (STEP-CON-C: 컨트롤드 패턴)
// 부모가 value 와 onChange 만 넘기면 내부에서 add/remove/update 처리.

import { Plus, Trash2 } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { CONSORTIUM_ROLE_VALUES } from './consortiumStatus';
import type { Client, ConsortiumRole } from '../../types/database';

type ClientOption = Pick<Client, 'id' | 'name'>;

export interface MemberDraft {
  uid: string;
  clientId: string;
  role: ConsortiumRole | '';
  shareRatio: string;
  responsibilities: string;
}

export function makeMember(): MemberDraft {
  const uid = typeof crypto !== 'undefined' && crypto.randomUUID
    ? crypto.randomUUID()
    : `${Date.now()}_${Math.random()}`;
  return { uid, clientId: '', role: '', shareRatio: '', responsibilities: '' };
}

interface Props {
  value: MemberDraft[];
  onChange: (next: MemberDraft[]) => void;
  clients: ClientOption[];
  loadingRefs: boolean;
  submitting: boolean;
}

const SELECT_CLASS =
  'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

export default function ConsortiumMembersField({
  value, onChange, clients, loadingRefs, submitting,
}: Props) {
  const handleAdd = () => onChange([...value, makeMember()]);
  const handleRemove = (uid: string) => {
    if (value.length <= 1) return;
    onChange(value.filter((m) => m.uid !== uid));
  };
  const handleUpdate = (uid: string, patch: Partial<MemberDraft>) => {
    onChange(value.map((m) => (m.uid === uid ? { ...m, ...patch } : m)));
  };

  return (
    <section className="space-y-3">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">
          참여사 ({value.filter((m) => m.clientId).length})
        </h3>
        <Button
          type="button"
          variant="outline"
          size="sm"
          leftIcon={<Plus size={12} />}
          onClick={handleAdd}
          disabled={submitting}
        >
          참여사 추가
        </Button>
      </div>

      <div className="space-y-3">
        {value.map((m, idx) => (
          <div key={m.uid} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-3">
            <div className="flex items-center justify-between">
              <span className="text-xs font-semibold text-slate-500">참여사 #{idx + 1}</span>
              {value.length > 1 && (
                <button
                  type="button"
                  onClick={() => handleRemove(m.uid)}
                  disabled={submitting}
                  className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5"
                  aria-label={`참여사 #${idx + 1} 삭제`}
                >
                  <Trash2 size={14} />
                </button>
              )}
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
              <div className="space-y-1.5 sm:col-span-2">
                <label className="text-sm font-semibold text-slate-700">고객사</label>
                <select
                  value={m.clientId}
                  onChange={(e) => handleUpdate(m.uid, { clientId: e.target.value })}
                  disabled={submitting || loadingRefs}
                  className={SELECT_CLASS}
                >
                  <option value="">{loadingRefs ? '불러오는 중…' : '선택 없음'}</option>
                  {clients.map((c) => (
                    <option key={c.id} value={c.id}>{c.name}</option>
                  ))}
                </select>
              </div>

              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">역할</label>
                <select
                  value={m.role}
                  onChange={(e) => handleUpdate(m.uid, { role: e.target.value as ConsortiumRole | '' })}
                  disabled={submitting}
                  className={SELECT_CLASS}
                >
                  <option value="">선택 없음</option>
                  {CONSORTIUM_ROLE_VALUES.map((r) => (
                    <option key={r} value={r}>{r}</option>
                  ))}
                </select>
              </div>
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Input
                label="지분율 (%)"
                inputMode="decimal"
                value={m.shareRatio}
                onChange={(e) => handleUpdate(m.uid, { shareRatio: e.target.value })}
                disabled={submitting}
                placeholder="예) 30"
                helperText="0 ~ 100 사이 숫자"
              />
              <Input
                label="담당업무"
                value={m.responsibilities}
                onChange={(e) => handleUpdate(m.uid, { responsibilities: e.target.value })}
                disabled={submitting}
                placeholder="예) 콘텐츠 기획 / 운영"
              />
            </div>
          </div>
        ))}
      </div>

      <p className="text-xs text-muted">고객사를 선택하지 않은 행은 저장되지 않아요.</p>
    </section>
  );
}
