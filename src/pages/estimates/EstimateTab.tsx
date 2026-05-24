// 프로젝트 상세 — 견적 탭
// STEP-ACCOUNTING-FOLLOWUP7-Phase2 + Phase3 (AI 견적서 분석)

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, FileText, Wand2, Upload, Sparkles } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import { calcTax, TAX_RATE_LABEL, TAX_RATE_VALUES } from '../../utils/taxUtils';
import type { EstimateItem, PayrollTaxRateType } from '../../types/database';
import {
  fetchEstimateByProject, createEstimate, saveEstimateItems, convertEstimateToPayroll,
  ESTIMATE_CATEGORY_SUGGESTIONS, type EstimateRow,
} from './estimateUtils';
// STEP-ACCOUNTING-FOLLOWUP7-Phase3 — AI 견적서 추출
import { extractEstimateFromDocument, type ExtractedEstimateItem } from './estimateExtract';

interface Props {
  projectId: string;
  projectName: string;
}

type DraftItem = Pick<EstimateItem,
  'category' | 'description' | 'payee_name' | 'unit_price' | 'quantity' | 'tax_rate_type' | 'memo' | 'order_index'
> & { _existingId?: string; _converted?: boolean };

function emptyDraft(idx: number): DraftItem {
  return {
    category: '강사료', description: '', payee_name: '',
    unit_price: 0, quantity: 1, tax_rate_type: '3.3',
    memo: '', order_index: idx,
  };
}

export default function EstimateTab({ projectId, projectName }: Props) {
  const toast = useToast();
  const [estimate, setEstimate] = useState<EstimateRow | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [converting, setConverting] = useState(false);
  // STEP-ACCOUNTING-FOLLOWUP7-Phase3 — AI 견적서 분석
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedEstimateItem[] | null>(null);
  const [extractedFileName, setExtractedFileName] = useState('');

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEstimateByProject(projectId);
      setEstimate(data);
      if (data?.items?.length) {
        setItems(data.items.map((it) => ({
          category: it.category,
          description: it.description ?? '',
          payee_name: it.payee_name ?? '',
          unit_price: it.unit_price,
          quantity: it.quantity,
          tax_rate_type: it.tax_rate_type as PayrollTaxRateType,
          memo: it.memo ?? '',
          order_index: it.order_index,
          _existingId: it.id,
          _converted: !!it.payroll_expense_id,
        })));
      } else {
        setItems([]);
      }
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[EstimateTab] 조회 오류:', msg);
      toast.error(msg || '견적서를 불러오지 못했어요.');
    } finally {
      setLoading(false);
    }
  }, [projectId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  async function ensureEstimate(): Promise<EstimateRow | null> {
    if (estimate) return estimate;
    try {
      const created = await createEstimate({ project_id: projectId, title: `${projectName} 견적서` });
      setEstimate(created);
      return created;
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      toast.error(msg || '견적서 생성에 실패했어요.');
      return null;
    }
  }

  function addItem() {
    setItems((prev) => [...prev, emptyDraft(prev.length)]);
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
  }

  function removeItem(idx: number) {
    setItems((prev) => prev.filter((_, i) => i !== idx).map((it, i) => ({ ...it, order_index: i })));
  }

  async function handleSave() {
    const target = await ensureEstimate();
    if (!target) return;
    setSaving(true);
    // 이미 변환된 항목 제외하고 일괄 저장 (변환된 건 server 측 보존)
    const toSave = items.filter((it) => !it._converted).map((it) => ({
      category: it.category, description: it.description, payee_name: it.payee_name,
      unit_price: it.unit_price, quantity: it.quantity, tax_rate_type: it.tax_rate_type,
      memo: it.memo, order_index: it.order_index,
    }));
    const err = await saveEstimateItems(target.id, toSave);
    setSaving(false);
    if (err) { toast.error(err); return; }
    toast.success('견적을 저장했어요.');
    void reload();
  }

  async function handleConvert() {
    if (!estimate) { toast.error('먼저 견적을 저장해 주세요.'); return; }
    if (!window.confirm('미변환 항목들을 외주/급여로 일괄 생성할까요? (이미 변환된 항목은 제외)')) return;
    setConverting(true);
    const res = await convertEstimateToPayroll(estimate.id, { project_id: projectId });
    setConverting(false);
    if (res.error) { toast.error(res.error); return; }
    toast.success(`${res.inserted}건을 외주/급여로 변환했어요.`);
    void reload();
  }

  // STEP-ACCOUNTING-FOLLOWUP7-Phase3 — AI 견적서 분석
  async function handleAiExtract(file: File) {
    setExtracting(true);
    setExtractedFileName(file.name);
    try {
      const result = await extractEstimateFromDocument(file);
      if (result.length === 0) {
        toast.error('견적 항목을 추출하지 못했어요. 파일 양식을 확인해 주세요.');
        setExtracted([]);
        return;
      }
      setExtracted(result);
      toast.success(`${result.length}건 추출했어요. 미리보기 후 [적용] 해주세요.`);
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[EstimateTab] AI 추출 실패:', msg);
      toast.error('AI 분석에 실패했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setExtracting(false);
    }
  }

  function applyExtracted() {
    if (!extracted || extracted.length === 0) return;
    setItems((prev) => {
      const base = prev.length;
      const additions: DraftItem[] = extracted.map((e, i) => ({
        category: e.category,
        description: e.description ?? '',
        payee_name: e.payee_name ?? '',
        unit_price: e.unit_price,
        quantity: e.quantity,
        tax_rate_type: e.tax_rate_type,
        memo: e.memo ?? '',
        order_index: base + i,
      }));
      return [...prev, ...additions];
    });
    setExtracted(null);
    setExtractedFileName('');
    toast.success('견적 항목에 추가했어요. [저장] 눌러서 확정해 주세요.');
  }

  const total = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0), 0);
  const unconverted = items.filter((it) => !it._converted).length;

  if (loading) {
    return <div className="flex items-center justify-center py-16 text-sm text-muted"><Loader2 size={18} className="animate-spin mr-2" />불러오는 중...</div>;
  }

  return (
    <div className="space-y-4">
      {/* 헤더 KPI */}
      <div className="flex items-center justify-between flex-wrap gap-3">
        <div className="flex items-center gap-2 text-sm">
          <FileText size={16} className="text-violet-600" aria-hidden="true" />
          <span className="font-semibold text-[#1E1B4B]">{estimate?.title ?? '견적서 (아직 없음)'}</span>
          <span className="text-xs text-slate-500">· 항목 {items.length}건 · 총 <span className="font-bold text-violet-700 tabular-nums">{formatMoney(total)}</span></span>
        </div>
        <div className="flex items-center gap-2">
          <Button variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={addItem}>항목 추가</Button>
          <Button variant="outline" size="sm" leftIcon={<Save size={12} />} onClick={() => void handleSave()} loading={saving}>저장</Button>
          <Button variant="primary" size="sm" leftIcon={<Wand2 size={12} />} onClick={() => void handleConvert()} loading={converting} disabled={!estimate || unconverted === 0}>
            외주/급여로 변환 ({unconverted})
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5 text-xs text-violet-900">
        💡 견적 항목을 입력하고 [저장] → [외주/급여로 변환] 누르면 변환된 항목은 회색 처리되고 외주/급여 페이지에서 실집행 정보(지급일·계좌·증빙) 채워나가시면 돼요.
      </div>

      {/* STEP-ACCOUNTING-FOLLOWUP7-Phase3 — AI 견적서 업로드 + 미리보기 */}
      <div className="rounded-xl bg-amber-50/60 border border-amber-200 px-4 py-3">
        <div className="flex items-center justify-between gap-2 flex-wrap">
          <div className="flex items-center gap-1.5 text-sm font-semibold text-amber-900">
            <Sparkles size={14} className="text-amber-600" aria-hidden="true" />
            AI 견적서 자동 추출
          </div>
          <label className="inline-flex items-center gap-1 px-3 py-1.5 rounded-lg border border-amber-300 bg-white text-xs font-semibold text-amber-700 hover:bg-amber-50 cursor-pointer">
            <Upload size={12} aria-hidden="true" />
            {extracting ? 'AI 분석 중...' : '견적서 파일 업로드'}
            <input
              type="file"
              accept=".pdf,.png,.jpg,.jpeg,.webp,.xlsx,.xls,.csv"
              className="hidden"
              disabled={extracting}
              onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) void handleAiExtract(f);
                e.target.value = '';
              }}
            />
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
                <Button variant="ghost" size="sm" onClick={() => { setExtracted(null); setExtractedFileName(''); }}>취소</Button>
                <Button variant="primary" size="sm" leftIcon={<Plus size={12} />} onClick={applyExtracted} disabled={extracted.length === 0}>
                  견적에 추가
                </Button>
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

      {/* 항목 테이블 */}
      <div className="rounded-2xl border border-slate-200 bg-white overflow-x-auto">
        <table className="w-full text-sm">
          <thead className="bg-slate-50 text-xs text-slate-500">
            <tr>
              <th className="text-left px-3 py-2 font-semibold">구분</th>
              <th className="text-left px-3 py-2 font-semibold">내용</th>
              <th className="text-left px-3 py-2 font-semibold">예상 지급처</th>
              <th className="text-right px-3 py-2 font-semibold">단가</th>
              <th className="text-right px-3 py-2 font-semibold">회수</th>
              <th className="text-left px-3 py-2 font-semibold">세액</th>
              <th className="text-right px-3 py-2 font-semibold">실지급(예상)</th>
              <th className="text-center px-3 py-2 font-semibold">상태</th>
              <th className="text-right px-3 py-2 font-semibold">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {items.length === 0 ? (
              <tr><td colSpan={9} className="px-3 py-6 text-center text-xs text-slate-400 italic">견적 항목이 아직 없어요. [항목 추가] 로 시작해 보세요.</td></tr>
            ) : items.map((it, idx) => {
              const sub = (Number(it.unit_price) || 0) * (Number(it.quantity) || 0);
              const { netAmount } = calcTax(sub, it.tax_rate_type);
              const locked = !!it._converted;
              return (
                <tr key={idx} className={locked ? 'bg-emerald-50/30' : 'hover:bg-violet-50/30'}>
                  <td className="px-2 py-1">
                    <Input list="estimate-categories" value={it.category} onChange={(e) => updateItem(idx, { category: e.target.value })} disabled={locked} />
                  </td>
                  <td className="px-2 py-1"><Input value={it.description ?? ''} onChange={(e) => updateItem(idx, { description: e.target.value })} disabled={locked} placeholder="강의명·작업명" /></td>
                  <td className="px-2 py-1"><Input value={it.payee_name ?? ''} onChange={(e) => updateItem(idx, { payee_name: e.target.value })} disabled={locked} placeholder="홍길동 또는 미정" /></td>
                  <td className="px-2 py-1 w-32"><Input type="number" value={String(it.unit_price)} onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value) || 0 })} disabled={locked} /></td>
                  <td className="px-2 py-1 w-20"><Input type="number" value={String(it.quantity)} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })} disabled={locked} /></td>
                  <td className="px-2 py-1">
                    <select value={it.tax_rate_type} onChange={(e) => updateItem(idx, { tax_rate_type: e.target.value as PayrollTaxRateType })} disabled={locked} className="w-full h-10 rounded-xl border border-slate-200 px-2 text-xs disabled:bg-slate-50">
                      {TAX_RATE_VALUES.map((t) => <option key={t} value={t}>{TAX_RATE_LABEL[t]}</option>)}
                    </select>
                  </td>
                  <td className="px-2 py-1 text-right tabular-nums font-semibold text-violet-700 whitespace-nowrap">{formatMoney(netAmount)}</td>
                  <td className="px-2 py-1 text-center text-[10px]">
                    {locked ? <span className="px-1.5 py-0.5 rounded bg-emerald-100 text-emerald-700 font-bold">변환됨</span> : <span className="text-slate-400">대기</span>}
                  </td>
                  <td className="px-2 py-1 text-right">
                    <button type="button" onClick={() => removeItem(idx)} disabled={locked} className="text-xs text-rose-600 hover:underline disabled:text-slate-300 disabled:no-underline">삭제</button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
        <datalist id="estimate-categories">
          {ESTIMATE_CATEGORY_SUGGESTIONS.map((c) => <option key={c} value={c} />)}
        </datalist>
      </div>
    </div>
  );
}
