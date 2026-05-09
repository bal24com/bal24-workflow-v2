// bal24 v2 — STEP-MEMBER-INVITE 초대 모달
// 이메일·역할·부서·직책 입력 → INSERT → Edge Function 호출 → 메일 발송.

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { Modal, Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { useAuth } from '../../contexts/AuthContext';
import { useToast } from '../../contexts/ToastContext';
import { ROLE_OPTIONS_FOR_INVITE, buildInviteUrl } from './memberInviteUtils';

interface Props {
  open: boolean;
  onClose: () => void;
  onSent: () => void;
}

interface InsertedRow { id: string; token: string }

export default function MemberInviteModal({ open, onClose, onSent }: Props) {
  const { user } = useAuth();
  const toast = useToast();
  const [email, setEmail] = useState('');
  const [role, setRole] = useState<string>('staff');
  const [department, setDepartment] = useState('');
  const [position, setPosition] = useState('');
  const [submitting, setSubmitting] = useState(false);

  useEffect(() => {
    if (open) return;
    setEmail('');
    setRole('staff');
    setDepartment('');
    setPosition('');
  }, [open]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    const trimmedEmail = email.trim().toLowerCase();
    if (!trimmedEmail) {
      toast.error('이메일을 입력해 주세요.');
      return;
    }
    if (!/^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(trimmedEmail)) {
      toast.error('올바른 이메일 형식이 아니에요.');
      return;
    }

    setSubmitting(true);
    try {
      // 1) member_invitations INSERT
      const { data: inserted, error } = await supabase
        .from('member_invitations')
        .insert({
          email: trimmedEmail,
          role,
          department: department.trim() || null,
          position: position.trim() || null,
          invited_by: user?.id ?? null,
        })
        .select('id, token')
        .single();

      if (error) {
        const m = error.message.toLowerCase();
        console.error('[member-invite] INSERT 실패:', error.message);
        if (m.includes('duplicate')) {
          toast.error('이미 초대된 이메일이에요.');
        } else if (m.includes('row-level security') || m.includes('permission')) {
          toast.error('초대 권한이 없어요. 관리자만 초대할 수 있어요.');
        } else {
          toast.error('초대 등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
        return;
      }

      const row = inserted as InsertedRow;

      // 2) Edge Function 호출 (이메일 발송)
      const { error: fnError } = await supabase.functions.invoke('send-invite', {
        body: { invitation_id: row.id },
      });

      if (fnError) {
        console.error('[member-invite] Edge Function 호출 실패:', fnError.message);
        // 메일 발송 실패해도 초대는 등록됨 — 링크 복사로 전달 가능 안내
        toast.warning(`이메일 발송은 실패했지만 초대는 등록됐어요. 직접 링크를 복사해 전달하세요: ${buildInviteUrl(row.token)}`);
      } else {
        toast.success(`${trimmedEmail} 으로 초대 메일을 보냈어요.`);
      }

      onSent();
      onClose();
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <Modal
      open={open}
      onClose={onClose}
      title="팀원 초대"
      description="이메일로 초대 링크를 보내요. 7일 후 자동 만료됩니다."
      size="md"
      closeOnBackdrop={!submitting}
      footer={
        <>
          <Button variant="outline" onClick={onClose} disabled={submitting}>취소</Button>
          <Button type="submit" form="member-invite-form" variant="primary" loading={submitting}>
            초대 보내기
          </Button>
        </>
      }
    >
      <form id="member-invite-form" onSubmit={handleSubmit} className="space-y-4" noValidate>
        <Input
          type="email"
          label="이메일"
          required
          value={email}
          onChange={(e) => setEmail(e.target.value)}
          disabled={submitting}
          placeholder="예) name@bal24.com"
          autoFocus
        />

        <div className="space-y-1.5">
          <label htmlFor="invite-role" className="text-sm font-semibold text-slate-700">
            역할 <span className="text-rose-500">*</span>
          </label>
          <select
            id="invite-role"
            value={role}
            onChange={(e) => setRole(e.target.value)}
            disabled={submitting}
            className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
          >
            {ROLE_OPTIONS_FOR_INVITE.map((opt) => (
              <option key={opt.value} value={opt.value}>{opt.label}</option>
            ))}
          </select>
          <p className="text-[11px] text-slate-400">
            ※ profiles.role 의 CHECK 제약과 일치해야 가입 후 자동 배정돼요.
          </p>
        </div>

        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <Input
            label="부서"
            value={department}
            onChange={(e) => setDepartment(e.target.value)}
            disabled={submitting}
            placeholder="예) 경영팀"
          />
          <Input
            label="직책"
            value={position}
            onChange={(e) => setPosition(e.target.value)}
            disabled={submitting}
            placeholder="예) 매니저"
          />
        </div>
      </form>
    </Modal>
  );
}
