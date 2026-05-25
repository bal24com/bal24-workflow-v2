// 프로그램 [지급요청] 탭 — 메인(견적 vs 집행) + [인건비][운영비] 하위탭
// 박경수님 요청 — 강사료(payroll 변환분 포함)도 인건비 탭에 통합 노출

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, Trash2, Download, Pencil, ArrowUp, ArrowDown } from 'lucide-react';
import { Button } from '../../../components/ui';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { formatDateKo, formatMoney } from '../../../lib/utils';
import EmptyState from '../../../components/EmptyState';
import SubToggle from './SubToggle';
import PaymentRequestFormModal, { type PaymentTarget } from './PaymentRequestFormModal';
import PaymentSummaryCards from './PaymentSummaryCards';
import EstimateImportModal from './EstimateImportModal';
import { isOutsourceType, isOperationType, bulkSoftDeletePayroll } from '../../payroll/payrollUtils';

type Group = 'outsource' | 'operation';

interface Row {
  id: string;
  expense_type: string;
  description: string | null;
  payee_name: string;
  payee_id_no: string | null;
  bank_name: string | null;
  bank_account: string | null;
  unit_price: number;
  quantity: number;
  subtotal: number;
  tax_amount: number | null;
  tax_rate_type: string | null;
  net_amount: number | null;
  payment_status: string;
  paid_at: string | null;
  memo: string | null;
  order_index?: number | null;
  program_id: string | null;
  project_id: string | null;
  contract_id: string | null;
  client_id?: string | null;
  biz_reg_no?: string | null;
}

const STATUS_STYLE: Record<string, string> = {
  대기:   'bg-amber-50 text-amber-700 border-amber-200',
  완료:   'bg-emerald-50 text-emerald-700 border-emerald-200',
  후순위: 'bg-slate-50 text-slate-600 border-slate-200',
  취소:   'bg-rose-50 text-rose-700 border-rose-200',
};

interface Props { programId: string; projectId: string | null }

export default function PaymentRequestTab({ programId, projectId }: Props) {
  const toast = useToast();
  const [group, setGroup] = useState<Group>('outsource');
  const [rows, setRows] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [importOpen, setImportOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<PaymentTarget | null>(null);
  const [acting, setActing] = useState<string | null>(null);
  const [counts, setCounts] = useState({ outsource: 0, operation: 0 });
  // 박경수님 + SkyClaw — 일괄 선택삭제
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [bulkDeleting, setBulkDeleting] = useState(false);

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('payroll_expenses')
      // 박경수님 보고 fix — 모든 필드 fetch (수정 시 null 덮어쓰기 방지). client_id/biz_reg_no 는 마이그레이션 후 작동
      .select('id, expense_type, description, payee_name, payee_id_no, bank_name, bank_account, unit_price, quantity, subtotal, tax_amount, tax_rate_type, net_amount, payment_status, paid_at, memo, order_index, program_id, project_id, contract_id, client_id, biz_reg_no')
      .eq('program_id', programId)
      .is('deleted_at', null)
      .order('order_index', { ascending: true, nullsFirst: false })
      .order('created_at', { ascending: false });
    setLoading(false);
    if (error) {
      console.error('[PaymentRequestTab] 조회 실패:', error.message);
      toast.error('지급요청 목록을 불러오지 못했어요.');
      return;
    }
    const all = (data ?? []) as Row[];
    setRows(all);
    setCounts({
      outsource: all.filter((r) => isOutsourceType(r.expense_type)).length,
      operation: all.filter((r) => isOperationType(r.expense_type)).length,
    });
  }, [programId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  const visible = rows.filter((r) =>
    group === 'outsource' ? isOutsourceType(r.expense_type) : isOperationType(r.expense_type));
  const groupTotal = visible.reduce((s, r) => s + Number(r.subtotal ?? 0), 0);

  // 박경수님 요청 — 위아래 이동 (그룹 내에서 swap)
  async function swap(idx: number, dir: 'up' | 'down') {
    const j = dir === 'up' ? idx - 1 : idx + 1;
    if (j < 0 || j >= visible.length) return;
    const a = visible[idx]; const b = visible[j];
    const ao = Number(a.order_index ?? idx); const bo = Number(b.order_index ?? j);
    const [u1, u2] = await Promise.all([
      supabase.from('payroll_expenses').update({ order_index: bo }).eq('id', a.id),
      supabase.from('payroll_expenses').update({ order_index: ao }).eq('id', b.id),
    ]);
    if (u1.error || u2.error) { toast.error('순서 저장 실패 — 마이그레이션(order_index) 확인 필요.'); return; }
    void reload();
  }

  async function handleDelete(row: Row) {
    if (!window.confirm(`"${row.expense_type} · ${row.payee_name}" 항목을 휴지통으로 보낼까요?`)) return;
    setActing(row.id);
    const { error } = await supabase.from('payroll_expenses')
      .update({ deleted_at: new Date().toISOString() }).eq('id', row.id);
    setActing(null);
    if (error) {
      const raw = error.message.toLowerCase();
      console.error('[PaymentRequestTab] 삭제 실패:', error.message);
      if (raw.includes('column') && raw.includes('does not exist')) toast.error(`payroll_expenses 컬럼이 누락됐어요. 마이그레이션 실행 필요.\n(${error.message})`);
      else if (raw.includes('row-level security')) toast.error(`삭제 권한이 없어요. RLS UPDATE 정책 필요.\n(${error.message})`);
      else toast.error(`삭제 실패: ${error.message}`);
      return;
    }
    toast.success('삭제했어요. 외주/급여 페이지에서도 사라집니다.');
    void reload();
  }

  // 박경수님 + SkyClaw — 일괄 선택삭제 (visible 기준)
  function toggleAll() {
    if (visible.length === 0) return;
    const allSelected = visible.every((r) => selectedIds.has(r.id));
    setSelectedIds(allSelected ? new Set() : new Set(visible.map((r) => r.id)));
  }
  function toggleOne(id: string) {
    setSelectedIds((prev) => {
      const next = new Set(prev);
      if (next.has(id)) next.delete(id); else next.add(id);
      return next;
    });
  }
  async function handleBulkDelete() {
    if (selectedIds.size === 0) return;
    if (!window.confirm(`선택한 ${selectedIds.size}건을 휴지통으로 보낼까요?`)) return;
    setBulkDeleting(true);
    const err = await bulkSoftDeletePayroll(Array.from(selectedIds));
    setBulkDeleting(false);
    if (err) { toast.error(err); return; }
    toast.success(`${selectedIds.size}건 삭제했어요.`);
    setSelectedIds(new Set());
    void reload();
  }

  return (
    <div className="space-y-4">
      {/* 메인 — 제안 견적 vs 실제 집행 */}
      <PaymentSummaryCards programId={programId} projectId={projectId} />

      {/* SubToggle [인건비][운영비] */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <SubToggle
          items={[
            { key: 'outsource', label: `💼 인건비 (${counts.outsource})` },
            { key: 'operation', label: `🧾 운영비 (${counts.operation})` },
          ]}
          active={group}
          onChange={(k) => setGroup(k as Group)}
        />
        <div className="flex items-center gap-2">
          {/* 박경수님 + SkyClaw — 선택된 항목 있을 때만 [선택삭제] 노출 */}
          {selectedIds.size > 0 && (
            <Button variant="outline" size="sm" leftIcon={<Trash2 size={13} />}
              onClick={() => void handleBulkDelete()} loading={bulkDeleting}
              className="!border-rose-300 !text-rose-600 hover:!bg-rose-50">
              선택삭제 ({selectedIds.size}건)
            </Button>
          )}
          <Button variant="outline" size="sm" leftIcon={<Download size={13} />} onClick={() => setImportOpen(true)}>견적에서 가져오기</Button>
          <Button variant="primary" size="sm" leftIcon={<Plus size={13} />} onClick={() => setFormOpen(true)}>
            {group === 'outsource' ? '인건비 추가' : '운영비 추가'}
          </Button>
        </div>
      </div>

      <p className="text-[11px] text-slate-500">
        {group === 'outsource'
          ? '강사료·촬영·통역 등 인건비. 강사 탭에서 [외주/급여로 변환] 한 항목도 여기에 표시됩니다. 합계 '
          : '호텔·버스·재료비 등 운영 지출. 합계 '}
        <span className="font-bold text-violet-700 tabular-nums">{formatMoney(groupTotal)}</span>
      </p>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-sm text-muted">
          <Loader2 size={16} className="animate-spin mr-2" />불러오는 중…
        </div>
      ) : visible.length === 0 ? (
        <EmptyState
          emoji="🧾"
          title={group === 'outsource' ? '아직 등록된 인건비가 없어요.' : '아직 등록된 운영비가 없어요.'}
          description={group === 'outsource'
            ? '강사 탭의 [강사료] 에서 등록 후 [외주/급여로 변환] 하거나, [인건비 추가] 로 직접 입력하세요.'
            : '[운영비 추가] 로 호텔·버스·재료비 등을 입력하세요.'}
        />
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                {/* 박경수님 + SkyClaw — 전체선택 (visible 기준) */}
                <th className="w-8 px-3 py-2.5">
                  <input type="checkbox" aria-label="전체 선택"
                    checked={visible.length > 0 && visible.every((r) => selectedIds.has(r.id))}
                    onChange={toggleAll}
                    className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                </th>
                <th className="text-left px-3 py-2.5 font-semibold">항목</th>
                <th className="text-left px-3 py-2.5 font-semibold">세항목</th>
                <th className="text-left px-3 py-2.5 font-semibold">지급처</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">단가×회수</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">세액 (원천/부가)</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">실지급</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">지급일</th>
                <th className="text-center px-3 py-2.5 font-semibold whitespace-nowrap">상태</th>
                <th className="text-right px-3 py-2.5 font-semibold whitespace-nowrap">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {visible.map((r, idx) => (
                <tr key={r.id} className={`hover:bg-violet-50/40 ${selectedIds.has(r.id) ? 'bg-violet-50/30' : ''}`}>
                  {/* 박경수님 + SkyClaw — 개별 선택 */}
                  <td className="w-8 px-3 py-2">
                    <input type="checkbox" aria-label={`${r.expense_type} 선택`}
                      checked={selectedIds.has(r.id)}
                      onChange={() => toggleOne(r.id)}
                      onClick={(e) => e.stopPropagation()}
                      className="rounded border-slate-300 text-violet-600 focus:ring-violet-500" />
                  </td>
                  <td className="px-3 py-2 text-xs font-semibold text-violet-700">{r.expense_type}</td>
                  <td className="px-3 py-2 text-xs text-text truncate max-w-[260px]">{r.description ?? '-'}</td>
                  <td className="px-3 py-2 text-xs text-muted">{r.payee_name || '-'}</td>
                  <td className="px-3 py-2 text-right text-xs text-muted tabular-nums whitespace-nowrap">{Number(r.unit_price).toLocaleString()}×{r.quantity}</td>
                  <td className="px-3 py-2 text-right text-xs tabular-nums whitespace-nowrap">
                    {/* 박경수님 보고 fix — tax_amount 0 일 때 운영비(tax_rate_type=10) 면 부가세 계산 폴백 */}
                    {(() => {
                      const sub = Number(r.subtotal ?? 0);
                      const storedTax = Number(r.tax_amount ?? 0);
                      const isVat = r.tax_rate_type === '10';
                      // 저장된 tax_amount > 0 이면 그대로. 없으면 운영비는 sub/11 폴백.
                      const tax = storedTax > 0 ? storedTax : (isVat ? Math.floor(sub / 11) : 0);
                      if (tax === 0) return <span className="text-slate-400">-</span>;
                      return (
                        <>
                          <div className={isVat ? 'text-blue-600' : 'text-rose-600'}>
                            {isVat ? '+' : '-'}{formatMoney(tax)}
                          </div>
                          <div className="text-[10px] text-slate-400">{isVat ? '부가세' : `원천 ${r.tax_rate_type}`}</div>
                        </>
                      );
                    })()}
                  </td>
                  <td className="px-3 py-2 text-right font-bold text-violet-700 tabular-nums whitespace-nowrap">
                    {/* 박경수님 보고 fix — net_amount 0/null 일 때 subtotal 폴백 (0 도 falsy 처리) */}
                    {formatMoney(Number(r.net_amount && r.net_amount > 0 ? r.net_amount : (r.subtotal ?? 0)))}
                  </td>
                  <td className="px-3 py-2 text-center text-xs text-muted whitespace-nowrap">{r.paid_at ? formatDateKo(r.paid_at) : '-'}</td>
                  <td className="px-3 py-2 text-center">
                    <span className={`inline-flex items-center px-2 py-0.5 rounded-md border text-[11px] font-semibold ${STATUS_STYLE[r.payment_status] ?? STATUS_STYLE['대기']}`}>{r.payment_status}</span>
                  </td>
                  <td className="px-3 py-2 text-right whitespace-nowrap">
                    <span className="inline-flex items-center gap-1">
                      <button type="button" onClick={() => void swap(idx, 'up')} disabled={idx === 0} aria-label="위로" title="위로" className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30"><ArrowUp size={11} aria-hidden="true" /></button>
                      <button type="button" onClick={() => void swap(idx, 'down')} disabled={idx === visible.length - 1} aria-label="아래로" title="아래로" className="inline-flex items-center justify-center w-5 h-5 rounded text-slate-400 hover:bg-violet-50 hover:text-violet-700 disabled:opacity-30"><ArrowDown size={11} aria-hidden="true" /></button>
                      <button type="button" onClick={() => setEditTarget(r as PaymentTarget)} className="inline-flex items-center gap-0.5 text-xs text-violet-600 hover:underline ml-1"><Pencil size={11} aria-hidden="true" />수정</button>
                      <button type="button" onClick={() => void handleDelete(r)} disabled={acting === r.id} className="inline-flex items-center gap-0.5 text-xs text-rose-600 hover:underline disabled:opacity-40 ml-1"><Trash2 size={11} aria-hidden="true" />삭제</button>
                    </span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <PaymentRequestFormModal
        open={formOpen}
        programId={programId}
        projectId={projectId}
        group={group}
        onClose={() => setFormOpen(false)}
        onSaved={() => { setFormOpen(false); void reload(); }}
      />
      <EstimateImportModal open={importOpen} programId={programId} projectId={projectId} group={group}
        onClose={() => setImportOpen(false)} onSaved={() => { setImportOpen(false); void reload(); }} />
      {/* 박경수님 요청 — 행 [수정] 클릭 시 PaymentRequestFormModal 수정 모드 (group 자동 추론) */}
      {editTarget && (
        <PaymentRequestFormModal open={true} programId={programId} projectId={projectId}
          group={isOutsourceType(editTarget.expense_type) ? 'outsource' : 'operation'}
          target={editTarget}
          onClose={() => setEditTarget(null)}
          onSaved={() => { setEditTarget(null); void reload(); }} />
      )}
    </div>
  );
}
