// bal24 v2 — STEP-MEMBER-REPORT-PORTAL § 2 목표성과 결과표

import { useEffect, useState } from 'react';
import { Plus, Trash2, Save } from 'lucide-react';
import { Button } from '../../components/ui';
import type { PerformanceTarget } from '../../types/performanceReport';

interface Props {
  rows: PerformanceTarget[];
  readOnly: boolean;
  saving: boolean;
  onSave: (rows: PerformanceTarget[]) => Promise<boolean>;
}

interface DraftRow {
  id?: string;
  metric_name: string;
  planned_value: string;
  actual_value: string;
}

function calcRate(plan: string, actual: string): number | null {
  const p = Number(plan.replace(/,/g, ''));
  const a = Number(actual.replace(/,/g, ''));
  if (!Number.isFinite(p) || p <= 0) return null;
  if (!Number.isFinite(a)) return null;
  return Math.round((a / p) * 1000) / 10;
}

export default function ReportTargetSection({ rows, readOnly, saving, onSave }: Props) {
  const [drafts, setDrafts] = useState<DraftRow[]>([]);

  useEffect(() => {
    setDrafts(rows.map((r) => ({
      id: r.id,
      metric_name: r.metric_name,
      planned_value: r.planned_value ?? '',
      actual_value: r.actual_value ?? '',
    })));
  }, [rows]);

  const updateRow = (idx: number, key: keyof DraftRow, val: string) => {
    setDrafts((p) => p.map((r, i) => (i === idx ? { ...r, [key]: val } : r)));
  };

  const addRow = () => {
    setDrafts((p) => [...p, { metric_name: '', planned_value: '', actual_value: '' }]);
  };

  const removeRow = (idx: number) => {
    setDrafts((p) => p.filter((_, i) => i !== idx));
  };

  const handleSave = () => {
    const payload: PerformanceTarget[] = drafts.map((d, idx) => ({
      id: d.id ?? '',
      report_id: '',
      metric_name: d.metric_name.trim() || `항목 ${idx + 1}`,
      planned_value: d.planned_value || null,
      actual_value: d.actual_value || null,
      achievement_rate: calcRate(d.planned_value, d.actual_value),
      sort_order: idx,
      created_at: '',
    }));
    void onSave(payload);
  };

  return (
    <section className="rounded-2xl border border-violet-100 bg-white p-5 space-y-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
      <header className="flex items-center justify-between gap-2">
        <h2 className="text-base font-bold text-[#1E1B4B]">② 목표성과 결과표</h2>
        {!readOnly && (
          <Button variant="outline" size="sm" leftIcon={<Save size={12} />} onClick={handleSave} loading={saving}>
            저장
          </Button>
        )}
      </header>

      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">구분</th>
              <th className="text-right px-3 py-2 font-semibold">계획</th>
              <th className="text-right px-3 py-2 font-semibold">실적</th>
              <th className="text-right px-3 py-2 font-semibold whitespace-nowrap">달성율</th>
              {!readOnly && <th className="w-10" aria-hidden="true" />}
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {drafts.map((d, idx) => {
              const rate = calcRate(d.planned_value, d.actual_value);
              return (
                <tr key={idx}>
                  <td className="px-3 py-1.5">
                    <input value={d.metric_name} onChange={(e) => updateRow(idx, 'metric_name', e.target.value)} disabled={readOnly}
                      placeholder="예) 매출액" className="w-full rounded-md border border-slate-200 px-2 py-1 text-sm disabled:opacity-60" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={d.planned_value} onChange={(e) => updateRow(idx, 'planned_value', e.target.value)} disabled={readOnly}
                      placeholder="0" className="w-full text-right rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums disabled:opacity-60" />
                  </td>
                  <td className="px-3 py-1.5">
                    <input value={d.actual_value} onChange={(e) => updateRow(idx, 'actual_value', e.target.value)} disabled={readOnly}
                      placeholder="0" className="w-full text-right rounded-md border border-slate-200 px-2 py-1 text-sm tabular-nums disabled:opacity-60" />
                  </td>
                  <td className="px-3 py-1.5 text-right text-xs font-semibold text-violet-700 tabular-nums">
                    {rate != null ? `${rate}%` : '-'}
                  </td>
                  {!readOnly && (
                    <td className="px-2 py-1.5 text-center">
                      <button type="button" onClick={() => removeRow(idx)} className="text-slate-400 hover:text-rose-500" aria-label="행 삭제">
                        <Trash2 size={14} />
                      </button>
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {!readOnly && (
        <button type="button" onClick={addRow}
          className="inline-flex items-center gap-1 text-xs text-violet-700 hover:bg-violet-50 px-2 py-1 rounded-md">
          <Plus size={12} /> 항목 추가
        </button>
      )}
    </section>
  );
}
