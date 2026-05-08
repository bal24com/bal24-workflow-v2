// bal24 v2 — 외부공유 항목 · 만족도 응답 (학생, 결과 단계)
// public_forms (form_type='survey') → /form/:form_token 점프.
// survey_open_at 시점 체크 (추가 명세 #1).

import { useEffect, useState } from 'react';
import { Star, ExternalLink, Loader2, Hourglass } from 'lucide-react';
import { supabase } from '../../../lib/supabase';
import type { PublicForm } from '../../../types/database';
import ItemCard from './ItemCard';

interface Props {
  programId: string;
  surveyOpenAt: string | null;
}

type Row = Pick<PublicForm, 'id' | 'title' | 'form_token' | 'is_active' | 'open_at' | 'close_at' | 'description'>;

function notYetOpen(surveyOpenAt: string | null): boolean {
  if (!surveyOpenAt) return false;
  return new Date() < new Date(surveyOpenAt);
}

export default function SurveySubmitItem({ programId, surveyOpenAt }: Props) {
  const [list, setList] = useState<Row[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('public_forms')
        .select('id, title, form_token, is_active, open_at, close_at, description')
        .eq('program_id', programId)
        .eq('form_type', 'survey')
        .order('created_at', { ascending: false });
      if (cancelled) return;
      if (error) {
        console.error('[share-portal/student] 설문 폼 조회 실패:', error.message);
      } else {
        setList((data as Row[] | null) ?? []);
      }
      setLoading(false);
    })();
    return () => {
      cancelled = true;
    };
  }, [programId]);

  if (notYetOpen(surveyOpenAt)) {
    const formatted = new Date(surveyOpenAt!).toLocaleString('ko-KR', {
      year: 'numeric', month: 'long', day: 'numeric', hour: '2-digit', minute: '2-digit',
    });
    return (
      <ItemCard
        icon={<Hourglass size={18} aria-hidden="true" />}
        title="만족도 응답"
        hint="아직 만족도 응답 시점이 되지 않았어요"
      >
        <div className="rounded-xl border border-violet-100 bg-violet-50/30 px-4 py-3 text-center">
          <p className="text-xs text-slate-600">
            <b>{formatted}</b> 이후에 응답할 수 있어요.
          </p>
          <p className="mt-1 text-[11px] text-slate-400">시간이 되면 다시 방문해 주세요.</p>
        </div>
      </ItemCard>
    );
  }

  return (
    <ItemCard
      icon={<Star size={18} aria-hidden="true" />}
      title="만족도 응답"
      hint="아래 버튼을 눌러 응답해 주세요 — 응답은 익명입니다"
    >
      {loading ? (
        <div className="flex justify-center py-6">
          <Loader2 className="animate-spin text-violet-400" size={18} aria-hidden="true" />
        </div>
      ) : list.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-2">
          아직 등록된 설문 폼이 없어요.
        </p>
      ) : (
        <ul className="flex flex-col gap-1.5">
          {list.map((f) => (
            <li key={f.id}>
              <a
                href={`/form/${f.form_token}`}
                target="_blank"
                rel="noreferrer"
                className={`flex items-center gap-2 rounded-xl border px-3 py-2.5 transition-colors ${
                  f.is_active
                    ? 'border-orange-200 bg-orange-50/40 hover:bg-orange-50'
                    : 'border-slate-200 bg-slate-50/60 cursor-not-allowed pointer-events-none opacity-60'
                }`}
                aria-disabled={!f.is_active}
              >
                <Star size={14} className="shrink-0 text-orange-500" aria-hidden="true" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-bold text-[#1E1B4B] truncate">{f.title}</p>
                  {f.description && (
                    <p className="mt-0.5 text-[11px] text-slate-500 truncate">{f.description}</p>
                  )}
                </div>
                {f.is_active && (
                  <ExternalLink size={13} className="shrink-0 text-orange-500" aria-hidden="true" />
                )}
              </a>
            </li>
          ))}
        </ul>
      )}
    </ItemCard>
  );
}
