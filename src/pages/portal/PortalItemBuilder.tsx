// bal24 v2 — 포털 항목 동적 빌더 (Template/Create 둘 다 사용)

import { Plus, Trash2, ArrowUp, ArrowDown } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import {
  AUTO_DATA_KEYS, AUTO_DATA_LABELS, ITEM_TYPE_LABELS, PORTAL_ITEM_TYPES, makeTempUid,
} from './portalConstants';
import type { PortalAutoDataKey, PortalItemType } from '../../types/database';

export type ItemDraft = {
  uid: string;
  itemType: PortalItemType;
  label: string;
  description: string;
  autoDataKey: PortalAutoDataKey | '';
  approvalText: string;
  required: boolean;
};

export function makeItemDraft(itemType: PortalItemType = 'file_download'): ItemDraft {
  return {
    uid: makeTempUid(),
    itemType,
    label: ITEM_TYPE_LABELS[itemType],
    description: '',
    autoDataKey: itemType === 'auto_data' ? 'applications' : '',
    approvalText: itemType === 'approval' ? '본 내용에 동의합니다.' : '',
    required: false,
  };
}

type Props = {
  items: ItemDraft[];
  onChange: (next: ItemDraft[]) => void;
  disabled?: boolean;
  /** 각 행 아래에 추가 컨트롤 (file_download의 파일 첨부 등) 렌더 */
  renderExtras?: (item: ItemDraft, idx: number) => React.ReactNode;
};

export default function PortalItemBuilder({ items, onChange, disabled, renderExtras }: Props) {
  const update = (uid: string, patch: Partial<ItemDraft>) => {
    onChange(items.map((i) => (i.uid === uid ? { ...i, ...patch } : i)));
  };
  const add = () => onChange([...items, makeItemDraft()]);
  const remove = (uid: string) => onChange(items.filter((i) => i.uid !== uid));
  const move = (idx: number, dir: -1 | 1) => {
    const target = idx + dir;
    if (target < 0 || target >= items.length) return;
    const next = [...items];
    [next[idx], next[target]] = [next[target], next[idx]];
    onChange(next);
  };

  const onTypeChange = (uid: string, t: PortalItemType) => {
    const cur = items.find((i) => i.uid === uid);
    update(uid, {
      itemType: t,
      label: cur?.label && cur.label !== ITEM_TYPE_LABELS[cur.itemType]
        ? cur.label : ITEM_TYPE_LABELS[t],
      autoDataKey: t === 'auto_data' ? (cur?.autoDataKey || 'applications') : '',
      approvalText: t === 'approval' ? (cur?.approvalText || '본 내용에 동의합니다.') : '',
    });
  };

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between">
        <h3 className="text-xs font-bold text-slate-500 uppercase tracking-wide">항목 ({items.length})</h3>
        <Button type="button" variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={add} disabled={disabled}>
          항목 추가
        </Button>
      </div>

      {items.length === 0 ? (
        <p className="text-xs text-muted text-center py-6 bg-slate-50/40 rounded-xl border border-dashed border-slate-200">
          항목이 없어요. "항목 추가" 버튼으로 시작하세요.
        </p>
      ) : (
        <div className="space-y-2">
          {items.map((it, idx) => (
            <div key={it.uid} className="rounded-xl border border-slate-200 bg-slate-50/40 p-3 space-y-2">
              <div className="flex items-center justify-between">
                <span className="text-xs font-semibold text-slate-500">#{idx + 1} · {ITEM_TYPE_LABELS[it.itemType]}</span>
                <div className="flex items-center gap-0.5">
                  <button type="button" onClick={() => move(idx, -1)} disabled={disabled || idx === 0}
                    className="p-1 rounded text-slate-400 hover:text-text disabled:opacity-30" aria-label="위로"><ArrowUp size={12} /></button>
                  <button type="button" onClick={() => move(idx, 1)} disabled={disabled || idx === items.length - 1}
                    className="p-1 rounded text-slate-400 hover:text-text disabled:opacity-30" aria-label="아래로"><ArrowDown size={12} /></button>
                  <button type="button" onClick={() => remove(it.uid)} disabled={disabled}
                    className="p-1 rounded text-slate-400 hover:text-danger hover:bg-danger/5" aria-label="삭제"><Trash2 size={12} /></button>
                </div>
              </div>

              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">유형</label>
                  <select value={it.itemType} onChange={(e) => onTypeChange(it.uid, e.target.value as PortalItemType)}
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                    {PORTAL_ITEM_TYPES.map((t) => (<option key={t} value={t}>{ITEM_TYPE_LABELS[t]}</option>))}
                  </select>
                </div>
                <Input label="제목" value={it.label} onChange={(e) => update(it.uid, { label: e.target.value })} disabled={disabled} />
              </div>

              <Input label="설명 (선택)" value={it.description} onChange={(e) => update(it.uid, { description: e.target.value })} disabled={disabled} />

              {it.itemType === 'auto_data' && (
                <div className="space-y-1.5">
                  <label className="text-sm font-semibold text-slate-700">데이터 소스</label>
                  <select value={it.autoDataKey} onChange={(e) => update(it.uid, { autoDataKey: e.target.value as PortalAutoDataKey })}
                    disabled={disabled}
                    className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
                    {AUTO_DATA_KEYS.map((k) => (<option key={k} value={k}>{AUTO_DATA_LABELS[k]}</option>))}
                  </select>
                </div>
              )}

              {it.itemType === 'approval' && (
                <Input label="동의 문구" value={it.approvalText} onChange={(e) => update(it.uid, { approvalText: e.target.value })}
                  disabled={disabled} placeholder="본 내용에 동의합니다." />
              )}

              <label className="flex items-center gap-2 text-xs">
                <input type="checkbox" checked={it.required} onChange={(e) => update(it.uid, { required: e.target.checked })}
                  disabled={disabled} className="w-3.5 h-3.5 rounded border-slate-300 text-primary focus:ring-primary/30" />
                <span className="font-semibold text-slate-700">필수 항목</span>
              </label>

              {renderExtras?.(it, idx)}
            </div>
          ))}
        </div>
      )}
    </section>
  );
}
