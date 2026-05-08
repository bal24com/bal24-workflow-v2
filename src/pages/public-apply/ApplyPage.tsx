// bal24 v2 — 교육생 신청 외부 공개 페이지 (STEP 11 옵션 B)
// URL: /apply/:programId
// 인증 불필요 — 모바일 우선

import { useCallback, useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, GraduationCap, Calendar, MapPin, Users, CheckCircle2 } from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import type { Program } from '../../types/database';
import PromoSection from './PromoSection';

interface FormState {
  name: string;
  phone: string;
  email: string;
  birthYear: string;
  gender: '' | 'male' | 'female' | 'other';
  address: string;
  organization: string;
  motivation: string;
  experience: string;
  privacyAgreed: boolean;
}

const EMPTY: FormState = {
  name: '',
  phone: '',
  email: '',
  birthYear: '',
  gender: '',
  address: '',
  organization: '',
  motivation: '',
  experience: '',
  privacyAgreed: false,
};

export default function ApplyPage() {
  const { programId } = useParams<{ programId: string }>();
  const toast = useToast();
  const [program, setProgram] = useState<Program | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('programs')
        .select('*')
        .eq('id', programId)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[apply] 프로그램 조회 실패:', error.message);
      }
      setProgram((data as Program | null) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId]);

  const update = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!program || !programId) return;

    if (!form.name.trim()) {
      toast.error('이름을 입력해 주세요.');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('연락처를 입력해 주세요.');
      return;
    }
    if (!form.privacyAgreed) {
      toast.error('개인정보 수집·이용에 동의해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        program_id: programId,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        birth_year: form.birthYear || null,
        gender: form.gender || null,
        address: form.address.trim() || null,
        organization: form.organization.trim() || null,
        motivation: form.motivation.trim() || null,
        experience: form.experience.trim() || null,
        privacy_agreed: true,
        privacy_agreed_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('participant_applications').insert(payload);
      if (error) throw error;
      toast.success('신청이 접수되었어요.');
      setSubmitted(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[apply] 신청 저장 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('duplicate') || m.includes('unique')) {
        toast.error('이미 같은 연락처로 신청하신 기록이 있어요.');
      } else {
        toast.error('신청 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  };

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
      </div>
    );
  }

  if (!program) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center max-w-md">
          <p className="text-lg font-bold text-[#1E1B4B] mb-2">프로그램을 찾을 수 없어요</p>
          <p className="text-sm text-slate-500">링크를 다시 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center max-w-md w-full">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={48} aria-hidden="true" />
          <h1 className="text-xl font-bold text-[#1E1B4B] mb-2">신청이 완료되었어요!</h1>
          <p className="text-sm text-slate-500 mb-1">
            <span className="font-semibold text-violet-700">{program.name}</span>
          </p>
          <p className="text-sm text-slate-500">담당자 검토 후 개별 연락드릴게요.</p>
        </div>
      </div>
    );
  }

  const closed = program.status === '완료' || program.status === '취소';

  return (
    <div className="min-h-screen bg-slate-50">
      {/* Hero — 박경수님 명세 violet→orange 그라데이션 */}
      <header className="bg-gradient-to-br from-violet-600 via-violet-500 to-orange-500 text-white">
        <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold mb-3">
            <GraduationCap size={14} aria-hidden="true" />
            교육생 모집
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">{program.name}</h1>
          <div className="flex flex-wrap gap-3 text-sm opacity-95">
            {(program.start_date || program.end_date) && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden="true" />
                {formatDateKo(program.start_date)} ~ {formatDateKo(program.end_date)}
              </span>
            )}
            {program.venue && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={14} aria-hidden="true" />
                {program.venue}
              </span>
            )}
            {program.capacity != null && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} aria-hidden="true" />
                정원 {program.capacity}명
              </span>
            )}
          </div>
          {program.description && (
            <p className="mt-4 text-sm opacity-95 whitespace-pre-wrap leading-relaxed max-w-2xl">
              {program.description}
            </p>
          )}
        </div>
      </header>

      {/* 본문 — 홍보 + 폼 */}
      <main className="max-w-3xl mx-auto px-5 py-8 flex flex-col gap-4">
        <PromoSection program={program} />

        {closed ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm font-semibold text-amber-800">모집이 종료된 프로그램이에요.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-violet-100 bg-white p-5 sm:p-7 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-5" noValidate>
            <h2 className="text-lg font-bold text-[#1E1B4B]">신청서 작성</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="이름" required value={form.name} onChange={(e) => update('name', e.target.value)} disabled={submitting} placeholder="홍길동" />
              <Input type="tel" label="연락처" required value={form.phone} onChange={(e) => update('phone', e.target.value)} disabled={submitting} placeholder="010-0000-0000" />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input type="email" label="이메일" value={form.email} onChange={(e) => update('email', e.target.value)} disabled={submitting} placeholder="example@email.com" />
              <Input type="date" label="생년월일" value={form.birthYear} onChange={(e) => update('birthYear', e.target.value)} disabled={submitting} />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">성별</label>
                <select
                  value={form.gender}
                  onChange={(e) => update('gender', e.target.value as FormState['gender'])}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                >
                  <option value="">선택 안 함</option>
                  <option value="male">남성</option>
                  <option value="female">여성</option>
                  <option value="other">기타</option>
                </select>
              </div>
              <Input label="소속기관" value={form.organization} onChange={(e) => update('organization', e.target.value)} disabled={submitting} placeholder="회사·학교명" />
            </div>

            <Input label="주소" value={form.address} onChange={(e) => update('address', e.target.value)} disabled={submitting} placeholder="간단한 주소 (선택)" />

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">지원 동기</label>
              <textarea
                value={form.motivation}
                onChange={(e) => update('motivation', e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="이 프로그램에 지원한 이유를 간단히 적어주세요."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">관련 경험</label>
              <textarea
                value={form.experience}
                onChange={(e) => update('experience', e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="관련 경험·자격이 있다면 간단히 적어주세요."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>

            <label className="flex items-start gap-2 rounded-xl border border-violet-100 bg-violet-50/40 px-3 py-3 text-sm cursor-pointer">
              <input
                type="checkbox"
                checked={form.privacyAgreed}
                onChange={(e) => update('privacyAgreed', e.target.checked)}
                disabled={submitting}
                className="mt-0.5 w-4 h-4 rounded border-slate-300 text-primary focus:ring-primary/30"
              />
              <span className="text-slate-700">
                <span className="font-semibold">[필수]</span> 신청 처리·합격 안내를 위한 개인정보 수집·이용에 동의해요.
                <span className="block mt-1 text-xs text-slate-500">
                  수집 항목: 이름·연락처·이메일·생년월일·소속·지원 동기 / 보유 기간: 프로그램 종료 후 1년
                </span>
              </span>
            </label>

            <Button type="submit" variant="primary" loading={submitting} className="!w-full !py-3 text-base font-semibold">
              신청하기
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">© 2026 BalanceDot WorkFlow</p>
      </main>
    </div>
  );
}
