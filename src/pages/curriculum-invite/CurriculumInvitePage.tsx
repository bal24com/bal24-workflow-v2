// bal24 v2 — 커리큘럼 인력 외부 응답 페이지 (인증 불필요)
// /curriculum-invite/:token — InstructorInvitePage 패턴 차용 + curriculum_staff 어댑터

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Calendar, MapPin, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { STAFF_STATUS_LABEL } from '../../lib/curriculumStaff';
import {
  fetchCurriculumInvite,
  getInviteeName,
  buildSessionLabel,
  buildScheduleLabel,
  type CurriculumInviteData,
} from './curriculumInviteUtils';

type ScreenState = 'loading' | 'notfound' | 'ready' | 'reject' | 'done_accept' | 'done_reject';

export default function CurriculumInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [invite, setInvite] = useState<CurriculumInviteData | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) {
      setScreen('notfound');
      return;
    }
    let cancelled = false;
    void (async () => {
      const data = await fetchCurriculumInvite(token);
      if (cancelled) return;
      if (!data) {
        setScreen('notfound');
        return;
      }
      setInvite(data);
      if (data.responded_at) {
        setScreen(data.status === 'accepted' ? 'done_accept' : 'done_reject');
      } else {
        setScreen('ready');
      }
    })();
    return () => {
      cancelled = true;
    };
  }, [token]);

  const handleAccept = async () => {
    if (!invite) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('curriculum_staff')
        .update({
          status: 'accepted',
          responded_at: new Date().toISOString(),
        })
        .eq('id', invite.id);
      if (error) throw error;
      setScreen('done_accept');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[curriculum-invite] 수락 처리 실패:', raw);
      setErrorMsg('수락 처리 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReject = async () => {
    if (!invite) return;
    if (!rejectReason.trim()) {
      setErrorMsg('거절 사유를 입력해 주세요.');
      return;
    }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('curriculum_staff')
        .update({
          status: 'rejected',
          responded_at: new Date().toISOString(),
          note: rejectReason.trim(),
        })
        .eq('id', invite.id);
      if (error) throw error;
      setScreen('done_reject');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[curriculum-invite] 거절 처리 실패:', raw);
      setErrorMsg('거절 처리 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-start justify-center p-4 sm:p-8">
      <div className="w-full max-w-lg space-y-4">
        {screen === 'loading' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8">
            <div className="flex flex-col items-center justify-center py-8 gap-2">
              <Loader2 size={28} className="animate-spin text-primary" />
              <p className="text-sm text-muted">불러오는 중…</p>
            </div>
          </div>
        )}

        {screen === 'notfound' && (
          <CenterCard emoji="🔍" title="유효하지 않은 링크예요" desc="링크를 다시 확인해 주세요." />
        )}

        {screen === 'done_accept' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8 text-center space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-success" />
            <h1 className="text-xl font-bold text-text">참여를 수락하셨어요.</h1>
            <p className="text-sm text-muted">함께해 주셔서 감사합니다!</p>
          </div>
        )}

        {screen === 'done_reject' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8 text-center space-y-3">
            <div className="text-3xl">📝</div>
            <h1 className="text-xl font-bold text-text">거절이 처리되었어요.</h1>
            <p className="text-sm text-muted">알려주셔서 감사합니다.</p>
          </div>
        )}

        {(screen === 'ready' || screen === 'reject') && invite && (
          <>
            <header className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 space-y-3">
              <div className="text-xs font-semibold text-primary">차시 참여 요청</div>
              <h1 className="text-xl font-bold text-text">
                {invite.curriculum?.program?.name ?? '프로그램'}
              </h1>
              <p className="text-sm text-slate-700 font-semibold">
                {buildSessionLabel(invite.curriculum)}
              </p>
              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-slate-400" />
                  <span>
                    <span className="text-slate-700 font-semibold">{getInviteeName(invite)}</span>
                    {' '}님 · 역할 <span className="text-slate-700 font-semibold">{invite.role}</span>
                    {invite.fee != null && (
                      <span className="ml-2">· 강사료 <span className="text-slate-700 font-semibold">{invite.fee.toLocaleString()}원</span></span>
                    )}
                  </span>
                </div>
                {invite.curriculum?.session_date && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    {formatDateKo(invite.curriculum.session_date)}
                    {buildScheduleLabel(invite.curriculum) && (
                      <span className="text-slate-400">
                        {' · '}
                        {buildScheduleLabel(invite.curriculum).split(' · ').slice(1).join(' · ')}
                      </span>
                    )}
                  </div>
                )}
                {(invite.curriculum?.venue || invite.curriculum?.program?.venue) && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-slate-400" />
                    {invite.curriculum?.venue ?? invite.curriculum?.program?.venue}
                  </div>
                )}
              </div>
              {invite.note && invite.status === 'pending' && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-text whitespace-pre-wrap">
                  {invite.note}
                </div>
              )}
            </header>

            {screen === 'ready' && (
              <div className="space-y-3">
                {errorMsg && (
                  <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
                    {errorMsg}
                  </div>
                )}
                <button
                  type="button"
                  onClick={() => void handleAccept()}
                  disabled={submitting}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:opacity-95 disabled:opacity-60 transition"
                >
                  {submitting ? '처리 중…' : `${STAFF_STATUS_LABEL.accepted}하기`}
                </button>
                <button
                  type="button"
                  onClick={() => setScreen('reject')}
                  disabled={submitting}
                  className="w-full rounded-xl py-3 text-sm font-bold text-text bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition"
                >
                  {STAFF_STATUS_LABEL.rejected}하기
                </button>
              </div>
            )}

            {screen === 'reject' && (
              <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 space-y-3">
                <h2 className="text-sm font-bold text-text">거절 사유를 알려 주세요</h2>
                <textarea
                  rows={4}
                  value={rejectReason}
                  onChange={(e) => setRejectReason(e.target.value)}
                  disabled={submitting}
                  placeholder="일정 충돌, 컨디션, 거리 등 자유롭게 적어 주세요."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none"
                />
                {errorMsg && (
                  <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">
                    {errorMsg}
                  </div>
                )}
                <div className="flex items-center gap-2">
                  <button
                    type="button"
                    onClick={() => setScreen('ready')}
                    disabled={submitting}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-text bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60"
                  >
                    이전
                  </button>
                  <button
                    type="button"
                    onClick={() => void handleSubmitReject()}
                    disabled={submitting}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white bg-danger hover:opacity-90 disabled:opacity-60"
                  >
                    거절 확인
                  </button>
                </div>
              </div>
            )}

            <p className="text-center text-xs text-muted py-2">
              © 2026 (주)밸런스닷 · WorkFlow
            </p>
          </>
        )}
      </div>
    </div>
  );
}

function CenterCard({ emoji, title, desc }: { emoji: string; title: string; desc: string }) {
  return (
    <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8 text-center space-y-2">
      <div className="text-3xl">{emoji}</div>
      <h1 className="text-xl font-bold text-text">{title}</h1>
      {desc && <p className="text-sm text-muted">{desc}</p>}
    </div>
  );
}
