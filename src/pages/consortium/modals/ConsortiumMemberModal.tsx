// bal24 v2 — STEP-CONSORTIUM-REDESIGN (박경수님 2026-05-27)
// 참여사 등록·수정 모달 — 자사 ⭐ · 역할 · 지분율 · 정산 방향 · 자동계산.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, X, Calculator } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import type {
  Client, ConsortiumMember, ConsortiumRole, ConsortiumSettlementDirection,
} from '../../../types/database';
import { calcBudgetFromShare } from '../consortiumMemberUtils';

interface Props {
  open: boolean;
  consortiumId: string;
  totalBudget: number | null | undefined;
  member: ConsortiumMember | null;       // null = 신규 등록, 객체 = 수정
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
  client_id: string;
  org_name: string;
  role: ConsortiumRole;
  share_rate: number;
  settlement_direction: ConsortiumSettlementDirection;
  budget_amount: number;
  responsibilities: string;
  notes: string;
  is_self: boolean;
}

const EMPTY: FormState = {
  client_id: '', org_name: '', role: '참여', share_rate: 0,
  settlement_direction: 'outbound', budget_amount: 0,
  responsibilities: '', notes: '', is_self: false,
};

const INPUT_CLASS =
  'w-full h-[40px] border border-gray-200 rounded-lg px-3 text-sm ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 ' +
  'disabled:bg-slate-50';

export default function ConsortiumMemberModal({
  open, consortiumId, totalBudget, member, onClose, onSaved,
}: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [clients, setClients] = useState<Client[]>([]);
  const [saving, setSaving] = useState(false);

  // 클라이언트 목록 fetch — 자사 최상단
  const fetchClients = useCallback(async () => {
    const { data, error } = await supabase
      .from('clients')
      .select('id, name, is_own_company')
      .is('deleted_at', null)
      .order('is_own_company', { ascending: false })
      .order('name', { ascending: true });
    if (error) {
      console.error('[ConsortiumMemberModal] clients fetch:', error.message);
      return;
    }
    setClients((data ?? []) as Client[]);
  }, []);

  useEffect(() => {
    if (!open) return;
    void fetchClients();
    if (member) {
      setForm({
        client_id: member.client_id ?? '',
        org_name: member.org_name ?? '',
        role: (member.role as ConsortiumRole) ?? '참여',
        share_rate: Number(member.share_rate ?? 0),
        settlement_direction: (member.settlement_direction as ConsortiumSettlementDirection) ?? 'outbound',
        budget_amount: Number(member.budget_amount ?? 0),
        responsibilities: member.responsibilities ?? '',
        notes: '',
        is_self: !!member.is_self,
      });
    } else {
      setForm(EMPTY);
    }
  }, [open, member, fetchClients]);

  if (!open) return null;

  function handleClientSelect(clientId: string) {
    const c = clients.find((x) => x.id === clientId);
    setForm((prev) => ({
      ...prev,
      client_id: clientId,
      org_name: c?.name ?? prev.org_name,
      is_self: !!c?.is_own_company,
    }));
  }

  function handleAutoCalc() {
    if (!totalBudget) {
      toast.error('컨소시엄 총사업비가 등록되지 않았어요.');
      return;
    }
    const calc = calcBudgetFromShare(totalBudget, form.share_rate);
    setForm((prev) => ({ ...prev, budget_amount: calc }));
  }

  async function handleSave() {
    if (!form.client_id && !form.org_name.trim()) {
      toast.error('참여사명을 입력해 주세요.');
      return;
    }
    if (form.share_rate < 0 || form.share_rate > 100) {
      toast.error('지분율은 0~100 사이로 입력해 주세요.');
      return;
    }
    setSaving(true);
    const payload = {
      consortium_id: consortiumId,
      client_id: form.client_id || null,
      org_name: form.org_name.trim(),
      role: form.role,
      share_rate: form.share_rate,
      settlement_direction: form.settlement_direction,
      budget_amount: form.budget_amount,
      responsibilities: form.responsibilities.trim() || null,
      is_self: form.is_self,
    };
    const { error } = member?.id
      ? await supabase.from('consortium_members').update(payload).eq('id', member.id)
      : await supabase.from('consortium_members').insert(payload);
    setSaving(false);
    if (error) {
      console.error('[ConsortiumMemberModal] 저장 오류:', error);
      toast.error('참여사 저장 중 오류가 발생했어요.');
      return;
    }
    toast.success(member?.id ? '참여사 정보를 수정했어요.' : '참여사를 등록했어요.');
    onSaved();
    onClose();
  }

  // 박경수님 2026-05-26 — 백드롭 클릭 시 mousedown 이 백드롭에서 시작된 경우에만 닫기
  const mouseDownOnBackdropRef = { current: false };

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-slate-900/40 backdrop-blur-sm p-4"
      role="dialog" aria-modal="true"
      onMouseDown={(e) => { if (e.target === e.currentTarget) mouseDownOnBackdropRef.current = true; }}
      onMouseUp={(e) => {
        if (e.target === e.currentTarget && mouseDownOnBackdropRef.current) onClose();
        mouseDownOnBackdropRef.current = false;
      }}>
      <div className="bg-white w-full max-w-xl rounded-2xl shadow-xl" onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between px-5 py-3 border-b border-slate-100">
          <h3 className="text-base font-bold text-[#1E1B4B]">
            {member?.id ? '참여사 수정' : '참여사 등록'}
          </h3>
          <button type="button" onClick={onClose}
            className="inline-flex items-center justify-center w-8 h-8 rounded text-slate-400 hover:bg-slate-100">
            <X size={14} />
          </button>
        </header>

        <div className="px-5 py-4 space-y-3 max-h-[70vh] overflow-y-auto">
          {/* 참여사 선택 — 자사 ⭐ 최상단 */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">참여사 선택</label>
            <select value={form.client_id} disabled={saving}
              onChange={(e) => handleClientSelect(e.target.value)}
              className={INPUT_CLASS}>
              <option value="">— 직접 입력 —</option>
              {clients.map((c) => (
                <option key={c.id} value={c.id}>
                  {c.is_own_company ? `⭐ ${c.name} (자사)` : c.name}
                </option>
              ))}
            </select>
          </div>

          {/* 참여사명 직접 입력 */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">참여사명 <span className="text-rose-500">*</span></label>
            <input type="text" value={form.org_name} disabled={saving}
              onChange={(e) => setForm({ ...form, org_name: e.target.value })}
              placeholder="예) (주)밸런스닷"
              className={INPUT_CLASS} />
          </div>

          {/* 역할 — 박경수님 2026-05-27 A안: 총괄(운영사) / 참여(참여사) 2종 */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">역할</label>
            <div className="flex items-center gap-4">
              {([
                { v: '총괄' as ConsortiumRole, label: '총괄', desc: '운영사' },
                { v: '참여' as ConsortiumRole, label: '참여', desc: '참여사' },
              ]).map((r) => (
                <label key={r.v} className="inline-flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="role" value={r.v} checked={form.role === r.v}
                    onChange={() => setForm({ ...form, role: r.v })} disabled={saving}
                    className="text-violet-600" />
                  <span className="text-sm text-slate-700">
                    {r.label} <span className="text-[11px] text-slate-400">({r.desc})</span>
                  </span>
                </label>
              ))}
            </div>
          </div>

          {/* 지분율 + 자동계산 */}
          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">지분율 (%)</label>
              <input type="number" min={0} max={100} step={0.1}
                value={form.share_rate} disabled={saving}
                onChange={(e) => setForm({ ...form, share_rate: Number(e.target.value) })}
                className={INPUT_CLASS} />
            </div>
            <div>
              <label className="text-xs font-semibold text-slate-700 block mb-1">예산 배정액 (원)</label>
              <div className="flex items-stretch gap-1">
                <input type="number" min={0} step={1000}
                  value={form.budget_amount} disabled={saving}
                  onChange={(e) => setForm({ ...form, budget_amount: Number(e.target.value) })}
                  className={INPUT_CLASS + ' flex-1'} />
                <button type="button" onClick={handleAutoCalc} disabled={saving}
                  title="총사업비 × 지분율 / 100"
                  className="px-2.5 rounded-lg border border-violet-300 text-violet-700 text-xs font-bold hover:bg-violet-50 disabled:opacity-50">
                  <Calculator size={12} className="inline" aria-hidden="true" /> 자동
                </button>
              </div>
            </div>
          </div>

          {/* 정산 방향 */}
          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1.5">정산 방향</label>
            <div className="space-y-1">
              {([
                { v: 'outbound', label: '밸런스닷 → 참여사 지급' },
                { v: 'inbound',  label: '참여사 → 밸런스닷 수령' },
                { v: 'none',     label: '해당 없음' },
              ] as Array<{ v: ConsortiumSettlementDirection; label: string }>).map((opt) => (
                <label key={opt.v} className="flex items-center gap-1.5 cursor-pointer">
                  <input type="radio" name="settlement" value={opt.v}
                    checked={form.settlement_direction === opt.v}
                    onChange={() => setForm({ ...form, settlement_direction: opt.v })}
                    disabled={saving} className="text-violet-600" />
                  <span className="text-sm text-slate-700">{opt.label}</span>
                </label>
              ))}
            </div>
          </div>

          <div>
            <label className="text-xs font-semibold text-slate-700 block mb-1">담당 업무</label>
            <input type="text" value={form.responsibilities} disabled={saving}
              onChange={(e) => setForm({ ...form, responsibilities: e.target.value })}
              placeholder="예) 콘텐츠 개발, 운영 총괄"
              className={INPUT_CLASS} />
          </div>
        </div>

        <footer className="px-5 py-3 border-t border-slate-100 flex items-center justify-end gap-1.5">
          <button type="button" onClick={onClose} disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-semibold text-slate-600 hover:bg-slate-100">
            취소
          </button>
          <button type="button" onClick={() => void handleSave()} disabled={saving}
            className="inline-flex items-center gap-1 px-3 py-1.5 rounded-md text-xs font-bold text-white bg-violet-600 hover:bg-violet-700 disabled:opacity-50">
            {saving ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} aria-hidden="true" />}
            저장
          </button>
        </footer>
      </div>
    </div>
  );
}
