// bal24 v2 — STEP-STAFF-PORTAL-P5 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 본인 정보 수정 모달 (staff_pool만 허용. profile은 사이트 로그인 후 마이페이지 사용).
// WorkFlow 디자인 시스템 통일 (brand 모달 560px + rounded-[20px] + 입력 42px).

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, X, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import type { StaffPortalIdentity } from './staffPortalUtils';

interface Props {
  open: boolean;
  staff: StaffPortalIdentity;
  onClose: () => void;
  onSaved: (next: { name: string; affiliation: string | null }) => void;
}

function isPinShape(s: string): boolean {
  return /^\d{4,6}$/.test(s);
}

interface FormState {
  name: string;
  organization: string;
  phone: string;
  email: string;
  specialty: string;       // 콤마 구분 입력 → 배열 변환
  career_summary: string;
}

const EMPTY: FormState = {
  name: '', organization: '', phone: '', email: '', specialty: '', career_summary: '',
};

const INPUT_CLASS =
  'w-full h-[42px] border border-gray-200 rounded-[10px] px-3 text-sm ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 ' +
  'disabled:bg-slate-50';

const TEXTAREA_CLASS =
  'w-full border border-gray-200 rounded-[10px] px-3 py-2.5 text-sm resize-y ' +
  'focus:outline-none focus:border-violet-500 focus:ring-2 focus:ring-violet-500/10 ' +
  'disabled:bg-slate-50';

export default function StaffInfoEditModal({ open, staff, onClose, onSaved }: Props) {
  const toast = useToast();
  const [form, setForm] = useState<FormState>(EMPTY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const isStaffPool = staff.sourceType === 'staff_pool';

  const load = useCallback(async () => {
    if (!isStaffPool) { setLoading(false); return; }
    setLoading(true);
    const { data, error } = await supabase.from('staff_pool')
      .select('name, organization, phone, email, specialty, career_summary')
      .eq('id', staff.id).maybeSingle();
    setLoading(false);
    if (error || !data) {
      console.warn('[staff-info] 조회 실패:', error?.message);
      return;
    }
    setForm({
      name: (data.name as string) ?? '',
      organization: (data.organization as string) ?? '',
      phone: (data.phone as string) ?? '',
      email: (data.email as string) ?? '',
      specialty: Array.isArray(data.specialty) ? (data.specialty as string[]).join(', ') : '',
      career_summary: (data.career_summary as string) ?? '',
    });
  }, [staff.id, isStaffPool]);

  useEffect(() => { if (open) void load(); }, [open, load]);

  async function handleSave() {
    if (!isStaffPool) {
      toast.error('내부 직원 정보 수정은 로그인 후 마이페이지에서 가능해요.');
      return;
    }
    if (!form.name.trim()) { toast.error('이름을 입력해 주세요.'); return; }
    setSaving(true);
    const specialtyArr = form.specialty.split(',').map((s) => s.trim()).filter(Boolean);
    const { error } = await supabase.from('staff_pool').update({
      name: form.name.trim(),
      organization: form.organization.trim() || null,
      phone: form.phone.trim() || null,
      email: form.email.trim() || null,
      specialty: specialtyArr.length > 0 ? specialtyArr : null,
      career_summary: form.career_summary.trim() || null,
      updated_at: new Date().toISOString(),
    }).eq('id', staff.id);
    setSaving(false);
    if (error) {
      console.error('[staff-info] 저장 실패:', error.message);
      toast.error('정보 저장에 실패했어요.');
      return;
    }
    toast.success('내 정보를 저장했어요.');
    onSaved({ name: form.name.trim(), affiliation: form.organization.trim() || null });
    onClose();
  }

  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-[rgba(30,27,75,0.4)] backdrop-blur-sm flex items-center justify-center z-50 p-4"
      onClick={onClose} role="dialog" aria-label="내 정보 수정" aria-modal="true">
      <div className="bg-white w-full max-w-[560px] rounded-[20px] p-7 shadow-[0_20px_60px_rgba(30,27,75,0.15)] max-h-[90vh] overflow-y-auto"
        onClick={(e) => e.stopPropagation()}>
        <header className="flex items-center justify-between mb-5">
          <h2 className="text-lg font-bold text-[#1E1B4B]">내 정보 수정</h2>
          <button type="button" onClick={onClose} aria-label="닫기"
            className="p-1.5 rounded-lg text-slate-400 hover:bg-slate-100 transition-colors">
            <X size={18} />
          </button>
        </header>

        {!isStaffPool ? (
          <div className="py-10 text-center">
            <p className="text-sm text-slate-700 font-semibold">내부 직원 강사는 사이트 로그인 후</p>
            <p className="text-sm text-slate-500 mt-1">마이페이지에서 정보를 수정해 주세요.</p>
          </div>
        ) : loading ? (
          <div className="flex justify-center py-16">
            <Loader2 size={22} className="animate-spin text-violet-400" />
          </div>
        ) : (
          <>
            <div className="space-y-4">
              <Field label="이름" required>
                <input type="text" value={form.name} disabled={saving}
                  onChange={(e) => setForm({ ...form, name: e.target.value })}
                  className={INPUT_CLASS} />
              </Field>
              <Field label="소속">
                <input type="text" value={form.organization} disabled={saving}
                  onChange={(e) => setForm({ ...form, organization: e.target.value })}
                  className={INPUT_CLASS} />
              </Field>
              <div className="grid grid-cols-2 gap-3">
                <Field label="연락처">
                  <input type="tel" value={form.phone} disabled={saving}
                    onChange={(e) => setForm({ ...form, phone: e.target.value })}
                    className={INPUT_CLASS} />
                </Field>
                <Field label="이메일">
                  <input type="email" value={form.email} disabled={saving}
                    onChange={(e) => setForm({ ...form, email: e.target.value })}
                    className={INPUT_CLASS} />
                </Field>
              </div>
              <Field label="전문 분야 (콤마로 구분)" hint="예) 창업, 마케팅, IR">
                <input type="text" value={form.specialty} disabled={saving}
                  onChange={(e) => setForm({ ...form, specialty: e.target.value })}
                  className={INPUT_CLASS} />
              </Field>
              <Field label="소개·경력 요약">
                <textarea value={form.career_summary} disabled={saving} rows={4}
                  placeholder="간략한 자기소개·경력"
                  onChange={(e) => setForm({ ...form, career_summary: e.target.value })}
                  className={TEXTAREA_CLASS} />
              </Field>
            </div>

            <footer className="flex items-center justify-end gap-2 mt-6">
              <button type="button" onClick={onClose} disabled={saving}
                className="px-4 py-2 text-sm font-semibold text-slate-600 hover:bg-slate-100 rounded-[10px] transition-all duration-200">
                취소
              </button>
              <button type="button" onClick={() => void handleSave()} disabled={saving || loading}
                className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-white bg-violet-600 rounded-[10px] hover:bg-violet-700 hover:scale-[1.02] transition-all duration-200 disabled:opacity-50 disabled:hover:scale-100">
                {saving ? <Loader2 size={14} className="animate-spin" /> : <Save size={14} />} 저장
              </button>
            </footer>

            {/* STEP-STAFF-PORTAL-PIN — 비밀번호 변경 섹션 */}
            <PinChangeSection staffId={staff.id} currentPin={staff.portalPin} />
          </>
        )}
      </div>
    </div>
  );
}

function Field({ label, required, hint, children }: { label: string; required?: boolean; hint?: string; children: React.ReactNode }) {
  return (
    <div>
      <label className="text-sm font-semibold text-slate-700 block mb-1.5">
        {label}{required && <span className="text-rose-500 ml-0.5">*</span>}
        {hint && <span className="ml-2 text-xs text-slate-400 font-normal">{hint}</span>}
      </label>
      {children}
    </div>
  );
}

// ─── 비밀번호 변경 섹션 ──────────────────────────────────────
function PinChangeSection({ staffId, currentPin }: { staffId: string; currentPin: string | null }) {
  const toast = useToast();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleChange() {
    if (!currentPin) {
      toast.error('PIN이 설정돼 있지 않아요. 다음 접속 시 설정 화면이 표시돼요.');
      return;
    }
    if (oldPin !== currentPin) { toast.error('현재 비밀번호가 일치하지 않아요.'); return; }
    if (!isPinShape(newPin)) { toast.error('새 비밀번호는 4~6자리 숫자여야 해요.'); return; }
    if (newPin !== newPinConfirm) { toast.error('새 비밀번호 확인이 일치하지 않아요.'); return; }
    if (newPin === oldPin) { toast.error('새 비밀번호가 현재 비밀번호와 같아요.'); return; }
    setSaving(true);
    // STEP-PIN-FIX-V2 — read-back으로 RLS silent failure 감지
    const { data, error } = await supabase.from('staff_pool')
      .update({ portal_pin: newPin }).eq('id', staffId)
      .select('id, portal_pin').maybeSingle();
    setSaving(false);
    if (error) {
      console.error('[staff-pin] 비밀번호 변경 실패:', error.message);
      toast.error('비밀번호 변경에 실패했어요.');
      return;
    }
    const saved = ((data as { portal_pin?: string | null } | null)?.portal_pin ?? '').trim();
    if (!data || saved !== newPin) {
      console.error('[staff-pin] 비밀번호 변경 미반영 (RLS 차단 의심). data=', data);
      toast.error('변경 권한이 없어요. 관리자에게 RLS 정책 적용을 요청해 주세요.');
      return;
    }
    setOldPin(''); setNewPin(''); setNewPinConfirm('');
    toast.success('비밀번호가 변경됐어요.');
  }

  return (
    <section className="mt-7 pt-6 border-t border-slate-100">
      <h3 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
        <Lock size={16} className="text-violet-500" aria-hidden="true" /> 비밀번호 변경
      </h3>
      {!currentPin ? (
        <p className="text-xs text-slate-500 bg-slate-50 border border-slate-200 rounded-lg px-3 py-2">
          아직 PIN이 설정돼 있지 않아요. 로그아웃 후 다시 접속하면 PIN 설정 화면이 표시돼요.
        </p>
      ) : (
        <div className="space-y-3">
          <input type="password" inputMode="numeric" maxLength={6}
            placeholder="현재 비밀번호" value={oldPin} disabled={saving}
            onChange={(e) => setOldPin(e.target.value.replace(/\D/g, ''))}
            className={INPUT_CLASS} />
          <input type="password" inputMode="numeric" maxLength={6}
            placeholder="새 비밀번호 (4~6자리 숫자)" value={newPin} disabled={saving}
            onChange={(e) => setNewPin(e.target.value.replace(/\D/g, ''))}
            className={INPUT_CLASS} />
          <input type="password" inputMode="numeric" maxLength={6}
            placeholder="새 비밀번호 확인" value={newPinConfirm} disabled={saving}
            onChange={(e) => setNewPinConfirm(e.target.value.replace(/\D/g, ''))}
            className={INPUT_CLASS} />
          <div className="flex justify-end">
            <button type="button" onClick={() => void handleChange()} disabled={saving}
              className="inline-flex items-center gap-1.5 px-4 py-2 text-sm font-semibold text-violet-600 border border-violet-600 rounded-[10px] hover:bg-violet-50 transition-all duration-200 disabled:opacity-50">
              {saving ? <Loader2 size={14} className="animate-spin" /> : <Lock size={14} />} 비밀번호 변경
            </button>
          </div>
        </div>
      )}
    </section>
  );
}
