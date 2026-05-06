// bal24 v2 — 외부 공개 폼 (인증 불필요)
// /form/:token

import { useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type {
  FormFieldSpec, PublicForm,
} from '../../types/database';

type ScreenState = 'loading' | 'notfound' | 'closed' | 'expired' | 'full' | 'form' | 'success';

type FieldValues = Record<string, string>;

export default function PublicFormPage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [form, setForm] = useState<PublicForm | null>(null);
  const [values, setValues] = useState<FieldValues>({});
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setScreen('notfound'); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('public_forms')
          .select('*, applications:form_applications(id, applicant_phone)')
          .eq('form_token', token)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('[public-form] 조회 실패:', error.message);
          setScreen('notfound');
          return;
        }
        if (!data) { setScreen('notfound'); return; }
        const f = data as PublicForm & { applications: { id: string; applicant_phone: string | null }[] };
        setForm(f);
        if (!f.is_active) { setScreen('closed'); return; }
        const now = Date.now();
        if (f.close_at && new Date(f.close_at).getTime() < now) { setScreen('expired'); return; }
        if (f.open_at && new Date(f.open_at).getTime() > now) { setScreen('expired'); return; }
        if (f.max_applicants != null && f.applications.length >= f.max_applicants) {
          setScreen('full'); return;
        }
        setScreen('form');
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[public-form] 처리 중 오류:', raw);
        setScreen('notfound');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const fields: FormFieldSpec[] = useMemo(() => form?.fields ?? [], [form]);

  const updateValue = (key: string, v: string) => {
    setValues((p) => ({ ...p, [key]: v }));
  };

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!form) return;

    // 필수 검증
    for (const f of fields) {
      if (f.required && !values[f.key]?.toString().trim()) {
        setErrorMsg(`"${f.label}" 항목은 필수예요.`);
        return;
      }
    }

    const phone = values['phone']?.toString().trim() || '';

    setSubmitting(true);
    try {
      // 중복 제출 방지: 같은 form_id + 전화 이미 있으면 거부
      if (phone) {
        const { data: existing, error: dupErr } = await supabase
          .from('form_applications')
          .select('id')
          .eq('form_id', form.id)
          .eq('applicant_phone', phone)
          .limit(1);
        if (dupErr) console.error('[public-form] 중복 검사 실패:', dupErr.message);
        if (existing && existing.length > 0) {
          setErrorMsg('같은 전화번호로 이미 신청하셨어요.');
          setSubmitting(false);
          return;
        }
      }

      const { error } = await supabase.from('form_applications').insert({
        form_id: form.id,
        program_id: form.program_id,
        data: values,
        applicant_name: values['name']?.toString().trim() || null,
        applicant_phone: phone || null,
        applicant_email: values['email']?.toString().trim() || null,
        status: '검토중',
      });
      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes('row-level security')) {
          setErrorMsg('신청 등록이 일시적으로 중단되었어요. 운영자에게 문의해 주세요.');
        } else {
          setErrorMsg('신청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
        }
        return;
      }
      setScreen('success');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[public-form] 신청 실패:', raw);
      setErrorMsg('신청 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 sm:p-8 space-y-5">
        {screen === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted">불러오는 중…</p>
          </div>
        )}

        {screen === 'notfound' && <CenterMessage emoji="🔍" title="유효하지 않은 링크예요" desc="링크를 다시 확인해 주세요." />}
        {screen === 'closed' && <CenterMessage emoji="🚪" title="신청이 마감되었습니다" desc={form?.title} />}
        {screen === 'expired' && <CenterMessage emoji="⏱️" title="신청 기간이 종료되었습니다" desc={form?.title} />}
        {screen === 'full' && <CenterMessage emoji="🎉" title="모집이 완료되었습니다" desc="많은 관심 감사합니다." />}

        {screen === 'success' && (
          <div className="text-center space-y-3 py-6">
            <CheckCircle2 size={48} className="mx-auto text-success" />
            <h1 className="text-xl font-bold text-text">신청이 완료되었습니다!</h1>
            <p className="text-sm text-muted">검토 후 연락드리겠습니다.</p>
            {form?.title && (
              <div className="text-xs text-muted bg-slate-50 rounded-lg px-3 py-2 inline-block">
                {form.title}
              </div>
            )}
          </div>
        )}

        {screen === 'form' && form && (
          <>
            <header className="space-y-1.5 border-b border-slate-100 pb-4">
              <h1 className="text-xl font-bold text-text">{form.title}</h1>
              {form.description && (
                <p className="text-sm text-muted whitespace-pre-wrap">{form.description}</p>
              )}
            </header>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              {fields.map((f) => (
                <FieldInput key={f.key} field={f} value={values[f.key] ?? ''} onChange={(v) => updateValue(f.key, v)} disabled={submitting} />
              ))}

              {errorMsg && (
                <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:opacity-95 disabled:opacity-60 transition"
              >
                {submitting ? '처리 중…' : '신청하기'}
              </button>
            </form>

            <p className="text-center text-xs text-muted pt-2 border-t border-slate-100">
              © 2026 (주)밸런스닷 · WorkFlow
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function CenterMessage({ emoji, title, desc }: { emoji: string; title: string; desc?: string }) {
  return (
    <div className="text-center space-y-2 py-6">
      <div className="text-3xl">{emoji}</div>
      <h1 className="text-xl font-bold text-text">{title}</h1>
      {desc && <p className="text-sm text-muted">{desc}</p>}
    </div>
  );
}

function FieldInput({
  field, value, onChange, disabled,
}: {
  field: FormFieldSpec;
  value: string;
  onChange: (v: string) => void;
  disabled?: boolean;
}) {
  const baseClass = 'w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60';

  return (
    <div className="space-y-1.5">
      <label className="text-sm font-semibold text-slate-700">
        {field.label}
        {field.required && <span className="text-danger ml-1">*</span>}
      </label>
      {field.type === 'textarea' ? (
        <textarea rows={3} value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled}
          placeholder={field.placeholder} className={`${baseClass} resize-none`} />
      ) : field.type === 'select' ? (
        <select value={value} onChange={(e) => onChange(e.target.value)} disabled={disabled} className={baseClass}>
          <option value="">선택해 주세요</option>
          {(field.options ?? []).map((o) => (<option key={o} value={o}>{o}</option>))}
        </select>
      ) : (
        <input
          type={field.type === 'number' ? 'number' : field.type === 'date' ? 'date' : 'text'}
          value={value}
          onChange={(e) => onChange(e.target.value)}
          disabled={disabled}
          placeholder={field.placeholder}
          inputMode={field.type === 'number' ? 'numeric' : undefined}
          className={baseClass}
        />
      )}
    </div>
  );
}
