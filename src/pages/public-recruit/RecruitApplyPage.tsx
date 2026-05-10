// bal24 v2 — 강사·TA 모집 외부 공개 페이지 (STEP 11 옵션 B)
// URL: /recruit/:token
// 인증 불필요 — 모바일 우선

import { useCallback, useEffect, useState } from 'react';
import type { ChangeEvent, FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, Briefcase, CheckCircle2, Calendar, Users, Upload, X,
} from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import { RECRUIT_TYPE_LABEL, type RecruitForm } from '../../types/application';

const RECRUIT_FILES_BUCKET = 'recruit-files';
const MAX_FILES = 3;

interface FormState {
  name: string;
  phone: string;
  email: string;
  career: string;
  portfolioUrl: string;
  specialty: string;
  availableDates: string;
  message: string;
  privacyAgreed: boolean;
}

const EMPTY: FormState = {
  name: '',
  phone: '',
  email: '',
  career: '',
  portfolioUrl: '',
  specialty: '',
  availableDates: '',
  message: '',
  privacyAgreed: false,
};

interface UploadedFile {
  name: string;
  url: string;
}

export default function RecruitApplyPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [recruit, setRecruit] = useState<RecruitForm | null>(null);
  const [loading, setLoading] = useState(true);
  const [form, setForm] = useState<FormState>(EMPTY);
  const [files, setFiles] = useState<UploadedFile[]>([]);
  const [uploading, setUploading] = useState(false);
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('recruit_forms')
        .select('*')
        .eq('form_token', token)
        .maybeSingle();
      if (cancelled) return;
      if (error) console.error('[recruit-apply] 모집 조회 실패:', error.message);
      setRecruit((data as RecruitForm | null) ?? null);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const update = useCallback(<K extends keyof FormState>(k: K, v: FormState[K]) => {
    setForm((p) => ({ ...p, [k]: v }));
  }, []);

  const handleFileUpload = async (e: ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    e.target.value = '';
    if (!file) return;
    if (files.length >= MAX_FILES) {
      toast.warning(`첨부 파일은 최대 ${MAX_FILES}개까지 가능해요.`);
      return;
    }
    if (file.size > 10 * 1024 * 1024) {
      toast.error('파일 크기는 10MB 이하여야 해요.');
      return;
    }

    setUploading(true);
    try {
      const ext = file.name.includes('.') ? file.name.split('.').pop() : '';
      const safeBase = file.name.replace(/\.[^.]+$/, '').replace(/[^A-Za-z0-9._-]+/g, '_').slice(0, 50);
      const path = `${token}/${Date.now()}_${safeBase}${ext ? '.' + ext : ''}`;
      const { error } = await supabase.storage
        .from(RECRUIT_FILES_BUCKET)
        .upload(path, file, { upsert: false, contentType: file.type || undefined });
      if (error) throw error;
      const { data: pub } = supabase.storage.from(RECRUIT_FILES_BUCKET).getPublicUrl(path);
      setFiles((prev) => [...prev, { name: file.name, url: pub.publicUrl }]);
      toast.success('파일을 업로드했어요.');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[recruit-apply] 파일 업로드 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('bucket not found')) {
        toast.error(`파일 저장소(${RECRUIT_FILES_BUCKET})가 없어요. 관리자에게 문의해 주세요.`);
      } else {
        toast.error('파일 업로드 중 오류가 발생했어요.');
      }
    } finally {
      setUploading(false);
    }
  };

  const removeFile = (idx: number) => {
    setFiles((prev) => prev.filter((_, i) => i !== idx));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!recruit) return;

    if (!form.name.trim()) {
      toast.error('이름을 입력해 주세요.');
      return;
    }
    if (!form.phone.trim()) {
      toast.error('연락처를 입력해 주세요.');
      return;
    }
    if (!form.career.trim()) {
      toast.error('경력 소개를 입력해 주세요.');
      return;
    }
    if (!form.privacyAgreed) {
      toast.error('개인정보 수집·이용에 동의해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const specialtyArr = form.specialty
        .split(',')
        .map((s) => s.trim())
        .filter(Boolean);
      const payload = {
        form_id: recruit.id,
        name: form.name.trim(),
        phone: form.phone.trim(),
        email: form.email.trim() || null,
        career: form.career.trim() || null,
        portfolio_url: form.portfolioUrl.trim() || null,
        specialty: specialtyArr.length > 0 ? specialtyArr : null,
        available_dates: form.availableDates.trim() || null,
        message: form.message.trim() || null,
        attachment_urls: files.length > 0 ? files.map((f) => f.url) : null,
        privacy_agreed: true,
        privacy_agreed_at: new Date().toISOString(),
      };
      const { error } = await supabase.from('recruit_applications').insert(payload);
      if (error) throw error;
      toast.success('지원이 접수되었어요.');
      setSubmitted(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[recruit-apply] 지원 저장 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('duplicate') || m.includes('unique')) {
        toast.error('이미 같은 연락처로 지원하신 기록이 있어요.');
      } else {
        toast.error('지원 접수 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
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

  if (!recruit || !recruit.is_active) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center max-w-md">
          <p className="text-lg font-bold text-[#1E1B4B] mb-2">모집이 종료되었어요</p>
          <p className="text-sm text-slate-500">관심 가져 주셔서 감사합니다.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center max-w-md w-full">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={48} aria-hidden="true" />
          <h1 className="text-xl font-bold text-[#1E1B4B] mb-2">지원이 완료되었어요!</h1>
          <p className="text-sm text-slate-500">담당자 검토 후 개별 연락드릴게요.</p>
        </div>
      </div>
    );
  }

  const deadlinePassed = recruit.deadline && new Date(recruit.deadline) < new Date(new Date().toDateString());
  const typeLabel = RECRUIT_TYPE_LABEL[recruit.recruit_type];

  return (
    <div className="min-h-screen bg-slate-50">
      <header className="bg-gradient-to-br from-violet-600 via-violet-500 to-cyan-500 text-white">
        <div className="max-w-3xl mx-auto px-5 py-10 sm:py-14">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold mb-3">
            <Briefcase size={14} aria-hidden="true" />
            {typeLabel} 모집
          </div>
          <h1 className="text-2xl sm:text-3xl font-bold mb-3">{recruit.title}</h1>
          <div className="flex flex-wrap gap-3 text-sm opacity-95">
            {recruit.deadline && (
              <span className="inline-flex items-center gap-1.5">
                <Calendar size={14} aria-hidden="true" />
                마감 {formatDateKo(recruit.deadline)}
              </span>
            )}
            {recruit.max_count != null && (
              <span className="inline-flex items-center gap-1.5">
                <Users size={14} aria-hidden="true" />
                {recruit.max_count}명 모집
              </span>
            )}
          </div>
          {recruit.description && (
            <p className="mt-4 text-sm opacity-95 whitespace-pre-wrap leading-relaxed max-w-2xl">
              {recruit.description}
            </p>
          )}
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-5 py-8 space-y-5">
        {(recruit.requirements || recruit.benefits) && (
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            {recruit.requirements && (
              <section className="rounded-2xl border border-violet-100 bg-white p-5">
                <h2 className="text-sm font-bold text-[#1E1B4B] mb-2">자격 요건</h2>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{recruit.requirements}</p>
              </section>
            )}
            {recruit.benefits && (
              <section className="rounded-2xl border border-violet-100 bg-white p-5">
                <h2 className="text-sm font-bold text-[#1E1B4B] mb-2">혜택·보상</h2>
                <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed">{recruit.benefits}</p>
              </section>
            )}
          </div>
        )}

        {deadlinePassed ? (
          <div className="rounded-2xl border border-amber-200 bg-amber-50 p-6 text-center">
            <p className="text-sm font-semibold text-amber-800">모집 마감일이 지났어요.</p>
          </div>
        ) : (
          <form onSubmit={handleSubmit} className="rounded-2xl border border-violet-100 bg-white p-5 sm:p-7 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-5" noValidate>
            <h2 className="text-lg font-bold text-[#1E1B4B]">지원서 작성</h2>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="이름" required value={form.name} onChange={(e) => update('name', e.target.value)} disabled={submitting} placeholder="홍길동" />
              <Input type="tel" label="연락처" required value={form.phone} onChange={(e) => update('phone', e.target.value)} disabled={submitting} placeholder="010-0000-0000" />
            </div>

            <Input type="email" label="이메일" value={form.email} onChange={(e) => update('email', e.target.value)} disabled={submitting} placeholder="example@email.com" />

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">경력 소개 <span className="text-rose-500">*</span></label>
              <textarea
                value={form.career}
                onChange={(e) => update('career', e.target.value)}
                disabled={submitting}
                rows={4}
                placeholder="주요 경력·이력을 간단히 적어주세요."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <Input label="포트폴리오 URL" type="url" value={form.portfolioUrl} onChange={(e) => update('portfolioUrl', e.target.value)} disabled={submitting} placeholder="https://..." />
              <Input label="전문 분야" value={form.specialty} onChange={(e) => update('specialty', e.target.value)} disabled={submitting} placeholder="쉼표로 구분 (예: 웹개발, AI)" helperText="여러 분야는 쉼표(,)로 구분해 주세요." />
            </div>

            <Input label="가능 일정" value={form.availableDates} onChange={(e) => update('availableDates', e.target.value)} disabled={submitting} placeholder="예) 평일 오후, 주말 오전" />

            <div className="space-y-1.5">
              <label className="text-sm font-semibold text-slate-700">지원 동기 / 자기소개</label>
              <textarea
                value={form.message}
                onChange={(e) => update('message', e.target.value)}
                disabled={submitting}
                rows={3}
                placeholder="이 모집에 지원하신 이유를 자유롭게 적어주세요."
                className="w-full resize-none rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60"
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-semibold text-slate-700">서류 첨부 (최대 {MAX_FILES}개, 각 10MB)</label>
              <label className="cursor-pointer inline-flex items-center gap-2 rounded-xl border border-violet-200 bg-violet-50 px-3 py-2 text-sm font-semibold text-violet-700 hover:bg-violet-100 disabled:opacity-50">
                <Upload size={14} aria-hidden="true" />
                {uploading ? '업로드 중…' : '파일 추가'}
                <input
                  type="file"
                  onChange={handleFileUpload}
                  disabled={submitting || uploading || files.length >= MAX_FILES}
                  className="hidden"
                />
              </label>
              {files.length > 0 && (
                <ul className="space-y-1.5">
                  {files.map((f, idx) => (
                    <li key={f.url} className="flex items-center gap-2 rounded-xl border border-slate-200 bg-white px-3 py-2 text-sm">
                      <span className="flex-1 truncate text-slate-700">{f.name}</span>
                      <button type="button" onClick={() => removeFile(idx)} aria-label="첨부 제거" className="text-slate-400 hover:text-rose-500">
                        <X size={14} aria-hidden="true" />
                      </button>
                    </li>
                  ))}
                </ul>
              )}
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
                <span className="font-semibold">[필수]</span> 지원 검토·결과 안내를 위한 개인정보 수집·이용에 동의해요.
                <span className="block mt-1 text-xs text-slate-500">
                  수집 항목: 이름·연락처·이메일·경력·포트폴리오·첨부서류 / 보유 기간: 모집 종료 후 1년
                </span>
              </span>
            </label>

            <Button type="submit" variant="primary" loading={submitting} disabled={uploading} className="!w-full !py-3 text-base font-semibold">
              지원하기
            </Button>
          </form>
        )}

        <p className="mt-6 text-center text-xs text-slate-400">© 2026 BalanceDot WorkFlow</p>
      </main>
    </div>
  );
}
