// 급여 파일 업로드 + AI 자동매칭 모달 — 박경수님 + SkyClaw STEP-PAYROLL-IMPORT (2026-05-28)
// 파일 선택 → AI 분석 → 미리보기 → 매칭 보정 → 확인 등록 (payroll_registers + payroll_slips upsert)

import { useEffect, useState, useRef } from 'react';
import { Upload, Loader2, Sparkles, FileText } from 'lucide-react';
import { Button, Modal } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import PayrollImportPreviewTable from './PayrollImportPreviewTable';
import { parsePayrollFile, matchEmployees, type ParsedPayrollRegister, type EmployeeOption } from './payrollImportUtils';

interface Props { open: boolean; onClose: () => void; onImported: () => void }

export default function PayrollImportModal({ open, onClose, onImported }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const inputRef = useRef<HTMLInputElement | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [analyzing, setAnalyzing] = useState(false);
  const [parsed, setParsed] = useState<ParsedPayrollRegister | null>(null);
  const [employees, setEmployees] = useState<EmployeeOption[]>([]);
  const [saving, setSaving] = useState(false);

  useEffect(() => {
    if (!open) { setFile(null); setParsed(null); setAnalyzing(false); return; }
    void supabase.from('employee_details')
      .select('id, employee_no, profile:profiles!employee_details_profile_id_fkey(name)')
      .is('deleted_at', null).order('employee_no')
      .then(({ data, error }) => {
        if (error) console.error('[PayrollImportModal] 직원 조회 실패:', error.message);
        setEmployees((data ?? []) as unknown as EmployeeOption[]);
      });
  }, [open]);

  async function handleAnalyze() {
    if (!file) { toast.error('파일을 먼저 선택해 주세요.'); return; }
    setAnalyzing(true);
    try {
      const result = await parsePayrollFile(file);
      const matched = matchEmployees(result.slips, employees);
      setParsed({ ...result, slips: matched });
      const unmatched = matched.filter((s) => !s.matchedEmployeeId).length;
      if (unmatched > 0) toast.success(`AI 분석 완료. 매칭 필요 ${unmatched}건 — 드롭다운에서 선택해 주세요.`);
      else toast.success('AI 분석 완료. 모든 직원 자동 매칭됐어요.');
    } catch (err) {
      const msg = err instanceof Error ? err.message : 'AI 분석 실패';
      console.error('[PayrollImportModal] 분석 실패:', msg);
      toast.error(msg);
    } finally { setAnalyzing(false); }
  }

  function handleMatchChange(idx: number, employeeId: string | null) {
    if (!parsed) return;
    setParsed({ ...parsed, slips: parsed.slips.map((s, i) => i === idx ? { ...s, matchedEmployeeId: employeeId } : s) });
  }

  async function handleConfirm() {
    if (!parsed || !user) return;
    const unmatched = parsed.slips.filter((s) => !s.matchedEmployeeId);
    if (unmatched.length > 0) { toast.error(`직원 매칭이 필요한 항목이 ${unmatched.length}건 있어요.`); return; }
    setSaving(true);
    try {
      // 1) payroll_registers upsert (year+month UNIQUE)
      const regUpsert = await supabase.from('payroll_registers')
        .upsert({ year: parsed.year, month: parsed.month, payment_date: parsed.paymentDate, status: 'draft' }, { onConflict: 'year,month' })
        .select('id').single();
      if (regUpsert.error) throw regUpsert.error;
      const registerId = (regUpsert.data as { id: string }).id;

      // 2) 기존 슬립 삭제 후 재삽입 (간단화 — register_id 기준 전체 교체)
      await supabase.from('payroll_slips').delete().eq('register_id', registerId);
      const slipRows = parsed.slips.map((s) => ({
        register_id: registerId, employee_id: s.matchedEmployeeId,
        base_salary: s.baseSalary, national_pension: s.nationalPension, health_insurance: s.healthInsurance,
        employment_insurance: s.employmentInsurance, long_term_care: s.longTermCare,
        income_tax: s.incomeTax, local_income_tax: s.localIncomeTax,
        health_adjustment: s.healthAdjustment, care_adjustment: s.careAdjustment,
        total_payment: s.totalPayment, total_deduction: s.totalDeduction, net_payment: s.netPayment,
      }));
      const slipIns = await supabase.from('payroll_slips').insert(slipRows);
      if (slipIns.error) throw slipIns.error;

      // 3) 임포트 로그
      await supabase.from('payroll_import_logs').insert({ register_id: registerId, file_name: file?.name ?? '', file_type: 'payroll_register', imported_by: user.id, ai_result: parsed as unknown as Record<string, unknown>, status: 'success' });

      toast.success(`${parsed.year}년 ${parsed.month}월 급여대장 ${parsed.slips.length}건 등록했어요.`);
      onImported(); onClose();
    } catch (err) {
      const msg = err instanceof Error ? err.message : '';
      console.error('[PayrollImportModal] 저장 실패:', msg);
      toast.error(`저장 실패: ${msg}`);
    } finally { setSaving(false); }
  }

  return (
    <Modal open={open} onClose={onClose} title="급여 파일 가져오기 (AI 자동매칭)" size="lg"
      footer={<>
        <Button variant="ghost" onClick={onClose} disabled={saving}>취소</Button>
        {parsed && <Button variant="primary" onClick={() => void handleConfirm()} loading={saving} className="!bg-emerald-600 hover:!bg-emerald-700">✅ 확인하고 등록하기</Button>}
      </>}>
      <div className="space-y-4">
        {/* 파일 선택 */}
        <div className="border-2 border-dashed border-slate-300 rounded-xl p-4 text-center bg-slate-50">
          <Upload size={24} className="mx-auto text-slate-400 mb-2" aria-hidden="true" />
          <p className="text-xs text-slate-600 mb-2">📎 급여대장 또는 급여명세서 파일 (PDF / Excel / CSV)</p>
          <input ref={inputRef} type="file" accept=".pdf,.xlsx,.xls,.csv,.txt" onChange={(e) => setFile(e.target.files?.[0] ?? null)} className="hidden" />
          <Button variant="outline" size="sm" leftIcon={<FileText size={12} />} onClick={() => inputRef.current?.click()} disabled={analyzing || saving}>
            {file ? '파일 변경' : '파일 선택'}
          </Button>
          {file && <p className="mt-2 text-xs text-violet-700 font-semibold">선택됨: {file.name}</p>}
        </div>

        {/* AI 분석 버튼 */}
        {file && !parsed && (
          <Button variant="primary" leftIcon={<Sparkles size={14} />} onClick={() => void handleAnalyze()} loading={analyzing} className="w-full">
            {analyzing ? 'AI 분석 중…' : '🤖 AI로 자동 분석'}
          </Button>
        )}

        {/* 분석 중 스피너 */}
        {analyzing && (
          <div className="flex items-center justify-center gap-2 py-4 text-xs text-slate-500">
            <Loader2 size={14} className="animate-spin" aria-hidden="true" /> AI가 급여 데이터를 추출하고 있어요…
          </div>
        )}

        {/* 미리보기 */}
        {parsed && (
          <div className="space-y-3">
            <div className="px-3 py-2 bg-violet-50 border border-violet-200 rounded-lg text-xs text-violet-700">
              📅 <strong>{parsed.year}년 {parsed.month}월</strong> | 지급일: {parsed.paymentDate ?? '미정'} | 직원 {parsed.slips.length}명
            </div>
            <PayrollImportPreviewTable slips={parsed.slips} employees={employees} onMatchChange={handleMatchChange} />
          </div>
        )}
      </div>
    </Modal>
  );
}
