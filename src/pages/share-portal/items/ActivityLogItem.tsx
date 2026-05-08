// bal24 v2 — 외부공유 항목 · 활동일지 (전문가, 진행 단계)
// activity_logs INSERT (log_type='dispatch' 기본값, 추가 명세 #3).

import { useEffect, useState } from 'react';
import {
  ListChecks, Send, CheckCircle2, Loader2,
} from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import { formatDateKo } from '../../../lib/utils';
import type { ActivityLog, ActivityLogType } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
  expertId: string | null;
}

const inputClass =
  'w-full rounded-xl border border-violet-100 bg-white px-3 py-2.5 text-sm text-[#1E1B4B] placeholder-slate-300 focus:outline-none focus:border-violet-400 focus:ring-2 focus:ring-violet-100 transition-colors';

function todayIso(): string {
  const d = new Date();
  const m = String(d.getMonth() + 1).padStart(2, '0');
  const day = String(d.getDate()).padStart(2, '0');
  return `${d.getFullYear()}-${m}-${day}`;
}

type RecentRow = Pick<ActivityLog, 'id' | 'title' | 'activity_date' | 'log_type'>;

export default function ActivityLogItem({ programId, expertId }: Props) {
  const [recent, setRecent] = useState<RecentRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [title, setTitle] = useState('');
  const [activityDate, setActivityDate] = useState(todayIso());
  const [content, setContent] = useState('');
  const [logType] = useState<ActivityLogType>('dispatch');
  const [submitting, setSubmitting] = useState(false);
  const [done, setDone] = useState(false);
  const [errMsg, setErrMsg] = useState<string | null>(null);

  async function refresh() {
    if (!expertId) {
      setRecent([]);
      return;
    }
    const { data, error } = await supabase
      .from('activity_logs')
      .select('id, title, activity_date, log_type')
      .eq('program_id', programId)
      .eq('expert_id', expertId)
      .is('deleted_at', null)
      .order('activity_date', { ascending: false })
      .limit(5);
    if (error) {
      console.error('[share-portal/expert] 활동일지 최근 조회 실패:', error.message);
      return;
    }
    setRecent((data as RecentRow[] | null) ?? []);
  }

  useEffect(() => {
    if (!programId || !expertId) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [programId, expertId]);

  async function handleSubmit() {
    setErrMsg(null);
    if (!title.trim()) {
      setErrMsg('제목을 입력해 주세요.');
      return;
    }
    if (!activityDate) {
      setErrMsg('활동일을 선택해 주세요.');
      return;
    }
    if (!expertId) {
      setErrMsg('본인 식별이 필요해요.');
      return;
    }
    setSubmitting(true);
    try {
      const { error } = await supabase.from('activity_logs').insert({
        program_id: programId,
        expert_id: expertId,
        log_type: logType,
        title: title.trim(),
        activity_date: activityDate,
        content: content.trim() || null,
      });
      if (error) {
        console.error('[share-portal/expert] 활동일지 INSERT 실패:', error.message);
        setErrMsg('전송에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      setDone(true);
      setTitle('');
      setContent('');
      await refresh();
    } finally {
      setSubmitting(false);
    }
  }

  return (
    <ItemCard
      icon={<ListChecks size={18} aria-hidden="true" />}
      title="활동일지 작성"
      hint="진행한 활동을 기록해 주세요 — 일지는 담당자에게 자동 공유돼요"
    >
      {done ? (
        <div className="rounded-xl border border-emerald-200 bg-emerald-50/60 px-4 py-4 flex items-start gap-2">
          <CheckCircle2 size={18} className="shrink-0 mt-0.5 text-emerald-600" aria-hidden="true" />
          <div>
            <p className="text-sm font-bold text-emerald-700">활동일지를 저장했어요</p>
            <p className="mt-0.5 text-xs text-emerald-700/80 leading-relaxed">
              담당자가 확인해요.{' '}
              <button
                type="button"
                onClick={() => setDone(false)}
                className="underline font-semibold"
              >
                새 일지 작성
              </button>
            </p>
          </div>
        </div>
      ) : (
        <div className="flex flex-col gap-2.5">
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">
                활동일 <span className="text-rose-500">*</span>
              </label>
              <input
                type="date"
                value={activityDate}
                onChange={(e) => setActivityDate(e.target.value)}
                className={inputClass}
              />
            </div>
            <div className="flex flex-col gap-1">
              <label className="text-[11px] font-bold text-slate-600">유형</label>
              <input
                type="text"
                value="파견·외부 활동"
                disabled
                className={`${inputClass} bg-slate-50 text-slate-500`}
              />
              <p className="text-[10px] text-slate-400">
                ⓘ 외부공유 페이지에서는 항상 "파견·외부 활동"으로 기록돼요
              </p>
            </div>
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">
              제목 <span className="text-rose-500">*</span>
            </label>
            <input
              type="text"
              value={title}
              onChange={(e) => setTitle(e.target.value)}
              placeholder="예) 1차시 강의 진행"
              className={inputClass}
            />
          </div>

          <div className="flex flex-col gap-1">
            <label className="text-[11px] font-bold text-slate-600">활동 내용</label>
            <textarea
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="진행 내용·소감·참고할 점 등"
              className={`${inputClass} min-h-[100px] resize-y leading-relaxed`}
            />
          </div>

          {errMsg && (
            <p role="alert" className="text-xs text-rose-600 font-semibold">{errMsg}</p>
          )}

          <button
            type="button"
            onClick={() => void handleSubmit()}
            disabled={submitting || !title.trim() || !expertId}
            className="self-end inline-flex items-center gap-1.5 h-11 px-5 rounded-xl bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
          >
            {submitting ? <Loader2 size={14} className="animate-spin" aria-hidden="true" /> : <Send size={14} aria-hidden="true" />}
            {submitting ? '저장 중…' : '일지 저장'}
          </button>
        </div>
      )}

      {/* 최근 일지 */}
      {!loading && recent.length > 0 && (
        <div className="mt-4 pt-3 border-t border-violet-100">
          <p className="text-[11px] font-bold text-slate-600 mb-1.5">최근 작성한 일지 ({recent.length})</p>
          <ul className="flex flex-col gap-1">
            {recent.map((r) => (
              <li
                key={r.id}
                className="flex items-center gap-2 text-[11px] text-slate-600 px-2 py-1.5 rounded-md bg-violet-50/40"
              >
                <span className="text-[10px] text-slate-400 tabular-nums shrink-0">
                  {formatDateKo(r.activity_date)}
                </span>
                <span className="flex-1 min-w-0 truncate">{r.title}</span>
              </li>
            ))}
          </ul>
        </div>
      )}
    </ItemCard>
  );
}
