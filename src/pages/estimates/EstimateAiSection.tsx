// 견적서 AI 자동 추출 + 미리보기 영역 (EstimateTab V-1 분리)
// STEP-ACCOUNTING-FOLLOWUP7-Phase3

import { Sparkles, Upload, Plus } from 'lucide-react';
import { Button } from '../../components/ui';
import type { ExtractedEstimateItem } from './estimateExtract';

interface Props {
  extracting: boolean;
  extracted: ExtractedEstimateItem[] | null;
  extractedFileName: string;
  onPickFile: (file: File) => void;
  onCancel: () => void;
  onApply: () => void;
}

export default function EstimateAiSection({
  extracting, extracted, extractedFileName, onPickFile, onCancel, onApply,
}: Props) {
  return (
    <div className="rounded-xl bg-amber-50/60 border border-amber-200 px-4 py-3">
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
          <Sparkles size={14} className="text-amber-600" aria-hidden="true" />
          AI 견적서 자동 추출
        </div>
        <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-700 hover:bg-amber-50 cursor-pointer">
          <Upload size={12} aria-hidden="true" />
          {extracting ? 'AI 분석 중...' : '견적서 파일 업로드'}
          <input type="file" accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv"
            className="hidden" disabled={extracting}
            onChange={(e) => { const f = e.target.files?.[0]; if (f) onPickFile(f); e.target.value = ''; }} />
        </label>
      </div>
      <p className="text-[11px] text-amber-700 mt-1">PDF·이미지·엑셀 견적서를 업로드하면 비용 항목을 자동 추출해서 미리보기 후 적용할 수 있어요.</p>

      {extracted && (
        <div className="mt-3 rounded-xl border border-amber-300 bg-white p-3">
          <div className="flex items-center justify-between mb-2">
            <div className="text-xs">
              <span className="font-semibold text-amber-900">"{extractedFileName}"</span>
              <span className="text-slate-500 ml-1">에서 <strong className="text-amber-900">{extracted.length}건</strong> 추출됨</span>
            </div>
            <div className="flex items-center gap-1.5">
              <Button variant="ghost" size="sm" onClick={onCancel}>취소</Button>
              <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={onApply} disabled={extracted.length === 0}>견적에 추가</Button>
            </div>
          </div>
          <div className="max-h-64 overflow-y-auto border border-slate-200 rounded-lg">
            <table className="w-full text-xs">
              <thead className="bg-slate-50 sticky top-0">
                <tr className="text-slate-500">
                  <th className="px-2 py-1.5 text-left">구분</th>
                  <th className="px-2 py-1.5 text-left">내용</th>
                  <th className="px-2 py-1.5 text-left">지급처</th>
                  <th className="px-2 py-1.5 text-right">단가</th>
                  <th className="px-2 py-1.5 text-right">회수</th>
                  <th className="px-2 py-1.5 text-left">세액</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-slate-100">
                {extracted.map((e, i) => (
                  <tr key={i} className="hover:bg-amber-50/40">
                    <td className="px-2 py-1 font-semibold">{e.category}</td>
                    <td className="px-2 py-1 truncate max-w-[180px]">{e.description ?? '-'}</td>
                    <td className="px-2 py-1">{e.payee_name ?? '-'}</td>
                    <td className="px-2 py-1 text-right tabular-nums">{e.unit_price.toLocaleString()}</td>
                    <td className="px-2 py-1 text-right">{e.quantity}</td>
                    <td className="px-2 py-1">{e.tax_rate_type}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </div>
      )}
    </div>
  );
}
