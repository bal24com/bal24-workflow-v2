// bal24 v2 — 강사 초대 수락 페이지 (인증 불필요)
// /invitation/:token

import { useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2, Calendar, MapPin, User } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { formatRole } from './invitationUtils';
import { formatDateKo } from '../../lib/utils';
import InstructorProfileForm from './InstructorProfileForm';
import type { InstructorInvitation } from '../../types/database';

type ScreenState = 'loading' | 'notfound' | 'expired' | 'ready' | 'profile' | 'reject' | 'done_accept' | 'done_reject';

type ProgramInfo = { id: string; name: string; start_date?: string | null; end_date?: string | null; venue?: string | null };

export default function InstructorInvitePage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [inv, setInv] = useState<InstructorInvitation | null>(null);
  const [program, setProgram] = useState<ProgramInfo | null>(null);
  const [rejectReason, setRejectReason] = useState('');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setScreen('notfound'); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('instructor_invitations').select('*')
          .eq('portal_token', token).maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('[invite] 조회 실패:', error.message);
          setScreen('notfound');
          return;
        }
        if (!data) { setScreen('notfound'); return; }
        const i = data as InstructorInvitation;
        setInv(i);

        // program info 조회
        if (i.program_id) {
          const { data: p } = await supabase.from('programs')
            .select('id, name, start_date, end_date, venue').eq('id', i.program_id).maybeSingle();
          if (!cancelled && p) setProgram(p as ProgramInfo);
        }

        // 이미 프로필 제출됐는지 확인 → 단계 분기
        const { data: prof } = await supabase
          .from('instructor_profiles').select('submitted').eq('invitation_id', i.id).maybeSingle();
        if (cancelled) return;
        if (prof?.submitted)        setScreen('done_accept');
        // STEP-INVITE-APPROVE-PART1 — '제출' = 강사 응답 후 프로필 입력 단계
        // 과거 데이터 호환을 위해 '수락'도 동일 처리 (담당자 승인 후엔 어차피 prof.submitted=true)
        else if (i.status === '제출' || i.status === '수락') setScreen('profile');
        else if (i.status === '거절') setScreen('done_reject');
        else                          setScreen('ready');
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[invite] 처리 중 오류:', raw);
        setScreen('notfound');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleAccept = async () => {
    if (!inv) return;
    setSubmitting(true);
    setErrorMsg(null);
    try {
      // STEP-INVITE-APPROVE-PART1 — '제출' = 강사가 정보 제출 완료, 담당자 승인 대기
      // '수락'은 담당자가 [승인] 버튼 클릭 시에만 설정됨 (PART2)
      const { error } = await supabase
        .from('instructor_invitations')
        .update({ status: '제출', responded_at: new Date().toISOString() })
        .eq('id', inv.id);
      if (error) throw error;
      setScreen('profile');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invite] 제출 처리 실패:', raw);
      setErrorMsg('제출 처리 중 오류가 발생했어요.');
    } finally {
      setSubmitting(false);
    }
  };

  const handleSubmitReject = async () => {
    if (!inv) return;
    if (!rejectReason.trim()) { setErrorMsg('거절 사유를 입력해 주세요.'); return; }
    setSubmitting(true);
    setErrorMsg(null);
    try {
      const { error } = await supabase
        .from('instructor_invitations')
        .update({
          status: '거절',
          responded_at: new Date().toISOString(),
          rejected_reason: rejectReason.trim(),
        })
        .eq('id', inv.id);
      if (error) throw error;
      setScreen('done_reject');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[invite] 거절 처리 실패:', raw);
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

        {screen === 'notfound' && <CenterCard emoji="🔍" title="유효하지 않은 링크예요" desc="링크를 다시 확인해 주세요." />}
        {screen === 'expired' && <CenterCard emoji="⏱️" title="이미 응답 완료된 초대예요" desc="" />}

        {screen === 'done_accept' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8 text-center space-y-3">
            <CheckCircle2 size={48} className="mx-auto text-success" />
            <h1 className="text-xl font-bold text-text">정보를 제출했습니다.</h1>
            <p className="text-sm text-muted">담당자 검토 후 확정 안내드립니다.</p>
          </div>
        )}

        {screen === 'done_reject' && (
          <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-8 text-center space-y-3">
            <div className="text-3xl">📝</div>
            <h1 className="text-xl font-bold text-text">거절 처리되었습니다.</h1>
            <p className="text-sm text-muted">알려주셔서 감사합니다.</p>
          </div>
        )}

        {(screen === 'ready' || screen === 'profile' || screen === 'reject') && inv && (
          <>
            <header className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 space-y-3">
              <div className="text-xs font-semibold text-primary">초대장</div>
              <h1 className="text-xl font-bold text-text">{program?.name ?? '프로그램'}</h1>
              <div className="space-y-1.5 text-xs text-muted">
                <div className="flex items-center gap-1.5">
                  <User size={12} className="text-slate-400" />
                  <span><span className="text-slate-700 font-semibold">{inv.name}</span> 님 · {formatRole(inv.role)}</span>
                </div>
                {(program?.start_date || program?.end_date) && (
                  <div className="flex items-center gap-1.5">
                    <Calendar size={12} className="text-slate-400" />
                    {formatDateKo(program?.start_date)} ~ {formatDateKo(program?.end_date)}
                  </div>
                )}
                {program?.venue && (
                  <div className="flex items-center gap-1.5">
                    <MapPin size={12} className="text-slate-400" />
                    {program.venue}
                  </div>
                )}
              </div>
              {inv.notes && (
                <div className="bg-slate-50 rounded-lg p-3 text-sm text-text whitespace-pre-wrap">{inv.notes}</div>
              )}
            </header>

            {screen === 'ready' && (
              <div className="space-y-3">
                {errorMsg && (<div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>)}
                <button type="button" onClick={() => void handleAccept()} disabled={submitting}
                  className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:opacity-95 disabled:opacity-60 transition">
                  {submitting ? '처리 중…' : '수락하기'}
                </button>
                <button type="button" onClick={() => setScreen('reject')} disabled={submitting}
                  className="w-full rounded-xl py-3 text-sm font-bold text-text bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60 transition">
                  거절하기
                </button>
              </div>
            )}

            {screen === 'profile' && (
              <InstructorProfileForm invitation={inv} onSubmitted={() => setScreen('done_accept')} />
            )}

            {screen === 'reject' && (
              <div className="bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 space-y-3">
                <h2 className="text-sm font-bold text-text">거절 사유를 알려 주세요</h2>
                <textarea rows={4} value={rejectReason} onChange={(e) => setRejectReason(e.target.value)}
                  disabled={submitting}
                  placeholder="일정 충돌, 컨디션, 거리 등 자유롭게 적어 주세요."
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20 disabled:opacity-60 resize-none" />
                {errorMsg && (<div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>)}
                <div className="flex items-center gap-2">
                  <button type="button" onClick={() => setScreen('ready')} disabled={submitting}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-text bg-white border border-slate-200 hover:bg-slate-50 disabled:opacity-60">
                    이전
                  </button>
                  <button type="button" onClick={() => void handleSubmitReject()} disabled={submitting}
                    className="flex-1 rounded-xl py-2.5 text-sm font-bold text-white bg-danger hover:opacity-90 disabled:opacity-60">
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
