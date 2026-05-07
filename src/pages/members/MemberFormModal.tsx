// bal24 v2 — 팀원 등록·수정 모달 (STEP 18)
// 신규: profiles INSERT만 (Auth 연동은 추후 별도 처리)
// 수정: profiles UPDATE + 퇴직 처리(is_active=false) + 아바타 업로드

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Trash2, Upload, X } from 'lucide-react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Profile, Role } from '../../types/database';

const ROLE_VALUES: Role[] = ['ADMIN', 'PM', 'STAFF', 'FINANCE', 'PARTNER'];

interface Props {
  open: boolean;
  editTarget?: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}

interface FormState {
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

const EMPTY: FormState = {
  name: '',
  email: '',
  role: 'STAFF',
  department: '',
  position: '',
  phone: '',
  joinedAt: '',
  slogan: '',
  isActive: true,
  avatarUrl: '',
};

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('duplicate') || m.includes('unique')) return '이미 등록된 이메일이에요.';
  if (m.includes('check constraint')) return '역할 값이 허용 범위가 아니에요.';
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

export default function MemberFormModal({ open, editTarget, onClose, onSaved }: Props) {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [retiring, setRetiring] = useState(false);
  const [uploading, setUploading] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!open) return;
    if (editTarget) {
      setForm({
        name: editTarget.name,
        email: editTarget.email,
        role: editTarget.role,
        department: editTarget.department ?? '',
        position: editTarget.position ?? '',
        phone: editTarget.phone ?? '',
        joinedAt: editTarget.joined_at ?? '',
        slogan: editTarget.slogan ?? '',
        isActive: editTarget.is_active,
        avatarUrl: editTarget.avatar_url ?? '',
      });
    } else {
      setForm(EMPTY);
    }
    setErrorMsg(null);
  }, [open, editTarget]);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  const handleAvatarUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    if (!/^image\//.test(file.type)) {
      setErrorMsg('이미지 파일만 업로드 가능해요.');
      return;
    }
    if (file.size > 5 * 1024 * 1024) {
      setErrorMsg('5MB 이하 파일만 업로드 가능해요.');
      return;
    }

    setErrorMsg(null);
    setUploading(true);
    try {
      const folderId = editTarget?.id ?? 'pending';
      const ts = Date.now();
      const safeName = file.name.replace(/[^a-zA-Z0-9._-]/g, '_');
      const path = `${folderId}/${ts}_${safeName}`;
      const { error: upErr } = await supabase.storage.from('avatars').upload(path, file, {
        cacheControl: '3600',
        upsert: false,
      });
      if (upErr) throw upErr;
      const { data: pub } = supabase.storage.from('avatars').getPublicUrl(path);
      update('avatarUrl', pub.publicUrl);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[members] 아바타 업로드 실패:', raw);
      setErrorMsg('아바타 업로드에 실패했어요. avatars 버킷이 Public 으로 생성되어 있는지 확인해 주세요.');
    } finally {
      setUploading(false);
      e.target.value = '';
    }
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);

    if (!form.name.trim()) {
      setErrorMsg('이름을 입력해 주세요.');
      return;
    }
    if (!editTarget && !form.email.trim()) {
      setErrorMsg('이메일을 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      if (editTarget) {
        const payload = {
          name: form.name.trim(),
          role: form.role,
          department: form.department.trim() || null,
          position: form.position.trim() || null,
          phone: form.phone.trim() || null,
          joined_at: form.joinedAt || null,
          slogan: form.slogan.trim() || null,
          is_active: form.isActive,
          avatar_url: form.avatarUrl || null,
          updated_at: new Date().toISOString(),
        };
        const { error } = await supabase.from('profiles').update(payload).eq('id', editTarget.id);
        if (error) throw error;
      } else {
        const payload = {
          email: form.email.trim(),
          name: form.name.trim(),
          role: form.role,
          department: form.department.trim() || null,
          position: form.position.trim() || null,
          phone: form.phone.trim() || null,
          joined_at: form.joinedAt || null,
          slogan: form.slogan.trim() || null,
          is_active: true,
          avatar_url: form.avatarUrl || null,
        };
        const { error } = await supabase.from('profiles').insert(payload);
        if (error) throw error;
      }

      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[members] 팀원 저장 실패:', raw);
      setErrorMsg(translateError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  const handleRetire = async () => {
    if (!editTarget) return;
    if (!window.confirm(`"${editTarget.name}" 팀원을 퇴직 처리할까요? 목록에서 숨겨져요.`)) return;

    setRetiring(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('profiles')
        .update({ is_active: false, updated_at: new Date().toISOString() })
        .eq('id', editTarget.id);
      if (error) throw error;
      onSaved();
      onClose();
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[members] 퇴직 처리 실패:', raw);
      setErrorMsg('퇴직 처리 중 오류가 발생했어요.');
    } finally {
      setRetiring(false);
    }
  };

  const busy = submitting || retiring || uploading;

  return (
    <Modal
      open={open}
      onClose={onClose}
      title={editTarget ? '팀원 정보 수정' : '팀원 초대'}
      description={editTarget ? '팀원 정보를 수정하거나 퇴직 처리할 수 있어요.' : '신규 팀원을 등록해요. 로그인 계정은 별도 이메일 초대로 처리해요.'}
      size="md"
      closeOnBackdrop={!busy}
      footer={
        <div className="flex w-full items-center justify-between gap-2">
          {editTarget && editTarget.is_active ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleRetire}
              loading={retiring}
              className="!border-rose-200 !text-rose-600 hover:!bg-rose-50"
            >
              <Trash2 size={16} className="mr-1.5" aria-hidden="true" />
              퇴직 처리
            </Button>
          ) : (
            <span />
          )}
          <div className="flex items-center gap-2">
            <Button variant="outline" onClick={onClose} disabled={busy}>
              취소
            </Button>
            <Button type="submit" form="member-form" variant="primary" loading={submitting}>
              {editTarget ? '수정 완료' : '저장하기'}
            </Button>
          </div>
        </div>
      }
    >
      <form id="member-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <div className="flex items-center gap-3">
          {form.avatarUrl ? (
            <div className="relative">
              <img
                src={form.avatarUrl}
                alt="프로필 미리보기"
                className="w-20 h-20 rounded-full object-cover border border-violet-100"
              />
              <button
                type="button"
                onClick={() => update('avatarUrl', '')}
                aria-label="아바타 제거"
                className="absolute -top-1 -right-1 rounded-full bg-white border border-slate-200 p-0.5 hover:bg-rose-50 hover:border-rose-200"
              >
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
            <input
              type="file"
              accept="image/*"
              onChange={handleAvatarUpload}
              disabled={busy}
              className="hidden"
            />
          </label>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            label="이름"
            required
            value={form.name}
            onChange={(e) => update('name', e.target.value)}
            disabled={busy}
            placeholder="예) 박경수"
          />
          <Input
            type="email"
            label="이메일"
            required={!editTarget}
            value={form.email}
            onChange={(e) => update('email', e.target.value)}
            disabled={busy || Boolean(editTarget)}
            placeholder="example@bal24.kr"
            helperText={editTarget ? '이메일은 수정할 수 없어요.' : undefined}
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-3 gap-4">
          <div className="space-y-1.5">
            <label className="text-sm font-semibold text-slate-700">역할 <span className="text-rose-500">*</span></label>
            <select
              value={form.role}
              onChange={(e) => update('role', e.target.value as Role)}
              disabled={busy}
              className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
            >
              {ROLE_VALUES.map((r) => (
                <option key={r} value={r}>
                  {r}
                </option>
              ))}
            </select>
          </div>
          <Input
            label="부서"
            value={form.department}
            onChange={(e) => update('department', e.target.value)}
            disabled={busy}
            placeholder="예) 운영팀"
          />
          <Input
            label="직책"
            value={form.position}
            onChange={(e) => update('position', e.target.value)}
            disabled={busy}
            placeholder="예) 매니저"
          />
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <Input
            type="tel"
            label="연락처"
            value={form.phone}
            onChange={(e) => update('phone', e.target.value)}
            disabled={busy}
            placeholder="010-0000-0000"
          />
          <Input
            type="date"
            label="입사일"
            value={form.joinedAt}
            onChange={(e) => update('joinedAt', e.target.value)}
            disabled={busy}
          />
        </div>

        <div className="space-y-1.5">
          <label className="text-sm font-semibold text-slate-700">한 줄 소개</label>
          <textarea
            value={form.slogan}
            onChange={(e) => update('slogan', e.target.value)}
            disabled={busy}
            rows={2}
            placeholder="팀에 자신을 한 줄로 소개해 주세요."
            className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          />
        </div>

        {editTarget && (
          <label className="flex items-center gap-2 text-sm">
            <input
              type="checkbox"
              checked={form.isActive}
              onChange={(e) => update('isActive', e.target.checked)}
              disabled={busy}
              className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
            />
            <span className="font-semibold text-slate-700">재직 중</span>
            <span className="text-xs text-slate-500">(체크 해제 시 퇴직 상태)</span>
          </label>
        )}

        {errorMsg && (
          <div role="alert" className="rounded-xl bg-rose-50 border border-rose-200 px-4 py-2.5 text-sm text-rose-700">
            {errorMsg}
          </div>
        )}
      </form>
    </Modal>
  );
}
