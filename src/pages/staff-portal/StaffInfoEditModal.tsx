// bal24 v2 — STEP-STAFF-PORTAL-P5 / STEP-STAFF-PORTAL-UI-UNIFY
// 강사 본인 정보 수정 모달 (staff_pool만 허용. profile은 사이트 로그인 후 마이페이지 사용).
// WorkFlow 디자인 시스템 통일 (brand 모달 560px + rounded-[20px] + 입력 42px).

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Save, X, Lock } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { verifyStaffPin, setStaffPin, type StaffPortalIdentity } from './staffPortalUtils';

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

            {/* STEP-MENTORING-P3-APPROVE — 도장/사인 등록 (staff_pool만) */}
            <SignatureUploadSection staffId={staff.id} />

            {/* STEP-STAFF-PORTAL-PIN / STEP-PIN-SECURITY — 비밀번호 변경 (RPC 기반) */}
            <PinChangeSection staffId={staff.id} hasPin={staff.hasPin} />
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

// ─── 비밀번호 변경 섹션 (STEP-PIN-SECURITY — RPC 기반) ─────────────────
function PinChangeSection({ staffId, hasPin }: { staffId: string; hasPin: boolean }) {
  const toast = useToast();
  const [oldPin, setOldPin] = useState('');
  const [newPin, setNewPin] = useState('');
  const [newPinConfirm, setNewPinConfirm] = useState('');
  const [saving, setSaving] = useState(false);

  async function handleChange() {
    if (!hasPin) {
      toast.error('PIN이 설정돼 있지 않아요. 다음 접속 시 설정 화면이 표시돼요.');
      return;
    }
    if (!isPinShape(newPin)) { toast.error('새 비밀번호는 4~6자리 숫자여야 해요.'); return; }
    if (newPin !== newPinConfirm) { toast.error('새 비밀번호 확인이 일치하지 않아요.'); return; }
    if (newPin === oldPin) { toast.error('새 비밀번호가 현재 비밀번호와 같아요.'); return; }
    setSaving(true);
    // 1) 현재 PIN 검증 (서버 측 — 평문 노출 없음)
    const verify = await verifyStaffPin(staffId, oldPin);
    if (!verify.ok) {
      setSaving(false);
      if (verify.reason === 'locked') {
        toast.error(`5회 실패로 잠겼어요. ${verify.secondsLeft ?? 300}초 후 다시 시도해 주세요.`);
      } else {
        toast.error('현재 비밀번호가 일치하지 않아요.');
      }
      return;
    }
    // 2) 새 PIN 설정 (해시 저장 — set_staff_pin RPC)
    const ok = await setStaffPin(staffId, newPin);
    setSaving(false);
    if (!ok) { toast.error('비밀번호 변경에 실패했어요.'); return; }
    setOldPin(''); setNewPin(''); setNewPinConfirm('');
    toast.success('비밀번호가 변경됐어요.');
  }

  return (
    <section className="mt-7 pt-6 border-t border-slate-100">
      <h3 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
        <Lock size={16} className="text-violet-500" aria-hidden="true" /> 비밀번호 변경
      </h3>
      {!hasPin ? (
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

// ─── 도장/사인 등록 섹션 (STEP-MENTORING-P3-APPROVE) ────────────
function SignatureUploadSection({ staffId }: { staffId: string }) {
  const toast = useToast();
  const [currentUrl, setCurrentUrl] = useState<string | null>(null);
  const [preview, setPreview] = useState<string | null>(null);
  const [file, setFile] = useState<File | null>(null);
  const [uploading, setUploading] = useState(false);
  const [loaded, setLoaded] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      const { data } = await supabase.from('staff_pool').select('signature_url').eq('id', staffId).maybeSingle();
      if (!cancelled) {
        setCurrentUrl((data?.signature_url as string | null) ?? null);
        setLoaded(true);
      }
    })();
    return () => { cancelled = true; };
  }, [staffId]);

  function handleFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const f = e.target.files?.[0];
    if (!f) return;
    if (f.size > 2 * 1024 * 1024) { toast.error('파일 크기는 2MB 이하여야 해요.'); return; }
    if (!['image/png', 'image/jpeg'].includes(f.type)) { toast.error('PNG 또는 JPG 파일만 업로드할 수 있어요.'); return; }
    setFile(f);
    const reader = new FileReader();
    reader.onload = (ev) => setPreview(ev.target?.result as string);
    reader.readAsDataURL(f);
  }

  async function handleUpload() {
    if (!file) return;
    setUploading(true);
    const ext = file.name.split('.').pop() ?? 'png';
    const path = `${staffId}/signature_${Date.now()}.${ext}`;
    const { error: upErr } = await supabase.storage.from('signatures')
      .upload(path, file, { upsert: true, contentType: file.type });
    if (upErr) {
      setUploading(false);
      console.error('[signature] 업로드 실패:', upErr.message);
      toast.error('서명 업로드에 실패했어요. signatures 버킷 정책을 확인해 주세요.');
      return;
    }
    const { data: pub } = supabase.storage.from('signatures').getPublicUrl(path);
    const { error: dbErr } = await supabase.from('staff_pool')
      .update({ signature_url: pub.publicUrl, updated_at: new Date().toISOString() }).eq('id', staffId);
    setUploading(false);
    if (dbErr) {
      console.error('[signature] DB 저장 실패:', dbErr.message);
      toast.error('업로드는 됐지만 기록 저장에 실패했어요.');
      return;
    }
    setCurrentUrl(pub.publicUrl);
    setFile(null); setPreview(null);
    toast.success('서명이 저장됐어요. 다음 PDF 출력부터 자동 적용돼요.');
  }

  async function handleDelete() {
    if (!currentUrl) return;
    if (!window.confirm('등록된 서명을 삭제할까요?')) return;
    const { error } = await supabase.from('staff_pool')
      .update({ signature_url: null, updated_at: new Date().toISOString() }).eq('id', staffId);
    if (error) { console.error('[signature] 삭제 실패:', error.message); toast.error('삭제에 실패했어요.'); return; }
    setCurrentUrl(null);
    toast.success('서명을 삭제했어요.');
  }

  if (!loaded) return null;

  return (
    <section className="mt-7 pt-6 border-t border-slate-100">
      <h3 className="text-base font-bold text-[#1E1B4B] mb-3 flex items-center gap-2">
        <Save size={16} className="text-violet-500" aria-hidden="true" /> 도장 / 사인 등록
      </h3>
      {currentUrl ? (
        <div className="mb-3">
          <p className="text-xs text-slate-500 mb-1.5">현재 등록된 서명</p>
          <div className="flex items-center gap-3">
            <img src={currentUrl} alt="등록된 서명" className="h-16 max-w-[200px] object-contain border border-slate-200 rounded-lg p-1 bg-white" />
            <button type="button" onClick={() => void handleDelete()}
              className="text-xs text-rose-600 hover:bg-rose-50 px-2 py-1 rounded">
              삭제
            </button>
          </div>
        </div>
      ) : (
        <p className="text-xs text-slate-400 mb-3">아직 등록된 서명이 없어요. PDF 출력 시 매번 직접 그려야 해요.</p>
      )}
      <label className="block border-2 border-dashed border-violet-300 rounded-xl p-4 text-center cursor-pointer hover:border-violet-500 transition-colors">
        <input type="file" accept="image/png,image/jpeg" className="hidden" onChange={handleFileChange} disabled={uploading} />
        <div className="text-2xl mb-1">🖊️</div>
        <p className="text-xs font-semibold text-violet-700">PNG 또는 JPG 파일 선택</p>
        <p className="text-[11px] text-slate-400 mt-1">최대 2MB · 흰 배경 권장</p>
      </label>
      {preview && (
        <div className="mt-3 flex items-center gap-3">
          <img src={preview} alt="미리보기" className="h-12 max-w-[160px] object-contain border border-slate-200 rounded p-1" />
          <button type="button" onClick={() => void handleUpload()} disabled={uploading}
            className="inline-flex items-center gap-1 px-3 py-1.5 text-xs font-bold text-white bg-violet-600 rounded-[10px] hover:bg-violet-700 disabled:opacity-50">
            {uploading ? <Loader2 size={12} className="animate-spin" /> : <Save size={12} />}
            서명 저장
          </button>
        </div>
      )}
    </section>
  );
}
