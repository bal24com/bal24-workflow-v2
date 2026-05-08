// bal24 v2 — 외부공유 항목 · 결과물 업로드 (학생, 결과 단계)
// Q3 옵션 A: URL 입력 + form_applications INSERT (form_type='application' 활용)

import { useEffect, useState } from 'react';
import {
  Upload, Send, CheckCircle2, Loader2, FileUp,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { PublicForm } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

const inputClass =
  'w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm text-[#1E1B4B] placeholder-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors';

type Form = Pick<PublicForm, 'id' | 'form_token'>;

export default function OutcomeUploadItem({ programId }: Props) {
  const [form, setForm] = useState<Form | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [url, setUrl] = useState('');
  const [memo, setMemo] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      // 결과물 수집용 application 폼 1개 fetch (없으면 안내)
      const { data, error } = await supabase
        .from('public_forms')
        .select('id, form_token')
        .eq('program_id', programId)
        .eq('form_type', 'application')
        .eq('is_active', true)
        .order('created_at', { ascending: false })
        .limit(1)
        .maybeSingle();
      if (cancelled) return;
      if (error) {
        console.error('[share-portal/student] 결과물 폼 조회 실패:', error.message);
      } else {
        setForm((data as Form | null) ?? null);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  async function handleSubmit() {
    setErrMsg(null);
    if (!form) {
      setErrMsg('결과물 수집 폼이 아직 발행되지 않았어요. 담당자에게 문의해 주세요.');
      return;
    }
    if (!name.trim()) {
      setErrMsg('이름을 입력해 주세요.');
      return;
    }
    if (!url.trim() || !/^https?:\/\//i.test(url.trim())) {
      setErrMsg('결과물 URL을 http:// 또는 https:// 로 시작하게 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('form_applications').insert({
        form_id: form.id,
        program_id: programId,
        applicant_name: name.trim(),
        applicant_phone: phone.trim() || null,
        data: {
          outcome_url: url.trim(),
          memo: memo.trim() || null,
          submitted_via: 'share-portal/student',
        },
      });
      if (error) {
        console.error('[share-portal/student] 결과물 INSERT 실패:', error.message);
        setErrMsg('전송에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setDone(true);
      setName('');
      setPhone('');
      setUrl('');
      setMemo('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ItemCard
      icon={<Upload size={18} aria-hidden="true" />}
      title="결과물 업로드"
      hint="외부 클라우드(드라이브 등)에 업로드한 후 URL을 입력해 주세요"
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : !form ? (
        <p className="text-sm text-slate-400 italic text-center py-2">
          결과물 수집 폼이 아직 발행되지 않았어요. 담당자에게 문의해 주세요.
        </p>
      ) : done ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 flex items-start gap-2">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-emerald-700">결과물을 제출했어요</p>
            <p className="mt-0.5 text-xs text-emerald-700/80 leading-relaxed">
              담당자가 확인 후 회신드릴게요.
              {' '}
              <button
                type="button"
                onClick={() => setDone(false)}
                className="underline font-semibold"
              >
                추가 제출
              </button>
              할 수 있어요.
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">
                이름 <span className="text-rose-500">*</span>
              </label>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                placeholder="홍길동"
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">전화번호</label>
              <input
                type="tel"
                inputMode="tel"
                value={phone}
                onChange={(e) => setPhone(e.target.value)}
                placeholder="010-0000-0000 (선택)"
                className={inputClass}
              />
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">
              결과물 URL <span className="text-rose-500">*</span>
            </label>
            <input
              type="url"
              inputMode="url"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://drive.google.com/..."
              className={inputClass}
            />
            <p className="text-[10px] text-slate-400">
              ⓘ 드라이브·노션·깃허브 등 공유 링크. 외부에서 열람 가능한지 미리 확인해 주세요.
            </p>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">메모</label>
            <textarea
              value={memo}
              onChange={(e) => setMemo(e.target.value)}
              placeholder="추가 설명·강조하고 싶은 점 (선택)"
              className={`${inputClass} min-h-[80px] resize-y leading-relaxed`}
            />
          </div>

          {errMsg && (
            <p role="alert" className="text-xs text-rose-600 font-semibold">{errMsg}</p>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !name.trim() || !url.trim()}
            className="self-end inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            {submitting ? '제출 중…' : '결과물 제출'}
          </button>
        </div>
      )}

      {!done && (
        <p className="mt-2 text-[10px] text-slate-400 inline-flex items-center gap-1">
          <FileUp size={11} aria-hidden="true" />
          파일 직접 업로드는 추후 지원 예정 — 현재는 URL 입력만 가능해요.
        </p>
      )}
    </ItemCard>
  );
}
