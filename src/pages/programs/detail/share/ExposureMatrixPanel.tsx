// 박경수님 2026-06-02 SHARE-UX-2 — PM 통합 노출 관리 패널.
// 4역할 × 항목을 한 표에서 일괄 체크. ShareTab 의 역할별 탭과 동일 visibility 를 공유.

import { useState } from 'react';
import { Loader2, Eye, ChevronDown, ChevronUp } from 'lucide-react';
import { useToast } from '../../../../contexts/ToastContext';
import { supabase } from '../../../../lib/supabase';
import type { ShareAudience, ShareItem, ShareVisibility } from '../../../../types/database';
import {
  SHARE_AUDIENCE_LABEL, SHARE_ITEM_LABEL, ITEMS_BY_AUDIENCE,
} from './visibilityCatalog';

interface Props {
  programId: string;
  visibility: ShareVisibility;
  onChange: (next: ShareVisibility) => void;
}

// 박경수님 2026-06-02 — 4역할만 (기존 client/student/expert 는 deprecated)
const ROLES: ShareAudience[] = ['supporter', 'beneficiary', 'team', 'staff'];

/** 모든 역할의 항목 합집합 — 표의 행 */
function allItems(): ShareItem[] {
  const set = new Set<ShareItem>();
  ROLES.forEach((r) => ITEMS_BY_AUDIENCE[r].forEach((it) => set.add(it)));
  return Array.from(set);
}

function isOn(v: ShareVisibility, aud: ShareAudience, item: ShareItem): boolean {
  return v?.[aud]?.[item] !== false;
}

export default function ExposureMatrixPanel({ programId, visibility, onChange }: Props) {
  const toast = useToast();
  const [open, setOpen] = useState(false);
  const [saving, setSaving] = useState(false);
  const [draft, setDraft] = useState<ShareVisibility>(visibility);
  const [dirty, setDirty] = useState(false);

  const rows = allItems();

  function toggle(aud: ShareAudience, item: ShareItem) {
    // 그 역할이 이 항목을 가질 수 있을 때만 토글 (불가 항목은 회색 처리)
    if (!ITEMS_BY_AUDIENCE[aud].includes(item)) return;
    const cur = isOn(draft, aud, item);
    const next: ShareVisibility = {
      ...draft,
      [aud]: { ...(draft[aud] ?? {}), [item]: !cur },
    };
    setDraft(next);
    setDirty(true);
  }

  async function handleSave() {
    setSaving(true);
    const { error } = await supabase
      .from('program_share')
      .update({ visibility: draft, updated_at: new Date().toISOString() })
      .eq('program_id', programId);
    setSaving(false);
    if (error) {
      console.error('[ExposureMatrixPanel] 저장 실패:', error.message);
      toast.error('노출 항목 저장에 실패했습니다.');
      return;
    }
    toast.success('노출 항목이 저장되었습니다.');
    setDirty(false);
    onChange(draft);
  }

  return (
    <section className="rounded-2xl border border-violet-100 bg-white shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
      <button type="button" onClick={() => setOpen((v) => !v)}
        className="w-full flex items-center justify-between gap-2 px-5 py-3 text-left hover:bg-violet-50/40 rounded-2xl">
        <h3 className="text-sm font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
          <Eye size={14} className="text-violet-600" aria-hidden="true" />
          통합 노출 관리 (4역할 한눈에)
        </h3>
        {open ? <ChevronUp size={16} className="text-slate-500" /> : <ChevronDown size={16} className="text-slate-500" />}
      </button>

      {open && (
        <div className="px-5 pb-4 space-y-3 border-t border-slate-100 pt-3">
          <p className="text-[11px] text-slate-500">
            각 항목을 어떤 역할에게 노출할지 한 표에서 체크해요. 회색 칸은 그 역할에 해당 없는 항목이에요.
          </p>

          <div className="overflow-x-auto">
            <table className="w-full text-xs border-collapse">
              <thead>
                <tr className="text-slate-500">
                  <th className="text-left px-2 py-2 font-semibold sticky left-0 bg-white">항목</th>
                  {ROLES.map((r) => (
                    <th key={r} className="px-2 py-2 font-semibold text-center whitespace-nowrap">
                      {SHARE_AUDIENCE_LABEL[r]}
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {rows.map((item) => (
                  <tr key={item} className="hover:bg-violet-50/30">
                    <td className="px-2 py-2 text-slate-700 font-medium sticky left-0 bg-white">
                      {SHARE_ITEM_LABEL[item]}
                    </td>
                    {ROLES.map((r) => {
                      const applicable = ITEMS_BY_AUDIENCE[r].includes(item);
                      const checked = applicable && isOn(draft, r, item);
                      return (
                        <td key={r} className="px-2 py-2 text-center">
                          {applicable ? (
                            <input type="checkbox" checked={checked}
                              onChange={() => toggle(r, item)}
                              className="w-4 h-4 rounded border-violet-200 text-violet-600 focus:ring-violet-300 cursor-pointer" />
                          ) : (
                            <span className="text-slate-200" aria-hidden="true">—</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>

          <div className="flex justify-end">
            <button type="button" onClick={() => void handleSave()} disabled={saving || !dirty}
              className="inline-flex items-center gap-1 px-4 h-9 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
              {saving ? <Loader2 size={12} className="animate-spin" /> : null}
              저장하기
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
