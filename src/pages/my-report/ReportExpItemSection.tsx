// bal24 v2 — STEP-MEMBER-REPORT-PORTAL § 3 비목별 집행내역

import { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '../../components/ui';
import type { PerformanceExpenditureItem } from '../../types/performanceReport';

interface Props {
  rows: PerformanceExpenditureItem[];
  readOnly: boolean;
  saving: boolean;
  onSave: (rows: PerformanceExpenditureItem[]) => Promise<boolean>;
}

interface DraftRow {
  id?: string;
  category: string;
  sub_category: string;
  grant_budget: string;
  self_budget: string;
  grant_executed: string;
  self_executed: string;
  notes: string;
}

const toNum = (v: string): number | null => {
  if (!v.trim()) return null;
  const n = Number(v.replace(/,/g, ''));
  return Number.isFinite(n) ? n : null;
};
const num = (v: number | null): string => (v == null ? '' : String(v));

export default function ReportExpItemSection({ rows, readOnly, saving, onSave }: Props) {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  useEffect(() => {
    setDrafts(rows.map((r) => ({
      id: r.id,
      category: r.category,
      sub_category: r.sub_category ?? '',
      grant_budget: num(r.grant_budget),
      self_budget: num(r.self_budget),
      grant_executed: num(r.grant_executed),
      self_executed: num(r.self_executed),
      notes: r.notes ?? '',
    })));
  }, [rows]);

  const updateRow = (idx: number, key: keyof DraftRow, val: string) => {
    setDrafts((p) => p.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  };
  const addRow = () => {
    setDrafts((p) => [...p, { category: '', sub_category: '', grant_budget: '', self_budget: '', grant_executed: '', self_executed: '', notes: '' }]);
  };
  const removeRow = (idx: number) => {
    setDrafts((p) => p.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const payload: PerformanceExpenditureItem[] = drafts.map((d, idx) => ({
      id: d.id ?? '',
      report_id: '',
      category: d.category.trim() || `비목 ${idx + 1}`,
      sub_category: d.sub_category.trim() || null,
      grant_budget: toNum(d.grant_budget),
      self_budget: toNum(d.self_budget),
      grant_executed: toNum(d.grant_executed),
      self_executed: toNum(d.self_executed),
      notes: d.notes.trim() || null,
      sort_order: idx,
      created_at: '',
    }));
    void onSave(payload);
  };

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#1E1B4B]">③ 비목별 집행내역</h2>
        {!readOnly && (
          <Button variant="outline" size="sm" leftIcon={<Save size={12} />} onClick={handleSave} loading={saving}>저장</Button>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-xs">
          <thead className="bg-slate-50 text-slate-500">
            <tr>
              <th className="text-left px-2 py-2 font-semibold">비목</th>
              <th className="text-left px-2 py-2 font-semibold">보조세목</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">예산<br/>(지원금)</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">예산<br/>(자부담)</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">집행<br/>(지원금)</th>
              <th className="text-right px-2 py-2 font-semibold whitespace-nowrap">집행<br/>(자부담)</th>
              <th className="text-left px-2 py-2 font-semibold">비고</th>
              {!readOnly && <th className="w-8" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drafts.map((d, idx) => (
              <tr key={idx}>
                <td className="px-2 py-1">
                  <input value={d.category} onChange={(e) => updateRow(idx, 'category', e.target.value)} disabled={readOnly}
                    placeholder="운영비" className="w-full rounded-md border border-slate-200 px-2 py-1 disabled:opacity-60" />
                </td>
                <td className="px-2 py-1">
                  <input value={d.sub_category} onChange={(e) => updateRow(idx, 'sub_category', e.target.value)} disabled={readOnly}
                    placeholder="재료비" className="w-full rounded-md border border-slate-200 px-2 py-1 disabled:opacity-60" />
                </td>
                <td className="px-2 py-1">
                  <input value={d.grant_budget} onChange={(e) => updateRow(idx, 'grant_budget', e.target.value)} disabled={readOnly}
                    placeholder="0" className="w-full text-right rounded-md border border-slate-200 px-2 py-1 tabular-nums disabled:opacity-60" />
                </td>
                <td className="px-2 py-1">
                  <input value={d.self_budget} onChange={(e) => updateRow(idx, 'self_budget', e.target.value)} disabled={readOnly}
                    placeholder="0" className="w-full text-right rounded-md border border-slate-200 px-2 py-1 tabular-nums disabled:opacity-60" />
                </td>
                <td className="px-2 py-1">
                  <input value={d.grant_executed} onChange={(e) => updateRow(idx, 'grant_executed', e.target.value)} disabled={readOnly}
                    placeholder="0" className="w-full text-right rounded-md border border-slate-200 px-2 py-1 tabular-nums disabled:opacity-60" />
                </td>
                <td className="px-2 py-1">
                  <input value={d.self_executed} onChange={(e) => updateRow(idx, 'self_executed', e.target.value)} disabled={readOnly}
                    placeholder="0" className="w-full text-right rounded-md border border-slate-200 px-2 py-1 tabular-nums disabled:opacity-60" />
                </td>
                <td className="px-2 py-1">
                  <input value={d.notes} onChange={(e) => updateRow(idx, 'notes', e.target.value)} disabled={readOnly}
                    className="w-full rounded-md border border-slate-200 px-2 py-1 disabled:opacity-60" />
                </td>
                {!readOnly && (
                  <td className="px-1 py-1 text-center">
                    <button type="button" onClick={() => removeRow(idx)} className="text-slate-400 hover:text-rose-500" aria-label="행 삭제">
                      <Trash2 size={12} />
                    </button>
                  </td>
                )}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <button type="button" onClick={addRow}
          className="inline-flex items-center gap-1 text-xs text-violet-700 hover:bg-violet-50 px-2 py-1 rounded-md">
          <Plus size={12} /> 비목 추가
        </button>
      )}
    </section>
  );
}
