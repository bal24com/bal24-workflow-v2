// bal24 v2 — 팀원 등록·수정 모달 (STEP-MEMBER-DIRECT-REGISTER)
// 신규: create-member Edge Function 호출 (Auth + profiles 동시 생성)
//       초기 비밀번호 = 연락처 끝 4자리 (4자리 미만이면 차단)
// 수정: profiles UPDATE + 퇴직 처리(is_active=false) + 아바타 업로드

import { useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { Trash2 } from 'lucide-react';
import { Modal, Button } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import type { Profile } from '../../types/database';
import MemberFormFields, { EMPTY_MEMBER_FORM, type MemberFormState } from './MemberFormFields';

/** 연락처에서 숫자만 추출해 끝 4자리 반환 (초기 비밀번호용) */
function getInitialPassword(phone: string): string {
  const digits = (phone ?? '').replace(/\D/g, '');
  return digits.slice(-4);
}

interface Props {
  open: boolean;
  editTarget?: Profile | null;
  onClose: () => void;
  onSaved: () => void;
}

function translateError(raw: string): string {
  const m = raw.toLowerCase();
  if (m.includes('row-level security')) return '권한이 없어요. 관리자에게 문의해 주세요.';
  if (m.includes('duplicate') || m.includes('unique') || m.includes('already')) return '이미 등록된 이메일이에요.';
  if (m.includes('check constraint')) return '역할 값이 허용 범위가 아니에요.';
  // STEP-INSTRUCTOR-MATCH-FIX — Edge Function 미배포 시 명확한 안내
  if (m.includes('failed to send') || m.includes('failed to fetch') || m.includes('functionsfetcherror')) {
    return 'create-member Edge Function이 배포되지 않은 것 같아요. 관리자에게 배포를 요청해 주세요. (supabase functions deploy create-member)';
  }
  if (m.includes('not found') || m.includes('404')) {
    return 'create-member 함수를 찾을 수 없어요. 관리자에게 Edge Function 배포를 요청해 주세요.';
  }
  if (m.includes('unauthorized') || m.includes('401') || m.includes('403')) {
    return '권한이 없어요. ADMIN 계정으로 다시 로그인해 주세요.';
  }
  if (m.includes('column') && m.includes('does not exist')) {
    return 'profiles 테이블 컬럼이 누락됐어요. 관리자에게 마이그레이션 확인을 요청해 주세요.';
  }
  return '저장 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.';
}

interface CreateMemberResponse {
  success?: boolean;
  userId?: string;
  email?: string;
  error?: string;
}

export default function MemberFormModal({ open, editTarget, onClose, onSaved }: Props) {
  const [form, setForm] = useState<MemberFormState>(EMPTY_MEMBER_FORM);
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
      setForm(EMPTY_MEMBER_FORM);
    }
    setErrorMsg(null);
  }, [open, editTarget]);

  const update = <K extends keyof MemberFormState>(k: K, v: MemberFormState[K]) => {
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
        // 수정: profiles UPDATE (Auth 정보는 그대로)
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
        const { data, error } = await supabase
          .from('profiles')
          .update(payload)
          .eq('id', editTarget.id)
          .select('id');
        if (error) throw error;
        if (!data || data.length === 0) {
          console.error('[members] update 0 row affected — RLS 정책 누락 추정. id=', editTarget.id);
          setErrorMsg('수정 권한이 없거나 RLS 정책이 누락되어 저장되지 않았어요. 관리자에게 문의해 주세요.');
          return;
        }
      } else {
        // STEP-MEMBER-DIRECT-REGISTER — Edge Function으로 Auth + profiles 동시 생성
        const initialPassword = getInitialPassword(form.phone);
        if (initialPassword.length < 4) {
          setErrorMsg('초기 비밀번호 생성을 위해 연락처를 4자리 이상 입력해 주세요.');
          return;
        }
        const { data, error } = await supabase.functions.invoke<CreateMemberResponse>('create-member', {
          body: {
            email: form.email.trim(),
            password: initialPassword,
            name: form.name.trim(),
            role: form.role,
            department: form.department.trim() || null,
            position: form.position.trim() || null,
            phone: form.phone.trim() || null,
            joined_at: form.joinedAt || null,
            slogan: form.slogan.trim() || null,
            avatar_url: form.avatarUrl || null,
          },
        });
        if (error) {
          // FunctionsHttpError — Edge Function이 4xx/5xx 반환
          const ctx = (error as { context?: { json?: () => Promise<CreateMemberResponse> } }).context;
          let serverMsg = '';
          try {
            const j = await ctx?.json?.();
            serverMsg = j?.error ?? '';
          } catch { /* noop */ }
          console.error('[members] create-member 실패:', serverMsg || error.message);
          setErrorMsg(translateError(serverMsg || error.message));
          return;
        }
        if (data?.error) {
          console.error('[members] create-member 응답 오류:', data.error);
          setErrorMsg(translateError(data.error));
          return;
        }
        // 등록 성공 → 초기 비밀번호 안내 (이름 + 끝 4자리)
        window.alert(`${form.name.trim()}님이 등록됐어요.\n초기 비밀번호: ${initialPassword}\n(연락처 끝 4자리, 첫 로그인 후 변경을 권장해요.)`);
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
      title={editTarget ? '팀원 정보 수정' : '팀원 등록'}
      description={editTarget
        ? '팀원 정보를 수정하거나 퇴직 처리할 수 있어요.'
        : '이메일 초대 없이 즉시 계정이 생성돼요. 초기 비밀번호는 연락처 끝 4자리예요.'}
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
        <MemberFormFields
          form={form}
          onUpdate={update}
          onAvatarUpload={handleAvatarUpload}
          isEditMode={Boolean(editTarget)}
          busy={busy}
          uploading={uploading}
          errorMsg={errorMsg}
        />
      </form>
    </Modal>
  );
}
