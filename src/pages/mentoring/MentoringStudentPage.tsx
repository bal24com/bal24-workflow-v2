// bal24 v2 — 멘티 외부 페이지 (STEP-MENTORING)
// /mentoring-student/:token — 멘토 보고서 조회 + 별점·코멘트 피드백 제출.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Send, ShieldAlert, Star } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import { Button, Input } from '../../components/ui';
import { formatDateKo } from '../../lib/utils';
import { fetchAssignmentByMenteeToken } from '../programs/detail/mentoringUtils';
import { formatDuration, getMentorName, getMentorSpecialty } from '../../types/mentoring';
import type {
  MentoringAssignment, MentoringFeedback,
} from '../../types/mentoring';
import { usePMViewer } from '../../hooks/usePMViewer';
import PMViewerBanner from '../../components/PMViewerBanner';

export default function MentoringStudentPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const { isViewer, viewerName } = usePMViewer();
  const [assignment, setAssignment] = useState<MentoringAssignment | null>(null);
  const [feedbacks, setFeedbacks] = useState<Record<string, MentoringFeedback[]>>({});
  const [menteeName, setMenteeName] = useState('');
  const [draftRating, setDraftRating] = useState<Record<string, number>>({});
  const [draftComment, setDraftComment] = useState<Record<string, string>>({});
  const [submitting, setSubmitting] = useState<string | null>(null);
  const [loading, setLoading] = useState(true);

  const reload = useCallback(async () => {
    if (!token) return;
    const data = await fetchAssignmentByMenteeToken(token);
    setAssignment(data);
    if (data?.sessions && data.sessions.length > 0) {
      const sessionIds = data.sessions.map((s) => s.id);
      const { data: fbData, error } = await supabase
        .from('mentoring_feedbacks')
        .select('*')
        .in('session_id', sessionIds)
        .order('submitted_at', { ascending: false });
      if (error) console.error('[mentoring] 피드백 조회 실패:', error.message);
      const map: Record<string, MentoringFeedback[]> = {};
      ((fbData as MentoringFeedback[] | null) ?? []).forEach((f) => {
        if (!map[f.session_id]) map[f.session_id] = [];
        map[f.session_id].push(f);
      });
      setFeedbacks(map);
    } else {
      setFeedbacks({});
    }
    setLoading(false);
  }, [token]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await reload();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [reload]);

  async function handleSubmit(sessionId: string) {
    const rating = draftRating[sessionId];
    const comment = draftComment[sessionId];
    if (!rating) {
      toast.error('별점을 선택해 주세요.');
      return;
    }
    if (!menteeName.trim()) {
      toast.error('이름을 입력해 주세요.');
      return;
    }
    setSubmitting(sessionId);
    try {
      const { error } = await supabase.from('mentoring_feedbacks').insert({
        session_id: sessionId,
        mentee_name: menteeName.trim(),
        rating,
        comment: comment?.trim() || null,
      });
      if (error) {
        console.error('[mentoring] 피드백 저장 실패:', error.message);
        toast.error('피드백 저장에 실패했어요. 잠시 후 다시 시도해 주세요.');
        return;
      }
      toast.success('피드백을 제출했어요. 감사합니다!');
      setDraftRating((p) => ({ ...p, [sessionId]: 0 }));
      setDraftComment((p) => ({ ...p, [sessionId]: '' }));
      await reload();
    } finally {
      setSubmitting(null);
    }
  }

  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (!assignment) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-rose-100 p-8 max-w-md w-full text-center space-y-3">
          <ShieldAlert className="mx-auto text-rose-400" size={32} aria-hidden="true" />
          <p className="text-base font-bold text-[#1E1B4B]">유효하지 않은 링크예요</p>
          <p className="text-sm text-slate-500">링크를 다시 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  const mentorName = getMentorName(assignment);
  const specialty = getMentorSpecialty(assignment);
  const sessions = (assignment.sessions ?? []).filter((s) => !!s.submitted_at);

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30">
      {isViewer && <PMViewerBanner viewerName={viewerName} />}
      <div className="max-w-2xl mx-auto space-y-4 px-4 py-6 sm:py-10">
        <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <p className="text-[11px] font-bold text-slate-400 uppercase tracking-wider">멘토링</p>
          <h1 className="mt-1 text-xl font-bold text-[#1E1B4B]">{mentorName} 멘토님</h1>
          {specialty.length > 0 && (
            <div className="mt-1 flex items-center gap-1 flex-wrap">
              {specialty.map((sp) => (
                <span key={sp} className="text-[10px] font-semibold text-violet-700 bg-violet-100 px-1.5 py-0.5 rounded">{sp}</span>
              ))}
            </div>
          )}
          <p className="mt-2 text-xs text-slate-500">{assignment.meet_type ?? '-'}</p>
        </header>

        {/* 멘티 이름 입력 */}
        <section className="rounded-2xl border border-violet-100 bg-white p-4 shadow-[0_4px_16px_rgba(124,58,237,0.06)]">
          <Input
            label="이름 (피드백 제출 시 식별용)"
            value={menteeName}
            onChange={(e) => setMenteeName(e.target.value)}
            placeholder="예) 김민수"
          />
        </section>

        {/* 보고서 목록 + 피드백 */}
        {sessions.length === 0 ? (
          <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
            <p className="text-sm text-slate-500">아직 멘토가 작성한 보고서가 없어요.</p>
          </div>
        ) : (
          <ul className="flex flex-col gap-3">
            {sessions.map((s) => {
              const myFb = feedbacks[s.id]?.find((f) => f.mentee_name === menteeName.trim());
              const rating = draftRating[s.id] ?? 0;
              const comment = draftComment[s.id] ?? '';
              return (
                <li key={s.id} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-3">
                  <header>
                    <p className="text-[10px] font-bold text-slate-400 uppercase tracking-wider">
                      {formatDateKo(s.session_date)} · {formatDuration(s.duration_min)} · {s.meet_type ?? '-'}
                    </p>
                    <h2 className="mt-1 text-base font-bold text-[#1E1B4B]">{s.title}</h2>
                    {(s.team_name || s.item_name) && (
                      <p className="mt-0.5 text-xs text-slate-500">
                        {s.team_name ?? '-'} · {s.item_name ?? '-'}
                      </p>
                    )}
                  </header>
                  <p className="text-sm text-slate-700 whitespace-pre-wrap leading-relaxed bg-slate-50 rounded-xl p-3">
                    {s.content}
                  </p>
                  {s.photo_urls && s.photo_urls.length > 0 && (
                    <div className="grid grid-cols-3 gap-2">
                      {s.photo_urls.map((url, i) => (
                        <a key={i} href={url} target="_blank" rel="noreferrer" className="block aspect-square rounded-lg overflow-hidden border border-slate-200">
                          <img src={url} alt={`photo-${i}`} className="w-full h-full object-cover" />
                        </a>
                      ))}
                    </div>
                  )}

                  {/* 피드백 영역 */}
                  <div className="border-t border-slate-100 pt-3">
                    {myFb ? (
                      <div className="rounded-xl bg-emerald-50/60 border border-emerald-100 p-3 text-xs text-emerald-800">
                        ✓ 이미 피드백을 제출했어요 · 별점 {myFb.rating}점
                        {myFb.comment && <p className="mt-1 text-emerald-700">"{myFb.comment}"</p>}
                      </div>
                    ) : (
                      <div className="space-y-2">
                        <p className="text-xs font-semibold text-slate-700">피드백 남기기</p>
                        <div className="flex items-center gap-1">
                          {[1, 2, 3, 4, 5].map((n) => (
                            <button
                              key={n}
                              type="button"
                              onClick={() => setDraftRating((p) => ({ ...p, [s.id]: n }))}
                              className={`transition-colors ${rating >= n ? 'text-amber-400' : 'text-slate-300'}`}
                              aria-label={`별점 ${n}점`}
                            >
                              <Star size={20} fill={rating >= n ? 'currentColor' : 'none'} aria-hidden="true" />
                            </button>
                          ))}
                          {rating > 0 && <span className="ml-2 text-xs text-slate-500 tabular-nums">{rating}점</span>}
                        </div>
                        <textarea
                          rows={2}
                          value={comment}
                          onChange={(e) => setDraftComment((p) => ({ ...p, [s.id]: e.target.value }))}
                          placeholder="코멘트 (선택)"
                          className="w-full rounded-xl border border-slate-200 bg-white px-3 py-2 text-xs text-slate-800 outline-none placeholder:text-slate-400 focus:border-primary focus:ring-2 focus:ring-primary/20 resize-none"
                        />
                        <Button
                          variant="primary"
                          size="sm"
                          onClick={() => void handleSubmit(s.id)}
                          loading={submitting === s.id}
                          disabled={isViewer}
                          leftIcon={<Send size={12} />}
                        >
                          제출
                        </Button>
                      </div>
                    )}
                  </div>
                </li>
              );
            })}
          </ul>
        )}

        <p className="text-center text-[10px] text-slate-400">© 2026 (주)밸런스닷 · WorkFlow</p>
      </div>
    </div>
  );
}
