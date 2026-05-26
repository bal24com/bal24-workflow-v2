// 외주/급여 Excel 일괄 등록 모달 — STEP-ACCOUNTING-ALL P3
// SheetJS(xlsx) 로 파일 파싱 → COLUMN_MAP 매핑 → 미리보기 → 일괄 insert

import { useState } from 'react';
import { Upload, FileSpreadsheet, AlertCircle } from 'lucide-react';
import * as XLSX from 'xlsx';
import { Modal, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { calcTax } from '../../utils/taxUtils';
import type { PayrollExpenseType, PayrollTaxRateType } from '../../types/database';
import { IMPORT_COLUMN_MAP, type ImportRow } from './payrollUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  onImported: () => void;
}

interface ParsedRow extends ImportRow {
  _rowIdx: number;
  _error?: string;
}

const VALID_TYPES: PayrollExpenseType[] = ['강사료', '촬영', '운영비', '운영인건비', '기타외주'];
const VALID_TAX: PayrollTaxRateType[] = ['3.3', '8.8', '면세', '없음'];

function normalizeRow(raw: Record<string, unknown>, idx: number): ParsedRow {
  const out: ParsedRow = { _rowIdx: idx };
  for (const [koCol, fieldKey] of Object.entries(IMPORT_COLUMN_MAP)) {
    const v = raw[koCol];
    if (v === undefined || v === null || v === '') continue;
    if (fieldKey === 'unit_price' || fieldKey === 'quantity') {
      const num = Number(String(v).replace(/[^0-9.-]/g, ''));
      if (!Number.isNaN(num)) (out[fieldKey] as number) = num;
    } else if (fieldKey === 'tax_rate_type') {
      const s = String(v).trim();
      if (VALID_TAX.includes(s as PayrollTaxRateType)) out.tax_rate_type = s as PayrollTaxRateType;
      else out._error = `세액구분 값 오류 (${s})`;
    } else if (fieldKey === 'expense_type') {
      const s = String(v).trim();
      if (VALID_TYPES.includes(s as PayrollExpenseType)) out.expense_type = s as PayrollExpenseType;
      else out._error = `구분 값 오류 (${s})`;
    } else {
      (out[fieldKey] as string) = String(v).trim();
    }
  }
  if (!out._error) {
    if (!out.payee_name) out._error = '성명 누락';
    else if (out.unit_price === undefined) out._error = '단가 누락';
  }
  return out;
}

export default function PayrollImportModal({ open, onClose, onImported }: Props) {
  const toast = useToast();
  const [rows, setRows] = useState<ParsedRow[]>([]);
  const [fileName, setFileName] = useState('');
  const [importing, setImporting] = useState(false);

  function handleFile(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (!file) return;
    setFileName(file.name);
    const reader = new FileReader();
    reader.onload = (ev) => {
      try {
        const data = new Uint8Array(ev.target?.result as ArrayBuffer);
        const wb = XLSX.read(data, { type: 'array' });
        const sheet = wb.Sheets[wb.SheetNames[0]];
        const raw = XLSX.utils.sheet_to_json<Record<string, unknown>>(sheet, { defval: '' });
        const parsed = raw.map((r, idx) => normalizeRow(r, idx + 2));
        setRows(parsed);
      } catch (err) {
        const msg = err instanceof Error ? err.message : '';
        console.error('[PayrollImportModal] 파싱 실패:', msg);
        toast.error('Excel 파일을 읽지 못했어요. 양식을 확인해 주세요.');
      }
    };
    reader.readAsArrayBuffer(file);
  }

  async function handleImport() {
    const valid = rows.filter((r) => !r._error);
    if (valid.length === 0) { toast.error('등록할 유효한 행이 없어요.'); return; }
    setImporting(true);
    try {
      const payloads = valid.map((r) => {
        const subtotal = (r.unit_price ?? 0) * (r.quantity ?? 1);
        const { taxAmount, netAmount } = calcTax(subtotal, r.tax_rate_type ?? '3.3');
        return {
          expense_type: r.expense_type ?? '강사료',
          description: r.description ?? null,
          payee_name: r.payee_name as string,
          payee_id_no: r.payee_id_no ?? null,
          bank_name: r.bank_name ?? null,
          bank_account: r.bank_account ?? null,
          unit_price: r.unit_price ?? 0,
          quantity: r.quantity ?? 1,
          tax_rate_type: r.tax_rate_type ?? '3.3',
          tax_amount: taxAmount,
          net_amount: netAmount,
          payment_status: 'submitted' as const, // STEP-PAYROLL-STATUS-FLOW — 임포트 = 재무 영역 입력
        };
      });
      const { error } = await supabase.from('payroll_expenses').insert(payloads);
      if (error) throw error;
      toast.success(`${valid.length}건 일괄 등록 완료. ${rows.length - valid.length}건은 오류로 제외됐어요.`);
      setRows([]);
      setFileName('');
      onImported();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[PayrollImportModal] insert 실패:', msg);
      toast.error('일괄 등록 중 오류가 발생했어요.');
    } finally {
      setImporting(false);
    }
  }

  const validCount = rows.filter((r) => !r._error).length;
  const errorCount = rows.length - validCount;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="Excel 일괄 등록"
      size="lg"
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={onClose} disabled={importing}>취소</Button>
          <Button variant="primary" onClick={() => void handleImport()} loading={importing} disabled={validCount === 0}>
            {validCount}건 등록하기
          </Button>
        </div>
      }
    >
      <div className="space-y-4">
        <div className="rounded-xl bg-amber-50 border border-amber-200 px-4 py-3 text-xs text-amber-900">
          <div className="font-bold mb-1">📋 지원 컬럼 (헤더 행 정확히 일치)</div>
          <div>구분 / 내용 / 성명 / 주민번호 / 은행명 / 계좌번호 / 단가 / 회수 / 세액구분</div>
          <div className="mt-1 text-amber-700">* 합계·원천세·실지급은 자동 계산됩니다.</div>
        </div>

        <label className="block">
          <div className="flex items-center gap-2 px-4 py-3 rounded-xl border-2 border-dashed border-slate-300 cursor-pointer hover:bg-slate-50 transition-colors">
            <FileSpreadsheet size={20} className="text-violet-500" aria-hidden="true" />
            <span className="text-sm font-semibold text-slate-700">
              {fileName ? fileName : 'Excel 파일 선택 (.xlsx · .xls)'}
            </span>
            <Upload size={14} className="ml-auto text-slate-400" aria-hidden="true" />
          </div>
          <input type="file" accept=".xlsx,.xls" onChange={handleFile} className="hidden" />
        </label>

        {rows.length > 0 && (
          <>
            <div className="flex items-center gap-3 text-xs">
              <span className="font-semibold text-emerald-600">✅ 등록 가능 {validCount}건</span>
              {errorCount > 0 && <span className="font-semibold text-rose-600">⚠️ 오류 {errorCount}건</span>}
            </div>
            <div className="max-h-[320px] overflow-y-auto border border-slate-200 rounded-xl">
              <table className="w-full text-xs">
                <thead className="bg-slate-50 text-slate-500 sticky top-0">
                  <tr>
                    <th className="px-2 py-1.5 text-left">행</th>
                    <th className="px-2 py-1.5 text-left">성명</th>
                    <th className="px-2 py-1.5 text-left">내용</th>
                    <th className="px-2 py-1.5 text-left">구분</th>
                    <th className="px-2 py-1.5 text-right">단가</th>
                    <th className="px-2 py-1.5 text-right">회수</th>
                    <th className="px-2 py-1.5 text-left">세액</th>
                    <th className="px-2 py-1.5 text-left">상태</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {rows.slice(0, 100).map((r) => (
                    <tr key={r._rowIdx} className={r._error ? 'bg-rose-50/40' : ''}>
                      <td className="px-2 py-1 text-muted">{r._rowIdx}</td>
                      <td className="px-2 py-1">{r.payee_name ?? '-'}</td>
                      <td className="px-2 py-1 truncate max-w-[140px]">{r.description ?? '-'}</td>
                      <td className="px-2 py-1">{r.expense_type ?? '-'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.unit_price?.toLocaleString() ?? '-'}</td>
                      <td className="px-2 py-1 text-right tabular-nums">{r.quantity ?? '-'}</td>
                      <td className="px-2 py-1">{r.tax_rate_type ?? '-'}</td>
                      <td className="px-2 py-1">
                        {r._error
                          ? <span className="inline-flex items-center gap-1 text-rose-600"><AlertCircle size={10} />{r._error}</span>
                          : <span className="text-emerald-600">OK</span>}
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
              {rows.length > 100 && (
                <div className="px-3 py-2 text-center text-xs text-muted">
                  미리보기 100건만 표시 · 실제 등록은 전체 {validCount}건
                </div>
              )}
            </div>
          </>
        )}
      </div>
    </Modal>
  );
}
