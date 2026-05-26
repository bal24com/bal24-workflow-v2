// 견적서 하단 제경비·기술료·부가세·최종금액 UI — 박경수님 + SkyClaw STEP-ESTIMATE-ADDON-FULL (2026-05-27)

import { useMemo, useState } from 'react';
import { calcEstimateAddon } from './estimateAddonUtils';
import type { EstimateAddonConfig, EstimateAddonResult } from './estimateAddonUtils';

interface Props {
  directTotal: number;
  addonConfig: EstimateAddonConfig;
  onSave: (cfg: EstimateAddonConfig, result: EstimateAddonResult) => Promise<void>;
  readonly?: boolean;
}

export default function EstimateAddonSection({ directTotal, addonConfig, onSave, readonly }: Props) {
  const [cfg, setCfg] = useState<EstimateAddonConfig>(addonConfig);
  const [saving, setSaving] = useState(false);
  const result = useMemo(() => calcEstimateAddon(directTotal, cfg), [directTotal, cfg]);

  async function handleSave() {
    setSaving(true);
    try { await onSave(cfg, result); }
    catch (err) { console.error('[EstimateAddon] 저장 오류:', err); }
    finally { setSaving(false); }
  }

  return (
    <div className="border-t border-slate-200 mt-4 pt-4 space-y-3">
      <div className="flex justify-between text-sm font-medium text-slate-700 px-2">
        <span>직접비 소계</span>
        <span className="tabular-nums">{result.directTotal.toLocaleString()} 원</span>
      </div>

      <AddonRow
        checked={cfg.useOverhead} onCheck={(v) => setCfg((p) => ({ ...p, useOverhead: v }))}
        label={cfg.overheadLabel} onLabel={(v) => setCfg((p) => ({ ...p, overheadLabel: v }))}
        rate={cfg.overheadRate} onRate={(v) => setCfg((p) => ({ ...p, overheadRate: v }))}
        amount={result.overheadAmount} hint="직접비 합계 기준" readonly={readonly} />

      <AddonRow
        checked={cfg.useTechFee} onCheck={(v) => setCfg((p) => ({ ...p, useTechFee: v }))}
        label={cfg.techFeeLabel} onLabel={(v) => setCfg((p) => ({ ...p, techFeeLabel: v }))}
        rate={cfg.techFeeRate} onRate={(v) => setCfg((p) => ({ ...p, techFeeRate: v }))}
        amount={result.techFeeAmount} hint="직접비 합계 기준" readonly={readonly} />

      <div className="border-t border-slate-200 pt-2 flex justify-between text-sm font-semibold px-2">
        <span>공급가액 합계</span>
        <span className="text-violet-700 tabular-nums">{result.supplyTotal.toLocaleString()} 원</span>
      </div>

      <div className="flex items-center gap-2 px-2">
        <input type="checkbox" checked={cfg.useVat} disabled={readonly}
          onChange={(e) => setCfg((p) => ({ ...p, useVat: e.target.checked }))}
          className="w-4 h-4 accent-violet-600" />
        <span className="text-sm text-slate-700 flex-1">부가세 (VAT {cfg.vatRate}%)</span>
        <span className={`text-sm font-medium w-36 text-right tabular-nums ${cfg.useVat ? 'text-slate-800' : 'text-slate-300'}`}>
          {cfg.useVat ? result.vatAmount.toLocaleString() : '-'} 원
        </span>
      </div>

      <div className="border-t-2 border-slate-800 pt-3 flex justify-between text-base font-bold text-slate-900 px-2">
        <span>합계총액</span>
        <span className="tabular-nums">{result.grandTotal.toLocaleString()} 원</span>
      </div>

      {!readonly && (
        <div className="bg-violet-50 rounded-lg p-3 space-y-2">
          <div className="flex items-center justify-between">
            <span className="text-sm text-slate-600">만단위 절사 제안금액</span>
            <div className="flex items-center gap-2">
              <span className="text-sm text-slate-500 tabular-nums">{result.roundedTotal.toLocaleString()} 원</span>
              <button type="button" onClick={() => setCfg((p) => ({ ...p, finalProposalAmount: result.roundedTotal }))}
                className="text-xs px-2 py-1 bg-violet-100 text-violet-700 rounded hover:bg-violet-200">
                자동적용
              </button>
            </div>
          </div>
          <div className="flex items-center gap-2">
            <label className="text-sm font-semibold text-slate-800 whitespace-nowrap">최종 제안금액</label>
            <input type="number" value={cfg.finalProposalAmount ?? ''}
              onChange={(e) => setCfg((p) => ({ ...p, finalProposalAmount: e.target.value ? Number(e.target.value) : null }))}
              placeholder={String(result.roundedTotal)}
              className="flex-1 text-right border border-slate-300 rounded px-3 py-1.5 text-sm font-bold text-slate-900 tabular-nums focus:ring-2 focus:ring-violet-400 focus:outline-none" />
            <span className="text-sm text-slate-700">원</span>
          </div>
          <p className="text-xs text-slate-400">* 직접 수정 가능 · 만단위 절사 기준: {result.roundedTotal.toLocaleString()}원</p>
        </div>
      )}

      {!readonly && (
        <div className="flex justify-end pt-2">
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="px-4 py-2 bg-violet-600 text-white rounded-lg text-sm font-medium hover:bg-violet-700 disabled:opacity-50">
            {saving ? '저장 중…' : '저장하기'}
          </button>
        </div>
      )}
    </div>
  );
}

interface RowProps {
  checked: boolean; onCheck: (v: boolean) => void;
  label: string; onLabel: (v: string) => void;
  rate: number; onRate: (v: number) => void;
  amount: number; hint?: string; readonly?: boolean;
}

function AddonRow({ checked, onCheck, label, onLabel, rate, onRate, amount, hint, readonly }: RowProps) {
  return (
    <div className="flex items-center gap-2 px-2">
      <input type="checkbox" checked={checked} disabled={readonly}
        onChange={(e) => onCheck(e.target.checked)} className="w-4 h-4 accent-violet-600" />
      <input type="text" value={label} disabled={readonly}
        onChange={(e) => onLabel(e.target.value)}
        className="w-20 border border-slate-200 rounded px-2 py-1 text-xs text-slate-700 disabled:bg-slate-50" />
      {hint && <span className="text-xs text-slate-400 flex-1">{hint}</span>}
      <input type="number" min={0} max={300} step={0.5} value={rate}
        disabled={readonly || !checked}
        onChange={(e) => onRate(Number(e.target.value))}
        className="w-16 text-right border border-slate-200 rounded px-2 py-1 text-xs tabular-nums disabled:bg-slate-50" />
      <span className="text-xs text-slate-400">%</span>
      <span className={`text-sm font-medium w-36 text-right tabular-nums ${!checked ? 'text-slate-300' : 'text-slate-800'}`}>
        {checked ? amount.toLocaleString() : '-'} 원
      </span>
    </div>
  );
}
