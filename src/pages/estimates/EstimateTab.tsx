// 프로젝트 상세 — 견적 탭
// STEP-ACCOUNTING-FOLLOWUP7-Phase2 + Phase3 (AI 견적서 분석)

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, FileText, Wand2, Upload, Sparkles, BookOpen, Download, Search } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import { calcTax, TAX_RATE_LABEL, TAX_RATE_VALUES } from '../../utils/taxUtils';
import type { PayrollTaxRateType } from '../../types/database';
import {
  applyFilterSort, emptyDraft, EstSortTh,
  type DraftItem, type SortKey, type SortDir,
} from './estimateTableHelpers';
import {
  fetchEstimateByProject, createEstimate, saveEstimateItems, convertEstimateToPayroll,
  ESTIMATE_CATEGORY_SUGGESTIONS, type EstimateRow,
} from './estimateUtils';
// STEP-ACCOUNTING-FOLLOWUP7-Phase3 — AI 견적서 추출
import { extractEstimateFromDocument, type ExtractedEstimateItem } from './estimateExtract';
// 박경수님 요청 — 견적 항목 템플릿 저장/불러오기
import { SaveEstimateTemplateModal, LoadEstimateTemplateModal, type TemplateItem } from './EstimateTemplateModals';

interface Props {
  projectId: string;
  projectName: string;
}

// DraftItem · 정렬 · 필터 헬퍼는 estimateTableHelpers (V-1 분리)

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
  // 박경수님 요청 — 템플릿 저장/불러오기
  const [saveTplOpen, setSaveTplOpen] = useState(false);
  const [loadTplOpen, setLoadTplOpen] = useState(false);

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
          headcount: Number(it.headcount ?? 1),  // 박경수님 요청 — 수량(인원)
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
      unit_price: it.unit_price, quantity: it.quantity, headcount: it.headcount ?? 1,
      tax_rate_type: it.tax_rate_type,
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
        headcount: 1,
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

  // 박경수님 요청 — 단가 × 회수 × 수량(인원) 3중 곱
  const total = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0) * (Number(it.headcount ?? 1) || 1), 0);
  const unconverted = items.filter((it) => !it._converted).length;

  // 박경수님 요청 — 필터/검색/정렬
  const [catFilter, setCatFilter] = useState(''); const [search, setSearch] = useState('');
  const [sortKey, setSortKey] = useState<SortKey | null>(null); const [sortDir, setSortDir] = useState<SortDir>('asc');
  const toggleSort = (k: SortKey) => sortKey === k ? setSortDir((d) => d === 'asc' ? 'desc' : 'asc') : (setSortKey(k), setSortDir('asc'));
  const catOptions = Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort();
  const visibleItems = applyFilterSort(items, { search, catFilter, sortKey, sortDir });

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
        <div className="flex items-center gap-2 flex-wrap">
          <Button variant="outline" size="sm" leftIcon={<Download size={12} />} onClick={() => setLoadTplOpen(true)}>템플릿 불러오기</Button>
          <Button variant="outline" size="sm" leftIcon={<BookOpen size={12} />} onClick={() => setSaveTplOpen(true)} disabled={items.length === 0}>템플릿 저장</Button>
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

      {/* 박경수님 요청 — 항목 필터 + 검색 (정렬은 컬럼 헤더 클릭) */}
      <div className="flex flex-wrap items-center gap-2">
        <select value={catFilter} onChange={(e) => setCatFilter(e.target.value)}
          className="h-9 rounded-lg border border-slate-200 px-2.5 text-xs">
          <option value="">전체 항목</option>
          {catOptions.map((c) => <option key={c} value={c}>{c}</option>)}
        </select>
        <div className="relative flex-1 max-w-sm">
          <Search size={14} className="absolute left-2.5 top-1/2 -translate-y-1/2 text-slate-400 pointer-events-none" />
          <input type="search" value={search} onChange={(e) => setSearch(e.target.value)}
            placeholder="세항목·내용·메모 검색"
            className="w-full h-9 pl-8 pr-3 rounded-lg border border-slate-200 text-xs outline-none focus:border-primary focus:ring-2 focus:ring-primary/20" />
        </div>
        {(catFilter || search || sortKey) && (
          <button type="button" onClick={() => { setCatFilter(''); setSearch(''); setSortKey(null); }}
            className="text-[11px] text-rose-600 hover:underline">필터 초기화</button>
        )}
        <span className="text-[11px] text-slate-500 ml-auto">{visibleItems.length}/{items.length}건</span>
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
              <EstSortTh k="category"      sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left">항목</EstSortTh>
              <EstSortTh k="description"   sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left">세항목</EstSortTh>
              <EstSortTh k="payee_name"    sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left">내용</EstSortTh>
              <EstSortTh k="unit_price"    sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">단가</EstSortTh>
              <EstSortTh k="quantity"      sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">회수</EstSortTh>
              <EstSortTh k="headcount"     sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">수량(인원)</EstSortTh>
              <EstSortTh k="tax_rate_type" sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="left">세액</EstSortTh>
              <EstSortTh k="subtotal"      sortKey={sortKey} sortDir={sortDir} onClick={toggleSort} align="right">실지급(예상)</EstSortTh>
              <th className="text-center px-3 py-2 font-semibold">상태</th>
              <th className="text-right px-3 py-2 font-semibold">관리</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-slate-100">
            {visibleItems.length === 0 ? (
              <tr><td colSpan={10} className="px-3 py-6 text-center text-xs text-slate-400 italic">
                {items.length === 0 ? '견적 항목이 아직 없어요. [항목 추가] 로 시작해 보세요.' : '필터/검색 결과가 없어요.'}
              </td></tr>
            ) : visibleItems.map((it) => {
              const idx = it._idx;  // 원본 items 의 index (편집 핸들러용)
              const sub = (Number(it.unit_price) || 0) * (Number(it.quantity) || 0) * (Number(it.headcount ?? 1) || 1);
              const { netAmount } = calcTax(sub, it.tax_rate_type);
              const locked = !!it._converted;
              return (
                <tr key={idx} className={locked ? 'bg-emerald-50/30' : 'hover:bg-violet-50/30'}>
                  <td className="px-2 py-1">
                    <Input list="estimate-categories" value={it.category} onChange={(e) => updateItem(idx, { category: e.target.value })} disabled={locked} />
                  </td>
                  <td className="px-2 py-1"><Input value={it.description ?? ''} onChange={(e) => updateItem(idx, { description: e.target.value })} disabled={locked} placeholder="강의명·작업명" /></td>
                  <td className="px-2 py-1"><Input value={it.payee_name ?? ''} onChange={(e) => updateItem(idx, { payee_name: e.target.value })} disabled={locked} placeholder="구체 내용 또는 지급처" /></td>
                  <td className="px-2 py-1 w-36">
                    {/* 박경수님 요청 — 단가 세자리 콤마 표시 (text + numeric inputMode) */}
                    <Input type="text" inputMode="numeric" value={(Number(it.unit_price) || 0).toLocaleString()}
                      onChange={(e) => updateItem(idx, { unit_price: Number(e.target.value.replace(/[^0-9]/g, '')) || 0 })}
                      disabled={locked} className="text-right" />
                  </td>
                  <td className="px-2 py-1 w-24">
                    <Input type="number" value={String(it.quantity)} onChange={(e) => updateItem(idx, { quantity: Number(e.target.value) || 1 })} disabled={locked} className="text-right" />
                  </td>
                  <td className="px-2 py-1 w-24">
                    {/* 박경수님 요청 — 수량(인원) 컬럼 신규 */}
                    <Input type="number" value={String(it.headcount ?? 1)} onChange={(e) => updateItem(idx, { headcount: Number(e.target.value) || 1 })} disabled={locked} className="text-right" />
                  </td>
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

      {/* 박경수님 요청 — 견적 항목 템플릿 저장/불러오기 */}
      <SaveEstimateTemplateModal
        open={saveTplOpen}
        items={items.map<TemplateItem>((it) => ({
          category: it.category, description: it.description ?? null, payee_name: it.payee_name ?? null,
          unit_price: it.unit_price, quantity: it.quantity, tax_rate_type: it.tax_rate_type, memo: it.memo ?? null,
        }))}
        onClose={() => setSaveTplOpen(false)}
        onSaved={() => setSaveTplOpen(false)}
      />
      <LoadEstimateTemplateModal
        open={loadTplOpen}
        onClose={() => setLoadTplOpen(false)}
        onApply={(tplItems, replace) => {
          const next = tplItems.map((t, i) => ({
            category: t.category, description: t.description ?? '', payee_name: t.payee_name ?? '',
            unit_price: Number(t.unit_price ?? 0), quantity: Number(t.quantity ?? 1),
            tax_rate_type: (t.tax_rate_type ?? '3.3') as PayrollTaxRateType, memo: t.memo ?? '',
            order_index: (replace ? 0 : items.length) + i,
          } as DraftItem));
          setItems(replace ? next : [...items, ...next]);
          toast.success(`${next.length}건 ${replace ? '교체' : '추가'} 완료. [저장] 을 잊지 마세요.`);
        }}
      />
    </div>
  );
}
