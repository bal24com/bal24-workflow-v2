// 프로젝트 상세 — 견적 탭
// STEP-ACCOUNTING-FOLLOWUP7-Phase2 + Phase3 (AI 견적서 분석)

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, Save, FileText, BookOpen, Download, Search, Pencil } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { useToast } from '../../contexts/ToastContext';
import { supabase } from '../../lib/supabase';
import { formatMoney } from '../../lib/utils';
import { calcTax, TAX_RATE_LABEL, TAX_RATE_VALUES } from '../../utils/taxUtils';
import type { PayrollTaxRateType } from '../../types/database';
import { applyFilterSort, emptyDraft, EstSortTh, KpiBox, type DraftItem, type SortKey, type SortDir } from './estimateTableHelpers';
import { fetchEstimateByProject, createEstimate, saveEstimateItems, fetchEstimatePaymentMap, estimateItemStatusLabel, ESTIMATE_CATEGORY_SUGGESTIONS, type EstimateRow } from './estimateUtils';
// STEP-ACCOUNTING-FOLLOWUP7-Phase3 — AI 견적서 추출
import { extractEstimateFromDocument, type ExtractedEstimateItem } from './estimateExtract';
import EstimateAiSection from './EstimateAiSection';
import EstimateHeaderEditModal from './EstimateHeaderEditModal';
// 박경수님 요청 — 견적 항목 템플릿 저장/불러오기
import { SaveEstimateTemplateModal, LoadEstimateTemplateModal, type TemplateItem } from './EstimateTemplateModals';
// 박경수님 + SkyClaw STEP-ESTIMATE-ADDON-FULL (2026-05-27) — 제경비·기술료·부가세·최종금액 + 엑셀
import EstimateAddonSection from './EstimateAddonSection';
import { buildAddonPayload, calcEstimateAddon, parseAddonConfig, type EstimateAddonConfig } from './estimateAddonUtils';
import { downloadEstimateExcel } from './estimateExcelExport';

interface Props { projectId: string; projectName: string }

export default function EstimateTab({ projectId, projectName }: Props) {
  const toast = useToast();
  const [estimate, setEstimate] = useState<EstimateRow | null>(null);
  const [items, setItems] = useState<DraftItem[]>([]);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  // STEP-ACCOUNTING-FOLLOWUP7-Phase3 — AI 견적서 분석
  const [extracting, setExtracting] = useState(false);
  const [extracted, setExtracted] = useState<ExtractedEstimateItem[] | null>(null);
  const [extractedFileName, setExtractedFileName] = useState('');
  // 박경수님 요청 — 템플릿 저장/불러오기 + 견적서 헤더 수정
  const [saveTplOpen, setSaveTplOpen] = useState(false); const [loadTplOpen, setLoadTplOpen] = useState(false); const [headerEditOpen, setHeaderEditOpen] = useState(false);
  // 박경수님 보고 — 변경 감지: 사용자가 수정했는데 [저장] 모르는 경우 안내
  const [dirty, setDirty] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    try {
      const data = await fetchEstimateByProject(projectId);
      setEstimate(data);
      if (data?.items?.length) {
        // 박경수님 요청 — 매핑된 payroll 의 지급상태 일괄 조회
        const payrollIds = data.items.map((it) => it.payroll_expense_id).filter(Boolean) as string[];
        const payMap = await fetchEstimatePaymentMap(payrollIds);
        setItems(data.items.map((it) => ({ category: it.category, description: it.description ?? '', payee_name: it.payee_name ?? '', unit_price: it.unit_price, quantity: it.quantity, headcount: Number(it.headcount ?? 1), tax_rate_type: it.tax_rate_type as PayrollTaxRateType, memo: it.memo ?? '', order_index: it.order_index, program_id: it.program_id ?? null, _existingId: it.id, _converted: !!it.payroll_expense_id, _payrollId: it.payroll_expense_id ?? null, _paymentStatus: it.payroll_expense_id ? payMap.get(it.payroll_expense_id) ?? null : null })));
      } else { setItems([]); }
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
    const defaultProgramId = programFilter || programs[0]?.id || null;
    setItems((prev) => [...prev, { ...emptyDraft(prev.length), program_id: defaultProgramId }]);
    setDirty(true);
  }

  function updateItem(idx: number, patch: Partial<DraftItem>) {
    setItems((prev) => prev.map((it, i) => i === idx ? { ...it, ...patch } : it));
    setDirty(true);
  }

  async function removeItem(idx: number) {
    const item = items[idx];
    if (item._converted) { toast.error('변환된 항목은 외주/급여 페이지에서 삭제하세요.'); return; }
    if (item._existingId) {
      const { error } = await supabase.from('estimate_items').delete().eq('id', item._existingId);
      if (error) { toast.error(`삭제 실패: ${error.message}`); return; }
    }
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
      tax_rate_type: it.tax_rate_type, program_id: it.program_id ?? null,
      memo: it.memo, order_index: it.order_index,
    }));
    const err = await saveEstimateItems(target.id, toSave);
    setSaving(false);
    if (err) { toast.error(err); return; }
    toast.success('견적을 저장했어요.');
    setDirty(false);
    void reload();
  }

  // 일괄 [외주/급여로 변환] 제거됨 — 박경수님 흐름: 프로그램 [지급요청] → [견적에서 가져오기]
  // (견적과 실집행이 다를 수 있어 박경수님이 선택·수정·전송하는 흐름이 정확)

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
        program_id: null,
      }));
      return [...prev, ...additions];
    });
    setExtracted(null);
    setExtractedFileName('');
    toast.success('견적 항목에 추가했어요. [저장] 눌러서 확정해 주세요.');
  }

  // 박경수님 요청 — 단가 × 회수 × 수량(인원) 3중 곱
  const total = items.reduce((s, it) => s + (Number(it.unit_price) || 0) * (Number(it.quantity) || 0) * (Number(it.headcount ?? 1) || 1), 0);

  // 박경수님 + SkyClaw STEP-ESTIMATE-ADDON-FULL — 제경비·기술료·부가세·최종금액
  const addonConfig: EstimateAddonConfig = parseAddonConfig(estimate as Record<string, unknown> | null);
  async function handleAddonSave(cfg: EstimateAddonConfig) { const est = await ensureEstimate(); if (!est) return; const { error } = await supabase.from('project_estimates').update(buildAddonPayload(cfg)).eq('id', est.id); if (error) { console.error('[EstimateTab] addon 저장 오류:', error.message); toast.error('견적 추가 요금 저장 중 오류가 발생했어요.'); return; } /* STEP-ESTIMATE-UPGRADE-FULL PART C — projects 동기화 (재무 요약 카드 즉시 반영) */ void supabase.from('projects').update({ estimate_includes_vat: cfg.useVat, estimate_final_amount: cfg.finalProposalAmount }).eq('id', projectId); toast.success('견적 추가 요금을 저장했어요.'); void reload(); }
  async function handleExcelDownload() {
    // 박경수님 + SkyClaw STEP-ESTIMATE-EXCEL-FIX — 7열 구조 (단가·시간·인원·소계 분리)
    const xItems = items.map((it) => { const up = Number(it.unit_price) || 0; const hrs = Number(it.quantity) || 0; const hc = Number(it.headcount ?? 1) || 1; return { category: it.category, name: it.description ?? '', unitPrice: up, hours: hrs, headcount: hc, amount: up * hrs * hc, note: it.memo ?? '' }; });
    const { data: prj } = await supabase.from('projects').select('client:clients(name)').eq('id', projectId).maybeSingle();
    downloadEstimateExcel({ title: estimate?.title ?? projectName, clientName: (prj as { client?: { name?: string } | null } | null)?.client?.name ?? '', items: xItems, cfg: addonConfig, result: calcEstimateAddon(total, addonConfig) });
  }

  // 박경수님 요청 — 필터/검색/정렬 + 프로그램 연동
  const [catFilter, setCatFilter] = useState(''); const [search, setSearch] = useState('');
  const [programFilter, setProgramFilter] = useState('');
  const [programs, setPrograms] = useState<Array<{ id: string; name: string }>>([]);
  const [sortKey, setSortKey] = useState<SortKey | null>(null); const [sortDir, setSortDir] = useState<SortDir>('asc');
  const toggleSort = (k: SortKey) => sortKey === k ? setSortDir((d) => d === 'asc' ? 'desc' : 'asc') : (setSortKey(k), setSortDir('asc'));
  const catOptions = Array.from(new Set(items.map((i) => i.category).filter(Boolean))).sort();
  const visibleItems = applyFilterSort(items, { search, catFilter, programFilter, sortKey, sortDir });
  useEffect(() => {
    void supabase.from('programs').select('id, name').eq('project_id', projectId).is('deleted_at', null).order('created_at')
      .then(({ data }) => setPrograms((data ?? []) as Array<{ id: string; name: string }>));
  }, [projectId]);
  // 박경수님 요청 — 종합 탭 상단 KPI: 실집행 합계(인건비/운영비 분리)
  const [exec, setExec] = useState({ total: 0, outsource: 0, operation: 0 });
  useEffect(() => {
    void supabase.from('payroll_expenses').select('subtotal, expense_type, payment_status')
      .eq('project_id', projectId).is('deleted_at', null)
      .then(({ data }) => {
        const live = ((data ?? []) as Array<{ subtotal: number | string | null; expense_type: string; payment_status: string }>)
          .filter((r) => r.payment_status !== 'cancelled');
        const sum = (rs: typeof live) => rs.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);
        const o = live.filter((r) => /^(강사료|촬영|기타외주)/.test(r.expense_type));
        const p = live.filter((r) => /^(운영비|운영인건비)/.test(r.expense_type));
        setExec({ total: sum(live), outsource: sum(o), operation: sum(p) });
      });
  }, [projectId, items]);

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
          {estimate && <button type="button" onClick={() => setHeaderEditOpen(true)} className="inline-flex items-center gap-0.5 text-[11px] text-violet-600 hover:underline" aria-label="견적서 수정"><Pencil size={10} aria-hidden="true" />수정</button>}
          <span className="text-xs text-slate-500">· 항목 {items.length}건 · 총 <span className="font-bold text-violet-700 tabular-nums">{formatMoney(total)}</span></span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          {/* 박경수님 + SkyClaw STEP-ESTIMATE-EXCEL-UX — 엑셀 다운로드 상단 이동 */}
          <Button variant="outline" size="sm" leftIcon={<Download size={12} />} onClick={() => void handleExcelDownload()} className="!border-emerald-300 !text-emerald-700 !bg-emerald-50 hover:!bg-emerald-100">엑셀 다운로드</Button>
          <Button variant="outline" size="sm" leftIcon={<Download size={12} />} onClick={() => setLoadTplOpen(true)}>템플릿 불러오기</Button>
          <Button variant="outline" size="sm" leftIcon={<BookOpen size={12} />} onClick={() => setSaveTplOpen(true)} disabled={items.length === 0}>템플릿 저장</Button>
          <Button variant="outline" size="sm" leftIcon={<Plus size={12} />} onClick={addItem}>항목 추가</Button>
          <Button variant="primary" size="sm" leftIcon={<Save size={12} />} onClick={() => void handleSave()} loading={saving}
            className={dirty ? 'ring-2 ring-amber-300 ring-offset-1 animate-pulse' : ''}>
            {dirty ? '저장 (변경됨)' : '저장'}
          </Button>
        </div>
      </div>

      <div className="rounded-xl bg-violet-50 border border-violet-200 px-4 py-2.5 text-xs text-violet-900 space-y-1">
        <div>💡 <strong>수정 방법</strong>: 표의 각 셀을 직접 클릭해서 수정 → 우측 상단 <strong className="text-violet-700">[저장]</strong> 클릭. [항목 추가] 로 새 행 추가, [삭제] 로 즉시 DB 제거.</div>
        <div>📤 저장한 항목은 프로그램 → [지급요청] → [⬇ 견적에서 가져오기] 에서 선택·수정 후 지출로 등록 (자동 일괄 변환 X).</div>
      </div>

      {/* 박경수님 요청 — 메인 탭: [종합] + 프로그램별 */}
      <nav role="tablist" className="flex items-center gap-1 border-b border-slate-200 overflow-x-auto">
        {([{ id: '', label: '📊 종합' }, ...programs.map((p) => ({ id: p.id, label: p.name }))]).map((t) => {
          const active = programFilter === t.id;
          return (
            <button key={t.id} type="button" role="tab" aria-selected={active} onClick={() => setProgramFilter(t.id)}
              className={`px-3 py-2 text-xs font-semibold border-b-2 whitespace-nowrap ${active ? 'text-primary border-primary' : 'text-slate-500 border-transparent hover:text-text'}`}>
              {t.label}
            </button>
          );
        })}
      </nav>

      {/* 종합 탭 — 견적 vs 실집행 KPI (인건비/운영비 분리 + 잔여) */}
      {programFilter === '' && (
        <div className="grid grid-cols-2 md:grid-cols-5 gap-3">
          <KpiBox label="제안 견적" value={formatMoney(total)} tone="violet" />
          <KpiBox label="실집행 합계" value={formatMoney(exec.total)} tone="emerald" />
          <KpiBox label="└ 인건비" value={formatMoney(exec.outsource)} tone="cyan" small />
          <KpiBox label="└ 운영비" value={formatMoney(exec.operation)} tone="orange" small />
          <KpiBox label={total - exec.total >= 0 ? '잔여' : '⚠ 초과'}
            value={formatMoney(Math.abs(total - exec.total))}
            tone={total - exec.total >= 0 ? 'emerald' : 'violet'} />
        </div>
      )}

      {/* 항목 필터 + 검색 + 정렬 */}
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
        {(catFilter || search || sortKey || programFilter) && (
          <button type="button" onClick={() => { setCatFilter(''); setSearch(''); setSortKey(null); setProgramFilter(''); }}
            className="text-[11px] text-rose-600 hover:underline">필터 초기화</button>
        )}
        <span className="text-[11px] text-slate-500 ml-auto">{visibleItems.length}/{items.length}건</span>
      </div>

      <EstimateAiSection
        extracting={extracting} extracted={extracted} extractedFileName={extractedFileName}
        onPickFile={(f) => void handleAiExtract(f)}
        onCancel={() => { setExtracted(null); setExtractedFileName(''); }}
        onApply={applyExtracted}
      />

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
            ) : visibleItems.map((it, viewIdx) => {
              const idx = it._idx;
              const sub = (Number(it.unit_price) || 0) * (Number(it.quantity) || 0) * (Number(it.headcount ?? 1) || 1);
              const { netAmount } = calcTax(sub, it.tax_rate_type);
              const locked = !!it._converted;
              // STEP-TABLE-COMPACT PART A — 짝수 행 옅은 배경
              return (
                <tr key={idx} className={`${locked ? 'bg-emerald-50/30' : (viewIdx % 2 === 0 ? 'bg-white' : 'bg-slate-50/60')} hover:bg-violet-50/30 border-b border-slate-100 transition-colors`}>
                  {/* 박경수님 요청 — 프로그램 컬럼 제거. addItem 시 자동 prefill. 프로그램별 메인 탭으로 분류 가능 */}
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
                    {(() => {
                      const st = estimateItemStatusLabel(!!it._converted, it._paymentStatus);
                      const cls = st.tone === 'emerald' ? 'bg-emerald-100 text-emerald-700'
                        : st.tone === 'amber' ? 'bg-amber-100 text-amber-700'
                        : st.tone === 'rose' ? 'bg-rose-100 text-rose-700' : 'bg-slate-100 text-slate-500';
                      return <span className={`px-1.5 py-0.5 rounded font-bold ${cls}`}>{st.label}</span>;
                    })()}
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

      {/* 박경수님 + SkyClaw STEP-ESTIMATE-ADDON-FULL — 제경비·기술료·부가세·최종금액 + 엑셀 */}
      <div className="bg-white rounded-xl border border-slate-200 p-4">
        <div className="mb-2"><h3 className="text-sm font-semibold text-slate-800">견적 합계 (제경비·기술료·부가세·최종 제안금액)</h3></div>
        <EstimateAddonSection directTotal={total} addonConfig={addonConfig} onSave={handleAddonSave} />
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
      {estimate && <EstimateHeaderEditModal open={headerEditOpen} estimateId={estimate.id} currentTitle={estimate.title} currentMemo={estimate.memo ?? null} onClose={() => setHeaderEditOpen(false)} onSaved={() => { setHeaderEditOpen(false); void reload(); }} />}
    </div>
  );
}
