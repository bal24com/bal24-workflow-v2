// 외부 사용자 팀 합류 신청 공개 페이지

import { useState } from 'react';
import type { FormEvent } from 'react';
import { CheckCircle2, Send, UserPlus } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';

interface FormState {
  name: string;
  email: string;
  phone: string;
  department: string;
  position: string;
  message: string;
}

const EMPTY: FormState = {
  name: '',
  email: '',
  phone: '',
  department: '',
  position: '',
  message: '',
};

export default function JoinRequestPage() {
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  const update = <K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  };

  async function handleSubmit(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    setErrorMsg(null);
    if (!form.name.trim()) { setErrorMsg('이름을 입력해 주세요.'); return; }
    if (!form.email.trim()) { setErrorMsg('이메일을 입력해 주세요.'); return; }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('member_requests').insert({
        name: form.name.trim(),
        email: form.email.trim().toLowerCase(),
        phone: form.phone.trim() || null,
        department: form.department.trim() || null,
        position: form.position.trim() || null,
        message: form.message.trim() || null,
      });
      if (error) {
        const msg = error.message?.toLowerCase() ?? '';
        console.error('[join] 신청 INSERT 실패:', error.message);
        if (msg.includes('does not exist') || (error as { code?: string }).code === 'PGRST205') {
          setErrorMsg('신청 시스템이 아직 준비되지 않았어요. 관리자에게 문의해 주세요.');
        } else if (msg.includes('row-level security')) {
          setErrorMsg('신청 권한이 없어요. 관리자에게 문의해 주세요.');
        } else {
          setErrorMsg('신청 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
        }
        return;
      }
      setSubmitted(true);
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 px-4 py-6 sm:py-10">
      <div className="max-w-md mx-auto space-y-4">
        <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider inline-flex items-center gap-1">
            <UserPlus size={11} aria-hidden="true" />
            팀 합류 신청
          </p>
          <h1 className="mt-1 text-xl font-bold text-[#1E1B4B]">BalanceDot WorkFlow</h1>
          <p className="mt-1 text-xs text-slate-500">
            관리자가 검토 후 이메일로 안내드릴게요.
          </p>
        </header>

        {submitted ? (
          <div className="rounded-2xl border border-emerald-200 bg-emerald-50 p-6 text-center space-y-2">
            <CheckCircle2 size={32} className="mx-auto text-emerald-500" aria-hidden="true" />
            <p className="text-base font-bold text-emerald-900">신청이 접수됐어요</p>
            <p className="text-sm text-emerald-800">검토 후 이메일로 안내드릴게요.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-violet-100 bg-white p-5 space-y-3" noValidate>
            <Input
              label="이름" required
              value={form.name}
              onChange={(e) => update('name', e.target.value)}
              disabled={submitting}
              placeholder="홍길동"
            />
            <Input
              type="email" label="이메일" required
              value={form.email}
              onChange={(e) => update('email', e.target.value)}
              disabled={submitting}
              placeholder="example@email.com"
            />
            <Input
              type="tel" label="연락처 (선택)"
              value={form.phone}
              onChange={(e) => update('phone', e.target.value)}
              disabled={submitting}
              placeholder="010-0000-0000"
            />
            <Input
              label="소속·부서 (선택)"
              value={form.department}
              onChange={(e) => update('department', e.target.value)}
              disabled={submitting}
            />
            <Input
              label="직책 (선택)"
              value={form.position}
              onChange={(e) => update('position', e.target.value)}
              disabled={submitting}
            />
            <div className="space-y-1">
              <label className="text-xs font-semibold text-slate-700">신청 메시지 (선택)</label>
              <textarea
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                disabled={submitting}
                rows={4}
                placeholder="간단한 자기소개와 합류 목적을 작성해 주세요."
                className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm text-slate-800 outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-y leading-relaxed"
              />
            </div>

            {errorMsg && (
              <div role="alert" className="rounded-xl bg-rose-50 border border-rose-100 px-3 py-2 text-xs text-rose-700">
                {errorMsg}
              </div>
            )}

            <Button
              type="submit"
              variant="primary"
              size="lg"
              loading={submitting}
              leftIcon={<Send size={14} />}
              className="!w-full"
            >
              신청하기
            </Button>
          </form>
        )}

        <p className="text-center text-[10px] text-slate-400 py-2">© 2026 (주)밸런스닷 · WorkFlow</p>
      </div>
    </div>
  );
}
