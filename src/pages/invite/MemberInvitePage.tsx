// bal24 v2 — STEP-MEMBER-INVITE 외부 수락 페이지 (/invite/member/:token)
// 비로그인 진입 → 토큰 검증 → 가입 폼 → Auth signUp + profiles UPDATE +
// member_invitations.status='accepted' → /home 리다이렉트.

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useNavigate, useParams } from 'react-router-dom';
import { Loader2, ShieldAlert, CheckCircle2, Lock, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button, Input } from '../../components/ui';
import { ROLE_LABELS, isInvitationExpired } from '../members/memberInviteUtils';
import type { MemberInvitation } from '../../types/database';

type ScreenState = 'loading' | 'invalid' | 'expired' | 'accepted' | 'ready';

export default function MemberInvitePage() {
  const { token } = useParams<{ token: string }>();
  const navigate = useNavigate();
  const toast = useToast();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [invitation, setInvitation] = useState<MemberInvitation | null>(null);
  const [name, setName] = useState('');
  const [password, setPassword] = useState('');
  const [phone, setPhone] = useState('');
  const [submitting, setSubmitting] = useState(false);

  const load = useCallback(async () => {
    if (!token) {
      setScreen('invalid');
      return;
    }
    const { data, error } = await supabase
      .from('member_invitations')
      .select('*')
      .eq('token', token)
      .is('deleted_at', null)
      .maybeSingle();
    if (error) {
      console.error('[member-invite] 토큰 조회 실패:', error.message);
      setScreen('invalid');
      return;
    }
    if (!data) {
      setScreen('invalid');
      return;
    }
    const inv = data as MemberInvitation;
    setInvitation(inv);
    if (inv.status === 'accepted') {
      setScreen('accepted');
    } else if (isInvitationExpired(inv.expires_at, inv.status)) {
      setScreen('expired');
    } else {
      setScreen('ready');
    }
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await load();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [load]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!invitation) return;
    if (!name.trim()) { toast.error('이름을 입력해 주세요.'); return; }
    if (password.length < 8) { toast.error('비밀번호는 8자 이상이어야 해요.'); return; }

    setSubmitting(true);
    try {
      // 1) Auth 가입
      const { data: signUpData, error: signUpError } = await supabase.auth.signUp({
        email: invitation.email,
        password,
      });
      if (signUpError) {
        const m = signUpError.message.toLowerCase();
        console.error('[member-invite] signUp 실패:', signUpError.message);
        if (m.includes('already registered') || m.includes('user already')) {
          toast.error('이미 가입된 이메일이에요. 로그인 페이지에서 진행해 주세요.');
        } else if (m.includes('password')) {
          toast.error('비밀번호 형식이 올바르지 않아요. 8자 이상으로 입력해 주세요.');
        } else {
          toast.error('가입에 실패했어요. 잠시 후 다시 시도해 주세요.');
        }
        return;
      }
      const userId = signUpData.user?.id;
      if (!userId) {
        toast.error('가입은 됐지만 세션을 받지 못했어요. 잠시 후 로그인해 주세요.');
        return;
      }

      // 2) profiles UPSERT (auth.users trigger 가 row 를 만들었을 가능성 → ON CONFLICT)
      const { error: profileError } = await supabase
        .from('profiles')
        .upsert({
          id: userId,
          email: invitation.email,
          name: name.trim(),
          role: invitation.role,
          department: invitation.department ?? null,
          position: invitation.position ?? null,
          phone: phone.trim() || null,
          is_active: true,
        }, { onConflict: 'id' });
      if (profileError) {
        const m = profileError.message.toLowerCase();
        console.error('[member-invite] profiles upsert 실패:', profileError.message);
        if (m.includes('check') && m.includes('role')) {
          toast.error(`역할 '${invitation.role}' 이 허용 값에 없어요. 관리자에게 문의해 주세요.`);
        } else {
          toast.error('프로필 저장에 실패했어요. 관리자에게 문의해 주세요.');
        }
        return;
      }

      // 3) 초대 상태 업데이트
      const { error: invError } = await supabase
        .from('member_invitations')
        .update({ status: 'accepted', accepted_at: new Date().toISOString() })
        .eq('id', invitation.id);
      if (invError) {
        console.error('[member-invite] 초대 상태 업데이트 실패:', invError.message);
        // 가입은 됐으니 홈으로는 진행
      }

      toast.success(`환영해요, ${name.trim()}님! 가입이 완료됐어요.`);
      navigate('/home');
    } finally {
      setSubmitting(false);
    }
  };

  // ── 화면 분기 ──────────────────────────────────────────
  if (screen === 'loading') {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (screen === 'invalid') {
    return <ErrorCard icon={<ShieldAlert size={32} className="mx-auto text-rose-400" />} title="유효하지 않은 초대 링크" message="링크를 다시 확인해 주세요. 만료되었거나 취소된 초대일 수 있어요." />;
  }

  if (screen === 'expired') {
    return <ErrorCard icon={<ShieldAlert size={32} className="mx-auto text-amber-400" />} title="초대가 만료됐어요" message="관리자에게 새 초대 링크를 요청해 주세요." />;
  }

  if (screen === 'accepted') {
    return <ErrorCard icon={<CheckCircle2 size={32} className="mx-auto text-emerald-400" />} title="이미 수락된 초대예요" message="기존 계정으로 로그인해 주세요." action={<Button variant="primary" onClick={() => navigate('/login')}>로그인 페이지로</Button>} />;
  }

  // screen === 'ready' && invitation
  if (!invitation) return null;
  const roleLabel = ROLE_LABELS[invitation.role] ?? invitation.role;

  return (
    <div className="min-h-screen bg-gradient-to-br from-violet-50/60 via-white to-orange-50/40 flex items-center justify-center px-4 py-10">
      <div className="w-full max-w-md bg-white rounded-2xl border border-violet-100 p-6 shadow-[0_8px_32px_rgba(124,58,237,0.10)] space-y-5">
        <header className="text-center space-y-2">
          <div className="inline-flex items-center justify-center w-12 h-12 rounded-full bg-violet-100 text-violet-700">
            <Sparkles size={22} aria-hidden="true" />
          </div>
          <h1 className="text-xl font-bold text-[#1E1B4B]">WorkFlow 팀에 합류해요</h1>
          <p className="text-xs text-slate-500">
            <span className="font-bold text-violet-700">{invitation.email}</span> 으로 초대됐어요
            <br />
            역할: <span className="font-bold">{roleLabel}</span>
          </p>
        </header>

        <form onSubmit={handleSubmit} className="space-y-4" noValidate>
          <Input
            label="이름"
            required
            value={name}
            onChange={(e) => setName(e.target.value)}
            disabled={submitting}
            placeholder="예) 홍길동"
            autoFocus
          />
          <Input
            type="password"
            label="비밀번호"
            required
            value={password}
            onChange={(e) => setPassword(e.target.value)}
            disabled={submitting}
            placeholder="8자 이상"
            helperText="첫 로그인 후 변경 권장"
          />
          <Input
            type="tel"
            label="연락처"
            value={phone}
            onChange={(e) => setPhone(e.target.value)}
            disabled={submitting}
            placeholder="010-0000-0000 (선택)"
          />

          <Button type="submit" variant="primary" loading={submitting} className="!w-full !py-3 text-base font-semibold">
            <Lock size={14} className="mr-1.5" aria-hidden="true" />
            가입 완료하고 시작
          </Button>
        </form>

        <p className="text-center text-[10px] text-slate-400">© 2026 (주)밸런스닷 · WorkFlow</p>
      </div>
    </div>
  );
}

interface ErrorCardProps {
  icon: React.ReactNode;
  title: string;
  message: string;
  action?: React.ReactNode;
}

function ErrorCard({ icon, title, message, action }: ErrorCardProps) {
  return (
    <div className="min-h-screen bg-bg flex items-center justify-center px-4">
      <div className="bg-white rounded-2xl border border-slate-200 p-8 max-w-md w-full text-center space-y-3">
        {icon}
        <p className="text-base font-bold text-[#1E1B4B]">{title}</p>
        <p className="text-sm text-slate-500">{message}</p>
        {action}
      </div>
    </div>
  );
}
