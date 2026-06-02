// 박경수님 2026-06-02 — 프로젝트 포털 역할별 노출 항목 제어 패널.
// 4종 역할(operator·supporter·beneficiary_org·participant) 탭별로 portal_items.visible_roles 토글 + 일괄 저장.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, EyeOff, Eye } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { ROLE_LABEL, ITEM_TYPE_LABEL, type PortalRole } from '../../portal/portalUtils';

interface ItemRow {
  id: string;
  title: string | null;
  label: string | null;
  item_type: string;
  visible_roles: string[] | null;
  sort_order: number | null;
}

interface Props {
  portalId: string;
}

const ROLE_TABS: Exclude<PortalRole, 'admin'>[] = ['operator', 'supporter', 'beneficiary_org', 'participant'];

/** 항목의 visible_roles 가 null/미설정이면 모든 역할 허용으로 간주. portalUtils.filterByRole 과 동일 정책. */
function isVisibleForRole(item: ItemRow, role: PortalRole): boolean {
  const roles = item.visible_roles ?? ['admin', 'operator', 'supporter', 'beneficiary_org', 'participant'];
  return roles.includes(role);
}

export default function PortalExposePanel({ portalId }: Props) {
  const toast = useToast();
  const [items, setItems] = useState<ItemRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [activeRole, setActiveRole] = useState<Exclude<PortalRole, 'admin'>>('operator');
  // 변경된 항목 id 집합 — 저장 시 update 대상
  const [dirtyIds, setDirtyIds] = useState<Set<string>>(new Set());

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('portal_items')
      .select('id, title, label, item_type, visible_roles, sort_order')
      .eq('portal_id', portalId)
      .order('sort_order');
    if (error) {
      console.error('[PortalExposePanel] 항목 조회 실패:', error.message);
      toast.error('노출 항목을 불러오지 못했어요.');
      setLoading(false);
      return;
    }
    setItems((data ?? []) as ItemRow[]);
    setDirtyIds(new Set());
    setLoading(false);
  }, [portalId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  function toggleItemForRole(itemId: string, role: PortalRole, next: boolean) {
    setItems((prev) => prev.map((it) => {
      if (it.id !== itemId) return it;
      const current = it.visible_roles ?? ['admin', 'operator', 'supporter', 'beneficiary_org', 'participant'];
      const updated = next
        ? Array.from(new Set([...current, role]))
        : current.filter((r) => r !== role);
      return { ...it, visible_roles: updated };
    }));
    setDirtyIds((prev) => new Set(prev).add(itemId));
  }

  async function handleSave() {
    if (dirtyIds.size === 0) { toast.error('변경된 항목이 없어요.'); return; }
    setSaving(true);
    const updates = items.filter((it) => dirtyIds.has(it.id));
    let failed = 0;
    for (const it of updates) {
      const { error } = await supabase
        .from('portal_items')
        .update({ visible_roles: it.visible_roles ?? [] })
        .eq('id', it.id);
      if (error) {
        console.error('[PortalExposePanel] 저장 실패:', it.id, error.message);
        failed += 1;
      }
    }
    setSaving(false);
    if (failed > 0) { toast.error('저장에 실패했습니다.'); return; }
    toast.success('노출 항목이 저장되었습니다.');
    void reload();
  }

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between flex-wrap gap-2">
        <h3 className="text-sm font-bold text-[#1E1B4B]">👁 역할별 노출 항목 ({items.length})</h3>
        <button type="button" onClick={() => void handleSave()} disabled={saving || dirtyIds.size === 0}
          className="inline-flex items-center gap-1 px-3 h-8 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
          {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} aria-hidden="true" />}
          저장하기{dirtyIds.size > 0 && ` (${dirtyIds.size})`}
        </button>
      </div>

      <p className="text-[11px] text-slate-500">
        체크된 항목만 해당 역할의 외부 화면에 표시돼요. 체크 해제 후 [저장하기] 를 눌러야 반영됩니다.
      </p>

      {/* 역할 탭 */}
      <nav role="tablist" className="flex flex-wrap items-center gap-1 border-b border-slate-200 -mb-px">
        {ROLE_TABS.map((role) => {
          const active = activeRole === role;
          return (
            <button key={role} type="button" role="tab" aria-selected={active}
              onClick={() => setActiveRole(role)}
              className={[
                'inline-flex items-center gap-1.5 px-3 py-1.5 text-xs font-semibold border-b-2 transition-colors',
                active ? 'text-violet-700 border-violet-600' : 'text-slate-500 border-transparent hover:text-violet-600',
              ].join(' ')}>
              {ROLE_LABEL[role]}
            </button>
          );
        })}
      </nav>

      {/* 항목 체크박스 */}
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : items.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-6">아직 등록된 체크리스트 항목이 없어요.</p>
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 gap-1.5">
          {items.map((it) => {
            const checked = isVisibleForRole(it, activeRole);
            const title = it.title ?? it.label ?? '(제목 없음)';
            const isDirty = dirtyIds.has(it.id);
            return (
              <li key={it.id}>
                <label className={`flex items-center gap-2 rounded-xl border px-3 py-2 cursor-pointer transition-colors ${
                  checked
                    ? 'border-violet-200 bg-violet-50/40 hover:bg-violet-50'
                    : 'border-slate-200 bg-white hover:bg-slate-50'
                } ${isDirty ? 'ring-2 ring-amber-200' : ''}`}>
                  <input type="checkbox" checked={checked}
                    onChange={(e) => toggleItemForRole(it.id, activeRole, e.target.checked)}
                    className="w-4 h-4 rounded border-violet-200 text-violet-600 focus:ring-violet-300 cursor-pointer" />
                  <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700 shrink-0">
                    {ITEM_TYPE_LABEL[it.item_type] ?? it.item_type}
                  </span>
                  <span className={`flex-1 text-xs font-semibold truncate ${checked ? 'text-[#1E1B4B]' : 'text-slate-400'}`}>
                    {title}
                  </span>
                  {checked ? (
                    <Eye size={12} className="text-violet-500 shrink-0" aria-hidden="true" />
                  ) : (
                    <EyeOff size={12} className="text-slate-300 shrink-0" aria-hidden="true" />
                  )}
                </label>
              </li>
            );
          })}
        </ul>
      )}
    </section>
  );
}
