// 지급요청 인건비 폼 필드 그룹 (수취인·주민번호·원천세·계좌)
// PaymentRequestFormModal V-1 분리 + 박경수님 요청 staff_pool 검색 자동채움 (2026-05-26)

import { useEffect, useRef, useState } from 'react';
import { Users } from 'lucide-react';
import { Input } from '../../../components/ui';
import StaffSearchModal, { type SelectedPerson } from '../../../components/ui/StaffSearchModal';
import { supabase } from '../../../lib/supabase';
import { formatMoney } from '../../../lib/utils';
import { calcTax } from '../../../utils/taxUtils';

export interface PersonValues {
  payee_name: string;
  payee_id_no: string;
  bank_name: string;
  bank_account: string;
  tax_rate_type: '3.3' | '8.8' | '면세' | '없음';
}

export const EMPTY_PERSON: PersonValues = {
  payee_name: '', payee_id_no: '', bank_name: '', bank_account: '', tax_rate_type: '3.3',
};

// 박경수님 + SkyClaw — staff_pool 검색 결과 (필요한 컬럼만)
interface StaffSearchResult {
  id: string;
  name: string;
  id_number: string | null;     // 박경수님 환경 컬럼명 (가이드의 resident_number 매핑)
  bank_name: string | null;
  bank_account: string | null;
  staff_type: string | null;    // 가이드의 role 매핑
  position: string | null;
}

function maskRrn(raw: string): string {
  const d = raw.replace(/\D/g, '').slice(0, 13);
  if (d.length < 7) return d;
  return `${d.slice(0, 6)}-${d[6]}******`;
}

interface Props {
  values: PersonValues;
  totalAmount: number;
  onChange: (next: PersonValues) => void;
  disabled?: boolean;
}

export default function PaymentRequestPersonFields({ values, totalAmount, onChange, disabled }: Props) {
  const set = <K extends keyof PersonValues>(k: K, v: PersonValues[K]) => onChange({ ...values, [k]: v });
  const calc = calcTax(totalAmount, values.tax_rate_type);

  // 박경수님 + SkyClaw — staff_pool 검색 + 자동채움
  const [staffResults, setStaffResults] = useState<StaffSearchResult[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const [searching, setSearching] = useState(false);
  const wrapperRef = useRef<HTMLDivElement | null>(null);
  const timeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  // 박경수님 요청 2026-05-26 — [전문가 선택] 모달 (기존 StaffSearchModal 재사용)
  const [staffModalOpen, setStaffModalOpen] = useState(false);

  // 모달에서 선택된 인력의 상세정보(주민번호·은행) fetch 후 자동채움
  async function handleStaffModalSelect(p: SelectedPerson) {
    if (p.sourceType !== 'staff_pool' || !p.id) {
      // profile/manual 은 이름만 채움
      onChange({ ...values, payee_name: p.name });
      return;
    }
    const { data, error } = await supabase
      .from('staff_pool')
      .select('name, id_number, bank_name, bank_account')
      .eq('id', p.id)
      .single();
    if (error || !data) {
      console.error('[PaymentRequestPersonFields] 선택 인력 상세 조회 실패:', error?.message);
      onChange({ ...values, payee_name: p.name });
      return;
    }
    onChange({
      ...values,
      payee_name: data.name,
      payee_id_no: data.id_number ?? '',
      bank_name: data.bank_name ?? '',
      bank_account: data.bank_account ?? '',
    });
  }

  async function runSearch(q: string) {
    if (q.trim().length < 2) { setStaffResults([]); setShowDropdown(false); return; }
    setSearching(true);
    const like = `%${q.trim()}%`;
    // 가이드의 phone 외에 phone_mobile·phone_office 까지 OR 검색
    const { data, error } = await supabase
      .from('staff_pool')
      .select('id, name, id_number, bank_name, bank_account, staff_type, position')
      .or(`name.ilike.${like},phone.ilike.${like},phone_mobile.ilike.${like}`)
      .is('deleted_at', null)
      .limit(10);
    setSearching(false);
    if (error) {
      console.error('[PaymentRequestPersonFields] staff 검색 실패:', error.message);
      setStaffResults([]); setShowDropdown(true);
      return;
    }
    setStaffResults((data ?? []) as StaffSearchResult[]);
    setShowDropdown(true);
  }

  function handleNameChange(v: string) {
    // 직접 입력도 즉시 반영 (검색 안 되더라도 폼 값은 유지)
    onChange({ ...values, payee_name: v });
    if (timeoutRef.current) clearTimeout(timeoutRef.current);
    timeoutRef.current = setTimeout(() => { void runSearch(v); }, 200);
  }

  function selectStaff(s: StaffSearchResult) {
    // 박경수님 요청 — 선택 시 주민번호·은행 자동채움
    onChange({
      ...values,
      payee_name: s.name,
      payee_id_no: s.id_number ?? '',
      bank_name: s.bank_name ?? '',
      bank_account: s.bank_account ?? '',
    });
    setShowDropdown(false);
    setStaffResults([]);
  }

  // 외부 클릭 시 드롭다운 닫기
  useEffect(() => {
    function handleOutside(e: MouseEvent) {
      if (wrapperRef.current && !wrapperRef.current.contains(e.target as Node)) {
        setShowDropdown(false);
      }
    }
    document.addEventListener('mousedown', handleOutside);
    return () => document.removeEventListener('mousedown', handleOutside);
  }, []);

  return (
    <div className="space-y-3 rounded-xl border border-cyan-100 bg-cyan-50/30 p-3">
      <div className="text-xs font-bold text-cyan-700">💼 인건비 (개인)</div>
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {/* 박경수님 + SkyClaw — 수취인명 staff_pool 검색 자동채움 + [전문가 선택] 모달 */}
        <div className="relative space-y-1.5" ref={wrapperRef}>
          <div className="flex items-center justify-between">
            <label className="text-sm font-semibold text-slate-700">
              수취인명 <span className="text-rose-500">*</span>
            </label>
            <button type="button" onClick={() => setStaffModalOpen(true)} disabled={disabled}
              className="inline-flex items-center gap-1 px-2 py-1 rounded-md text-[11px] font-semibold text-violet-700 bg-violet-50 hover:bg-violet-100 border border-violet-200 disabled:opacity-50">
              <Users size={11} aria-hidden="true" /> 전문가 선택
            </button>
          </div>
          <input type="text" value={values.payee_name}
            onChange={(e) => handleNameChange(e.target.value)}
            onFocus={() => { if (staffResults.length > 0) setShowDropdown(true); }}
            disabled={disabled}
            placeholder="이름 검색 (등록된 전문가·직원) — 직접 입력도 가능"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
          {showDropdown && (
            <div className="absolute z-30 left-0 right-0 top-full mt-1 bg-white border border-slate-200 rounded-xl shadow-lg max-h-56 overflow-y-auto">
              {searching && <div className="px-3 py-2 text-xs text-slate-400">검색 중…</div>}
              {!searching && staffResults.length === 0 && values.payee_name.trim().length >= 2 && (
                <div className="px-3 py-2 text-xs text-slate-400">검색 결과 없음 — 직접 입력하세요</div>
              )}
              {staffResults.map((s) => (
                <button key={s.id} type="button" onClick={() => selectStaff(s)}
                  className="block w-full text-left px-3 py-2 text-sm hover:bg-violet-50 border-b border-slate-50 last:border-b-0">
                  <div className="flex items-center justify-between gap-2">
                    <span className="font-semibold text-text">{s.name}</span>
                    <span className="text-[10px] text-slate-400">{s.staff_type ?? s.position ?? ''}</span>
                  </div>
                  <div className="text-[10px] text-slate-400">
                    {s.bank_name ? `${s.bank_name} ${s.bank_account ?? ''}` : '계좌 미등록'}
                    {s.id_number && ' · 주민번호 등록됨'}
                  </div>
                </button>
              ))}
            </div>
          )}
        </div>
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">주민번호</label>
          <input type="text" value={values.payee_id_no} onChange={(e) => set('payee_id_no', e.target.value.replace(/\D/g, '').slice(0, 13))}
            disabled={disabled} placeholder="000000-0000000"
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm tabular-nums outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
          {values.payee_id_no && <p className="text-[10px] text-slate-500">표시 마스킹: {maskRrn(values.payee_id_no)}</p>}
        </div>
      </div>

      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">원천세 구분</label>
        <select value={values.tax_rate_type} onChange={(e) => set('tax_rate_type', e.target.value as PersonValues['tax_rate_type'])}
          disabled={disabled} className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60">
          <option value="3.3">사업소득 3.3%</option>
          <option value="8.8">기타소득 8.8%</option>
          <option value="면세">면세</option>
          <option value="없음">해당없음</option>
        </select>
      </div>

      <div className="rounded-lg bg-white border border-cyan-200 p-2.5 text-xs space-y-1">
        <div className="flex justify-between text-slate-600">
          <span>세전 합계</span>
          <span className="tabular-nums font-semibold">{formatMoney(totalAmount)}</span>
        </div>
        <div className="flex justify-between text-rose-600">
          <span>└ 원천세 ({values.tax_rate_type})</span>
          <span className="tabular-nums">▲ {formatMoney(calc.taxAmount)}</span>
        </div>
        <div className="flex justify-between font-bold text-violet-700 pt-1 border-t border-cyan-100">
          <span>실수령</span>
          <span className="tabular-nums">{formatMoney(calc.netAmount)}</span>
        </div>
      </div>

      <div className="grid grid-cols-2 gap-3">
        <Input label="은행명" value={values.bank_name} onChange={(e) => set('bank_name', e.target.value)} disabled={disabled} placeholder="예) 국민은행" />
        <Input label="계좌번호" value={values.bank_account} onChange={(e) => set('bank_account', e.target.value)} disabled={disabled} placeholder="123-456-789" />
      </div>

      {/* 박경수님 요청 — 전문가 선택 모달 (기존 StaffSearchModal 재사용, 임시등록·직접추가 지원) */}
      <StaffSearchModal
        open={staffModalOpen}
        role="강사"
        allowManual
        onClose={() => setStaffModalOpen(false)}
        onSelect={(p) => { void handleStaffModalSelect(p); setStaffModalOpen(false); }}
      />
    </div>
  );
}
