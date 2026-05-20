// bal24 v2 — STEP-MEMBER-DIRECT-REGISTER
// MemberFormModal에서 분리된 폼 필드 (이름/이메일/역할/부서/직책/연락처/입사일/슬로건).
// 신규 등록 vs 수정 모드 분기 포함.

import type { ChangeEvent } from 'react';
import { Info, Upload, X } from 'lucide-react';
import { Input } from '../../components/ui';
import { ROLE_LABELS } from '../../constants/roles';
import type { Role } from '../../types/database';

const ROLE_VALUES: Role[] = ['admin', 'pm', 'staff', 'finance', 'partner'];

export interface MemberFormState {
  name: string;
  email: string;
  role: Role;
  department: string;
  position: string;
  phone: string;
  joinedAt: string;
  slogan: string;
  isActive: boolean;
  avatarUrl: string;
}

interface Props {
  form: MemberFormState;
  onUpdate: <K extends keyof MemberFormState>(k: K, v: MemberFormState[K]) => void;
  onAvatarUpload: (e: ChangeEvent<HTMLInputElement>) => void;
  isEditMode: boolean;
  busy: boolean;
  uploading: boolean;
  errorMsg: string | null;
}

export default function MemberFormFields({
  form, onUpdate, onAvatarUpload, isEditMode, busy, uploading, errorMsg,
}: Props) {
  return (
    <>
      {/* 신규 등록 안내 (수정 모드에서는 숨김) */}
      {!isEditMode && (
        <div className="flex items-start gap-2 rounded-xl border border-amber-200 bg-amber-50 px-3 py-2.5 text-sm text-amber-800">
          <Info size={14} className="shrink-0 mt-0.5" aria-hidden="true" />
          <div>
            <p className="font-semibold">초기 비밀번호는 연락처 끝 4자리예요.</p>
            <p className="mt-0.5 text-xs text-amber-700">첫 로그인 후 비밀번호 변경을 권장해요. 연락처는 필수예요.</p>
          </div>
        </div>
      )}

      {/* 아바타 */}
      <div className="flex items-center gap-3">
        {form.avatarUrl ? (
          <div className="relative">
            <img src={form.avatarUrl} alt="프로필 미리보기"
              className="w-20 h-20 rounded-full object-cover border border-violet-100" />
            <button type="button" onClick={() => onUpdate('avatarUrl', '')}
              aria-label="아바타 제거"
              className="absolute -top-1 -right-1 rounded-full bg-white border border-slate-200 p-0.5 hover:bg-rose-50 hover:border-rose-200">
              <X size={14} className="text-slate-500" aria-hidden="true" />
            </button>
          </div>
        ) : (
          <div className="w-20 h-20 rounded-full bg-violet-100 text-violet-700 flex items-center justify-center text-2xl font-bold">
            {form.name.trim().charAt(0).toUpperCase() || '?'}
          </div>
        )}
        <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100">
          <Upload size={16} aria-hidden="true" />
          {uploading ? '업로드 중…' : '프로필 사진 업로드'}
          <input type="file" accept="image/*" onChange={onAvatarUpload} disabled={busy} className="hidden" />
        </label>
      </div>

      {/* 이름·이메일 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input label="이름" required value={form.name}
          onChange={(e) => onUpdate('name', e.target.value)} disabled={busy} placeholder="예) 박경수" />
        <Input type="email" label="이메일" required={!isEditMode} value={form.email}
          onChange={(e) => onUpdate('email', e.target.value)}
          disabled={busy || isEditMode} placeholder="example@bal24.kr"
          helperText={isEditMode ? '이메일은 수정할 수 없어요.' : undefined} />
      </div>

      {/* 역할·부서·직책 */}
      <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">역할 <span className="text-rose-500">*</span></label>
          <select value={form.role}
            onChange={(e) => onUpdate('role', e.target.value as Role)} disabled={busy}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20">
            {ROLE_VALUES.map((r) => (
              <option key={r} value={r}>{ROLE_LABELS[r] ?? r}</option>
            ))}
          </select>
        </div>
        <Input label="부서" value={form.department}
          onChange={(e) => onUpdate('department', e.target.value)} disabled={busy} placeholder="예) 운영팀" />
        <Input label="직책" value={form.position}
          onChange={(e) => onUpdate('position', e.target.value)} disabled={busy} placeholder="예) 매니저" />
      </div>

      {/* 연락처·입사일 */}
      <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
        <Input type="tel" label="연락처" required={!isEditMode} value={form.phone}
          onChange={(e) => onUpdate('phone', e.target.value)} disabled={busy}
          placeholder="010-0000-0000"
          helperText={isEditMode ? undefined : '끝 4자리가 초기 비밀번호가 돼요.'} />
        <Input type="date" label="입사일" value={form.joinedAt}
          onChange={(e) => onUpdate('joinedAt', e.target.value)} disabled={busy} />
      </div>

      {/* 한 줄 소개 */}
      <div className="space-y-1.5">
        <label className="text-sm font-semibold text-slate-700">한 줄 소개</label>
        <textarea value={form.slogan} onChange={(e) => onUpdate('slogan', e.target.value)}
          disabled={busy} rows={2} placeholder="팀에 자신을 한 줄로 소개해 주세요."
          className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60" />
      </div>

      {/* 재직 상태 (수정 모드 전용) */}
      {isEditMode && (
        <label className="flex items-center gap-2 text-sm">
          <input type="checkbox" checked={form.isActive}
            onChange={(e) => onUpdate('isActive', e.target.checked)}
            disabled={busy}
            className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30" />
          <span className="font-semibold text-slate-700">재직 중</span>
          <span className="text-xs text-slate-500">(체크 해제 시 퇴직 상태)</span>
        </label>
      )}

      {errorMsg && (
        <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
          {errorMsg}
        </div>
      )}
    </>
  );
}

export const EMPTY_MEMBER_FORM: MemberFormState = {
  name: '', email: '', role: 'staff',
  department: '', position: '', phone: '',
  joinedAt: '', slogan: '', isActive: true, avatarUrl: '',
};
