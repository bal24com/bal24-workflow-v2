// bal24 v2 — 고객사 담당자 행 (ClientFormModal에서 분리, 400줄 제한 준수)

import { Trash2 } from 'lucide-react';
import { Input } from '../../components/ui';
import type { Profile } from '../../types/database';

export type ContactDraft = {
  uid: string;
  name: string;
  position: string;
  mainDuties: string;
  phoneMobile: string;
  phoneOffice: string;
  email: string;
  linkedProfileId: string;
};

export function makeContact(): ContactDraft {
  return {
    uid: typeof crypto !== 'undefined' && crypto.randomUUID
      ? crypto.randomUUID() : `${Date.now()}_${Math.random()}`,
    name: '', position: '', mainDuties: '',
    phoneMobile: '', phoneOffice: '', email: '', linkedProfileId: '',
  };
}

type Props = {
  contact: ContactDraft;
  index: number;
  canRemove: boolean;
  profiles: Pick<Profile, 'id' | 'name'>[];
  onUpdate: (uid: string, patch: Partial<ContactDraft>) => void;
  onRemove: (uid: string) => void;
  disabled?: boolean;
};

export default function ContactRow({
  contact: c, index, canRemove, profiles, onUpdate, onRemove, disabled,
}: Props) {
  return (
    <div className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-3">
      <div className="flex items-center justify-between">
        <span className="text-xs font-semibold text-slate-500">담당자 #{index + 1}</span>
        {canRemove && (
          <button
            type="button"
            onClick={() => onRemove(c.uid)}
            disabled={disabled}
            className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5"
            aria-label={`담당자 #${index + 1} 삭제`}
          >
            <Trash2 size={14} />
          </button>
        )}
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="이름" value={c.name} onChange={(e) => onUpdate(c.uid, { name: e.target.value })} disabled={disabled} placeholder="예) 홍길동" />
        <Input label="직책" value={c.position} onChange={(e) => onUpdate(c.uid, { position: e.target.value })} disabled={disabled} placeholder="예) 차장" />
        <Input label="주요업무" value={c.mainDuties} onChange={(e) => onUpdate(c.uid, { mainDuties: e.target.value })} disabled={disabled} placeholder="예) 교육 운영" />
      </div>
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-3">
        <Input label="휴대폰" value={c.phoneMobile} onChange={(e) => onUpdate(c.uid, { phoneMobile: e.target.value })} disabled={disabled} placeholder="010-0000-0000" />
        <Input label="사무실" value={c.phoneOffice} onChange={(e) => onUpdate(c.uid, { phoneOffice: e.target.value })} disabled={disabled} />
        <Input label="이메일" type="email" value={c.email} onChange={(e) => onUpdate(c.uid, { email: e.target.value })} disabled={disabled} />
      </div>
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">내부직원 매칭</label>
        <select
          value={c.linkedProfileId}
          onChange={(e) => onUpdate(c.uid, { linkedProfileId: e.target.value })}
          disabled={disabled}
          className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
        >
          <option value="">선택 없음</option>
          {profiles.map((p) => (<option key={p.id} value={p.id}>{p.name}</option>))}
        </select>
      </div>
    </div>
  );
}
