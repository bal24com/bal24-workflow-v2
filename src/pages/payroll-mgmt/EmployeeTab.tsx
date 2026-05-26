// 직원 관리 탭 — 박경수님 + SkyClaw STEP-PAYROLL-SYSTEM (2026-05-28)
// employee_details + profiles join. 주민번호 마스킹. 상세·수정 폼 통합 모달.

import { useCallback, useEffect, useState } from 'react';
import { Plus, Loader2, UserCog, Eye, EyeOff } from 'lucide-react';
import { Button, Modal, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { formatMoney } from '../../lib/utils';
import { useUserProfile } from '../../hooks/useUserProfile';
// 박경수님 + SkyClaw STEP-RBAC-RLS-PHASE1 (2026-05-28) — DB 의 resident_number 는 암호문. 표시는 항상 고정 마스크.
const MASK_RN = '******-*******';

interface EmployeeRow {
  id: string;
  profile_id: string;
  employee_no: string | null;
  department: string | null;
  position: string | null;
  employment_type: string;
  hire_date: string | null;
  base_salary: number;
  resident_number: string | null;
  bank_name: string | null;
  account_number: string | null;
  account_holder: string | null;
  profile: { id: string; name: string; email: string | null } | null;
}

const EMPTY_FORM = { employee_no: '', department: '', position: '', employment_type: 'full_time', hire_date: '', base_salary: '0', resident_number: '', bank_name: '', account_number: '', account_holder: '' };

export default function EmployeeTab() {
  const toast = useToast();
  const { isFinance } = useUserProfile(); // admin/finance 만 🔓 노출
  const [rows, setRows] = useState<EmployeeRow[]>([]);
  const [profiles, setProfiles] = useState<Array<{ id: string; name: string }>>([]);
  const [loading, setLoading] = useState(true);
  const [formOpen, setFormOpen] = useState(false);
  const [editTarget, setEditTarget] = useState<EmployeeRow | null>(null);
  const [profileId, setProfileId] = useState('');
  const [form, setForm] = useState(EMPTY_FORM);
  const [saving, setSaving] = useState(false);
  // 박경수님 + SkyClaw STEP-RBAC-RLS-PHASE1 — 🔓 복호화 결과 임시 보관 (id → 평문)
  const [revealed, setRevealed] = useState<Record<string, string>>({});
  const [revealing, setRevealing] = useState<string | null>(null);

  async function handleReveal(employeeId: string) {
    if (revealed[employeeId]) {
      // 이미 표시 중이면 다시 가림
      setRevealed((prev) => { const next = { ...prev }; delete next[employeeId]; return next; });
      return;
    }
    setRevealing(employeeId);
    const { data, error } = await supabase.functions.invoke('decrypt-pii', {
      body: { employeeId },
    });
    setRevealing(null);
    if (error) {
      console.error('[EmployeeTab] 복호화 실패:', error.message);
      toast.error(`주민번호 복호화에 실패했어요: ${error.message}`);
      return;
    }
    const rn = (data as { residentNumber: string | null } | null)?.residentNumber;
    if (!rn) { toast.warning('등록된 주민번호가 없어요.'); return; }
    setRevealed((prev) => ({ ...prev, [employeeId]: rn }));
  }

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase.from('employee_details')
      .select('*, profile:profiles!employee_details_profile_id_fkey(id, name, email)')
      .is('deleted_at', null).order('employee_no');
    setLoading(false);
    if (error) { console.error('[EmployeeTab] 조회 실패:', error.message); toast.error('직원 목록 조회 실패'); return; }
    setRows((data ?? []) as EmployeeRow[]);
  }, [toast]);

  useEffect(() => { void reload(); }, [reload]);
  useEffect(() => {
    void supabase.from('profiles').select('id, name').eq('is_active', true).order('name')
      .then(({ data }) => setProfiles((data ?? []) as Array<{ id: string; name: string }>));
  }, []);

  function openNew() {
    setEditTarget(null); setProfileId(''); setForm(EMPTY_FORM); setFormOpen(true);
  }
  function openEdit(r: EmployeeRow) {
    setEditTarget(r); setProfileId(r.profile_id);
    setForm({
      employee_no: r.employee_no ?? '', department: r.department ?? '', position: r.position ?? '',
      employment_type: r.employment_type, hire_date: r.hire_date ?? '',
      // 박경수님 + SkyClaw STEP-RBAC-RLS-PHASE1 — 주민번호는 보안상 모달에서 미표시. 변경 시만 재입력
      base_salary: String(r.base_salary), resident_number: '',
      bank_name: r.bank_name ?? '', account_number: r.account_number ?? '', account_holder: r.account_holder ?? '',
    });
    setFormOpen(true);
  }

  async function handleSave() {
    if (!profileId) { toast.error('팀원을 선택해 주세요.'); return; }
    setSaving(true);
    // 박경수님 + SkyClaw STEP-RBAC-RLS-PHASE1 — 수정 시 resident_number 빈 값이면 미변경 (기존 암호문 보존)
    const skipRn = !!editTarget && !form.resident_number;
    const payload: Record<string, unknown> = { profile_id: profileId, employee_no: form.employee_no || null, department: form.department || null, position: form.position || null, employment_type: form.employment_type, hire_date: form.hire_date || null, base_salary: Number(form.base_salary) || 0, bank_name: form.bank_name || null, account_number: form.account_number || null, account_holder: form.account_holder || null };
    if (!skipRn) payload.resident_number = form.resident_number || null;
    const res = editTarget
      ? await supabase.from('employee_details').update(payload).eq('id', editTarget.id)
      : await supabase.from('employee_details').insert(payload);
    setSaving(false);
    if (res.error) { console.error('[EmployeeTab] 저장 실패:', res.error.message); toast.error(`저장 실패: ${res.error.message}`); return; }
    toast.success(editTarget ? '수정했어요.' : '직원을 등록했어요.'); setFormOpen(false); void reload();
  }

  return (
    <div className="space-y-4">
      <div className="flex items-center justify-between">
        <h3 className="text-sm font-bold text-slate-800 inline-flex items-center gap-1.5"><UserCog size={14} aria-hidden="true" />직원 목록 ({rows.length}명)</h3>
        <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={openNew}>직원 등록</Button>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-10 text-xs text-slate-400"><Loader2 size={14} className="animate-spin mr-1.5" aria-hidden="true" /> 불러오는 중…</div>
      ) : rows.length === 0 ? (
        <p className="text-center py-8 text-xs text-slate-400">등록된 직원이 없어요. [직원 등록] 으로 시작하세요.</p>
      ) : (
        <div className="bg-white rounded-xl border border-slate-200 overflow-x-auto">
          <table className="w-full text-sm">
            <thead className="bg-slate-50 text-slate-500 text-xs">
              <tr>
                <th className="text-left px-3 py-2.5 font-semibold">사원번호</th>
                <th className="text-left px-3 py-2.5 font-semibold">성명</th>
                <th className="text-left px-3 py-2.5 font-semibold">부서/직급</th>
                <th className="text-left px-3 py-2.5 font-semibold">입사일</th>
                <th className="text-right px-3 py-2.5 font-semibold">기본급</th>
                <th className="text-left px-3 py-2.5 font-semibold">주민번호</th>
                <th className="text-left px-3 py-2.5 font-semibold">은행/계좌</th>
                <th className="text-right px-3 py-2.5 font-semibold">관리</th>
              </tr>
            </thead>
            <tbody className="divide-y divide-slate-100">
              {rows.map((r) => (
                <tr key={r.id} className="hover:bg-violet-50/40">
                  <td className="px-3 py-2 text-xs">{r.employee_no ?? '-'}</td>
                  <td className="px-3 py-2 text-sm font-semibold">{r.profile?.name ?? '-'}</td>
                  <td className="px-3 py-2 text-xs">{[r.department, r.position].filter(Boolean).join(' · ') || '-'}</td>
                  <td className="px-3 py-2 text-xs">{r.hire_date ?? '-'}</td>
                  <td className="px-3 py-2 text-right tabular-nums">{formatMoney(r.base_salary)}</td>
                  <td className="px-3 py-2 text-xs font-mono">
                    <span className="inline-flex items-center gap-1.5">
                      <span>{revealed[r.id] ?? MASK_RN}</span>
                      {isFinance && r.resident_number && (
                        <button type="button" onClick={() => void handleReveal(r.id)}
                          disabled={revealing === r.id}
                          aria-label={revealed[r.id] ? '주민번호 가리기' : '주민번호 보기'}
                          title={revealed[r.id] ? '가리기' : '보기 (admin/finance 전용)'}
                          className="text-violet-500 hover:text-violet-700 disabled:opacity-40">
                          {revealing === r.id ? <Loader2 size={12} className="animate-spin" aria-hidden="true" />
                            : revealed[r.id] ? <EyeOff size={12} aria-hidden="true" />
                            : <Eye size={12} aria-hidden="true" />}
                        </button>
                      )}
                    </span>
                  </td>
                  <td className="px-3 py-2 text-xs">{r.bank_name && r.account_number ? `${r.bank_name} ${r.account_number}` : '-'}</td>
                  <td className="px-3 py-2 text-right">
                    <button type="button" onClick={() => openEdit(r)} className="text-xs text-violet-600 hover:underline">수정</button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}

      <Modal open={formOpen} onClose={() => setFormOpen(false)} title={editTarget ? '직원 수정' : '직원 등록'} size="lg"
        footer={<><Button variant="ghost" onClick={() => setFormOpen(false)} disabled={saving}>취소</Button><Button variant="primary" onClick={() => void handleSave()} loading={saving}>저장하기</Button></>}>
        <div className="grid grid-cols-2 gap-3">
          <div className="col-span-2">
            <label className="text-xs font-semibold text-slate-700">팀원 (profiles)</label>
            <select value={profileId} onChange={(e) => setProfileId(e.target.value)} disabled={!!editTarget}
              className="w-full h-10 rounded-xl border border-slate-200 px-3 text-sm">
              <option value="">선택 안함</option>
              {profiles.map((p) => <option key={p.id} value={p.id}>{p.name}</option>)}
            </select>
          </div>
          <Input label="사원번호" value={form.employee_no} onChange={(e) => setForm({ ...form, employee_no: e.target.value })} placeholder="001" />
          <Input label="입사일" type="date" value={form.hire_date} onChange={(e) => setForm({ ...form, hire_date: e.target.value })} />
          <Input label="부서" value={form.department} onChange={(e) => setForm({ ...form, department: e.target.value })} />
          <Input label="직급" value={form.position} onChange={(e) => setForm({ ...form, position: e.target.value })} />
          <Input label="기본급 (원)" type="number" value={form.base_salary} onChange={(e) => setForm({ ...form, base_salary: e.target.value })} />
          <Input label="주민번호" value={form.resident_number} onChange={(e) => setForm({ ...form, resident_number: e.target.value })}
            placeholder={editTarget ? '변경 시 새로 입력 (빈 값 = 미변경)' : '13자리 (저장 시 자동 암호화)'} />
          <Input label="은행명" value={form.bank_name} onChange={(e) => setForm({ ...form, bank_name: e.target.value })} />
          <Input label="계좌번호" value={form.account_number} onChange={(e) => setForm({ ...form, account_number: e.target.value })} />
          <Input label="예금주" value={form.account_holder} onChange={(e) => setForm({ ...form, account_holder: e.target.value })} />
        </div>
      </Modal>
    </div>
  );
}
