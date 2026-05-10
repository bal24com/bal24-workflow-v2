// bal24 v2 — 로그인 화면 (v1 디자인)
// 좌측: 바이올렛 그라데이션 / 우측: 크림 배경(#FEFCE8) 2분할 레이아웃

import { useId, useState } from 'react';
import type { FormEvent } from 'react';
import { Link } from 'react-router-dom';
import {
  Briefcase,
  ClipboardList,
  Eye,
  EyeOff,
  Sparkles,
  Wallet,
} from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';

// Supabase 영문 에러 메시지 → 한글 변환
function translateSignInError(rawMessage: string): string {
  const m = rawMessage.toLowerCase();
  if (m.includes('invalid login credentials')) {
    return '이메일 또는 비밀번호가 올바르지 않습니다.';
  }
  if (m.includes('email not confirmed')) {
    return '이메일 인증이 필요합니다. 받은편지함을 확인해 주세요.';
  }
  return '로그인 중 오류가 발생했습니다. 다시 시도해 주세요.';
}

const FEATURES = [
  { Icon: ClipboardList, label: '프로젝트 & 태스크 관리' },
  { Icon: Sparkles,      label: '미팅일지 & AI 자동 요약' },
  { Icon: Wallet,        label: '정산 & 사업보고' },
] as const;

function BrandSide() {
  return (
    <div className="relative hidden lg:flex flex-col justify-between p-12 text-white overflow-hidden bg-gradient-to-br from-[#7C3AED] via-[#6D28D9] to-[#4C1D95]">
      <div className="absolute -top-24 -right-24 w-96 h-96 rounded-full bg-white/10 blur-3xl" aria-hidden="true" />
      <div className="absolute -bottom-32 -left-16 w-96 h-96 rounded-full bg-pink-300/20 blur-3xl" aria-hidden="true" />

      <header className="relative flex items-center gap-3">
        <span className="inline-flex items-center justify-center w-12 h-12 rounded-2xl bg-white/15 backdrop-blur text-2xl">
          🚀
        </span>
        <div className="leading-tight">
          <div className="text-2xl font-bold tracking-tight">WorkFlow</div>
          <div className="text-xs text-white/70">by 밸런스닷</div>
        </div>
      </header>

      <div className="relative space-y-8">
        <div className="space-y-3">
          <h2 className="text-3xl xl:text-4xl font-bold leading-snug">
            당신의 성장을
            <br />
            돕습니다.
          </h2>
          <p className="text-sm text-white/80 max-w-sm">
            프로젝트부터 정산까지, 흩어져 있던 일을 하나로 모아요.
          </p>
        </div>

        <ul className="space-y-3">
          {FEATURES.map(({ Icon, label }) => (
            <li key={label} className="flex items-center gap-3 text-sm text-white/90">
              <span className="inline-flex items-center justify-center w-9 h-9 rounded-xl bg-white/15 backdrop-blur">
                <Icon size={18} />
              </span>
              {label}
            </li>
          ))}
        </ul>
      </div>

      <footer className="relative text-xs text-white/60">
        팀의 흐름을 살리는 업무 OS
        <Briefcase size={14} className="inline-block ml-1 -mt-0.5" />
      </footer>
    </div>
  );
}

type FormFieldsProps = {
  email: string;
  password: string;
  remember: boolean;
  showPassword: boolean;
  submitting: boolean;
  errorMsg: string | null;
  infoMsg: string | null;
  onEmailChange: (v: string) => void;
  onPasswordChange: (v: string) => void;
  onRememberChange: (v: boolean) => void;
  onTogglePassword: () => void;
  onSubmit: (e: FormEvent<HTMLFormElement>) => void;
};

function FormFields(props: FormFieldsProps) {
  const emailId = useId();
  const passwordId = useId();
  const rememberId = useId();

  return (
    <form onSubmit={props.onSubmit} className="space-y-5" noValidate>
      <div className="space-y-1.5">
        <label htmlFor={emailId} className="text-sm font-semibold text-slate-700">
          이름 또는 이메일
        </label>
        <input
          id={emailId}
          type="text"
          autoComplete="username"
          value={props.email}
          onChange={(e) => props.onEmailChange(e.target.value)}
          disabled={props.submitting}
          className="w-full rounded-xl border border-amber-200/80 bg-white px-4 py-3 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition"
          placeholder="you@example.com"
        />
      </div>

      <div className="space-y-1.5">
        <label htmlFor={passwordId} className="text-sm font-semibold text-slate-700">
          비밀번호
        </label>
        <div className="relative">
          <input
            id={passwordId}
            type={props.showPassword ? 'text' : 'password'}
            autoComplete="current-password"
            value={props.password}
            onChange={(e) => props.onPasswordChange(e.target.value)}
            disabled={props.submitting}
            className="w-full rounded-xl border border-amber-200/80 bg-white px-4 py-3 pr-11 text-sm text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 transition"
            placeholder="비밀번호 입력"
          />
          <button
            type="button"
            onClick={props.onTogglePassword}
            disabled={props.submitting}
            aria-label={props.showPassword ? '비밀번호 숨기기' : '비밀번호 보기'}
            className="absolute inset-y-0 right-0 flex items-center px-3 text-slate-400 hover:text-slate-700 disabled:opacity-60"
          >
            {props.showPassword ? <EyeOff size={18} /> : <Eye size={18} />}
          </button>
        </div>
      </div>

      <label htmlFor={rememberId} className="flex items-center gap-2 text-sm text-slate-600 select-none cursor-pointer">
        <input
          id={rememberId}
          type="checkbox"
          checked={props.remember}
          onChange={(e) => props.onRememberChange(e.target.checked)}
          disabled={props.submitting}
          className="w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
        />
        이름 기억하기
      </label>

      {props.errorMsg && (
        <div role="alert" className="rounded-xl bg-red-50 border border-red-100 px-4 py-2.5 text-sm text-red-700">
          {props.errorMsg}
        </div>
      )}
      {props.infoMsg && (
        <div role="status" className="rounded-xl bg-emerald-50 border border-emerald-100 px-4 py-2.5 text-sm text-emerald-700">
          {props.infoMsg}
        </div>
      )}

      <button
        type="submit"
        disabled={props.submitting}
        className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:opacity-95 active:scale-[0.99] disabled:opacity-60 disabled:cursor-not-allowed transition"
      >
        {props.submitting ? '확인 중…' : '시작하기'}
      </button>
    </form>
  );
}

export default function LoginPage() {
  const { signIn } = useAuth();
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [remember, setRemember] = useState(true);
  const [showPassword, setShowPassword] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);
  const [infoMsg, setInfoMsg] = useState<string | null>(null);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    setInfoMsg(null);

    if (!email.trim() || !password) {
      setErrorMsg('이메일과 비밀번호를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      await signIn(email.trim(), password);
      setInfoMsg('로그인에 성공했어요. 잠시만 기다려 주세요.');
      // 세션 변경 → AuthContext가 감지 → /dashboard로 라우팅
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      setErrorMsg(translateSignInError(raw));
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen grid grid-cols-1 lg:grid-cols-2 bg-[#FEFCE8]">
      <BrandSide />

      <div className="relative flex flex-col bg-[#FEFCE8]">
        <main className="flex-1 flex items-center justify-center p-6 sm:p-10">
          <div className="w-full max-w-sm space-y-7">
            <header className="space-y-2">
              <h1 className="text-2xl sm:text-3xl font-bold text-slate-900">
                안녕하세요 <span aria-hidden="true">👋</span>
              </h1>
              <p className="text-sm text-slate-600">
                WorkFlow로 오늘도 스마트하게 시작하세요.
              </p>
            </header>

            <FormFields
              email={email}
              password={password}
              remember={remember}
              showPassword={showPassword}
              submitting={submitting}
              errorMsg={errorMsg}
              infoMsg={infoMsg}
              onEmailChange={setEmail}
              onPasswordChange={setPassword}
              onRememberChange={setRemember}
              onTogglePassword={() => setShowPassword((v) => !v)}
              onSubmit={handleSubmit}
            />

            <p className="text-center text-sm text-slate-500">
              아직 계정이 없으신가요?{' '}
              <Link to="/join" className="font-medium text-violet-600 hover:underline">
                가입 신청하기
              </Link>
            </p>

            <div className="rounded-xl bg-amber-100/60 border border-amber-200/60 px-4 py-3 text-xs text-amber-900">
              계정 관련 문의는 관리자에게 연락해 주세요.
            </div>
          </div>
        </main>

        <footer className="text-center text-xs text-slate-500 py-5 px-6 border-t border-amber-200/40">
          © 2026 (주)밸런스닷 · WorkFlow v2
        </footer>
      </div>
    </div>
  );
}
