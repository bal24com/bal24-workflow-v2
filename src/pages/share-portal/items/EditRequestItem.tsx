// bal24 v2 — 외부공유 항목 · 수정요청 (program_edit_requests INSERT, 결과 단계)

import { useState } from 'react';
import { MessageSquareWarning, Send, CheckCircle2 } from 'lucide-react';
import { submitEditRequest } from '../sharePortalUtils';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
}

const inputClass =
  'w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm text-[#1E1B4B] placeholder-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors';

export default function EditRequestItem({ programId }: Props) {
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [content, setContent] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function handleSubmit() {
    setErrMsg(null);
    if (!name.trim()) {
      setErrMsg('이름을 입력해 주세요.');
      return;
    }
    if (!content.trim()) {
      setErrMsg('수정요청 내용을 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    try {
      const ok = await submitEditRequest(programId, name, phone || null, content);
      if (!ok) {
        setErrMsg('전송에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setDone(true);
      setName('');
      setPhone('');
      setContent('');
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ItemCard
      icon={<MessageSquareWarning size={18} aria-hidden="true" />}
      title="수정요청"
      hint="결과보고서·교육 내용에 대한 수정 요청을 담당자에게 전달해요"
    >
      {done ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 flex items-start gap-2">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-emerald-700">수정요청을 보냈어요</p>
            <p className="mt-0.5 text-xs text-emerald-700/80 leading-relaxed">
              담당자가 검토 후 회신드릴게요. 추가 요청이 있으면{' '}
              <button
                type="button"
                onClick={() => setDone(false)}
                className="underline font-semibold"
              >
                새로 작성
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
              수정요청 내용 <span className="text-rose-500">*</span>
            </label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="구체적으로 어느 부분을 어떻게 수정해야 하는지 적어주세요"
              className={`${inputClass} min-h-[120px] resize-y leading-relaxed`}
            />
          </div>

          {errMsg && (
            <p role="alert" className="text-xs text-rose-600 font-semibold">{errMsg}</p>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !name.trim() || !content.trim()}
            className="self-end inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            <Send size={14} aria-hidden="true" />
            {submitting ? '보내는 중…' : '수정요청 보내기'}
          </button>
        </div>
      )}
    </ItemCard>
  );
}
