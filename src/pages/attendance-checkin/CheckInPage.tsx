// bal24 v2 — 외부 출석 체크인 (인증 불필요)
// /checkin/:token

import { useEffect, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import { CheckCircle2, Loader2 } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { AttendanceSession, AttendeeRole } from '../../types/database';
import { ROLE_LABELS, isSessionExpired, formatTime } from '../attendance/attendanceUtils';

type ScreenState = 'loading' | 'closed' | 'expired' | 'notfound' | 'form' | 'success';

export default function CheckInPage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<ScreenState>('loading');
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [role, setRole] = useState<AttendeeRole>('student');
  const [submitting, setSubmitting] = useState(false);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  useEffect(() => {
    if (!token) { setScreen('notfound'); return; }
    let cancelled = false;
    (async () => {
      try {
        const { data, error } = await supabase
          .from('attendance_sessions')
          .select('*')
          .eq('session_token', token)
          .maybeSingle();
        if (cancelled) return;
        if (error) {
          console.error('[checkin] 세션 조회 실패:', error.message);
          setScreen('notfound');
          return;
        }
        if (!data) { setScreen('notfound'); return; }
        const s = data as AttendanceSession;
        setSession(s);
        if (!s.check_in_open) { setScreen('closed'); return; }
        if (isSessionExpired(s.token_expires_at)) { setScreen('expired'); return; }
        setScreen('form');
      } catch (err) {
        if (cancelled) return;
        const raw = err instanceof Error ? err.message : '';
        console.error('[checkin] 처리 중 오류:', raw);
        setScreen('notfound');
      }
    })();
    return () => { cancelled = true; };
  }, [token]);

  const handleSubmit = async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    setErrorMsg(null);
    if (!session) return;
    if (!name.trim()) { setErrorMsg('이름을 입력해 주세요.'); return; }
    if (!phone.trim()) { setErrorMsg('전화번호를 입력해 주세요.'); return; }

    setSubmitting(true);
    try {
      const { error } = await supabase.from('attendance_records').insert({
        session_id: session.id,
        attendee_role: role,
        attendee_name: name.trim(),
        attendee_phone: phone.trim(),
        check_in_method: 'link',
      });
      if (error) {
        const m = error.message.toLowerCase();
        if (m.includes('duplicate') || m.includes('unique')) {
          setErrorMsg('이미 출석 처리되었습니다.');
        } else if (m.includes('row-level security')) {
          setErrorMsg('출석 등록이 일시적으로 중단되었어요. 운영자에게 문의해 주세요.');
        } else {
          setErrorMsg('출석 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
        }
        return;
      }
      setScreen('success');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[checkin] 출석 등록 실패:', raw);
      setErrorMsg('출석 처리 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
    } finally {
      setSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen bg-bg flex items-start sm:items-center justify-center p-4 sm:p-6">
      <div className="w-full max-w-md bg-white rounded-card border border-[#EDE9FE] shadow-card p-6 sm:p-8 space-y-5">
        {screen === 'loading' && (
          <div className="flex flex-col items-center justify-center py-12 gap-2">
            <Loader2 size={28} className="animate-spin text-primary" />
            <p className="text-sm text-muted">불러오는 중…</p>
          </div>
        )}

        {screen === 'notfound' && (
          <div className="text-center space-y-2 py-6">
            <div className="text-3xl">🔍</div>
            <h1 className="text-xl font-bold text-text">유효하지 않은 링크예요</h1>
            <p className="text-sm text-muted">링크를 다시 확인해 주세요.</p>
          </div>
        )}

        {screen === 'closed' && (
          <div className="text-center space-y-2 py-6">
            <div className="text-3xl">🚪</div>
            <h1 className="text-xl font-bold text-text">출석 체크인이 종료되었습니다</h1>
            <p className="text-sm text-muted">{session?.title}</p>
          </div>
        )}

        {screen === 'expired' && (
          <div className="text-center space-y-2 py-6">
            <div className="text-3xl">⏱️</div>
            <h1 className="text-xl font-bold text-text">만료된 링크입니다</h1>
            <p className="text-sm text-muted">운영자에게 새 링크를 요청해 주세요.</p>
          </div>
        )}

        {screen === 'success' && (
          <div className="text-center space-y-3 py-6">
            <CheckCircle2 size={48} className="mx-auto text-success" />
            <h1 className="text-xl font-bold text-text">출석 완료!</h1>
            <p className="text-sm text-muted">오늘도 수고하셨습니다.</p>
            {session && (
              <div className="text-xs text-muted bg-slate-50 rounded-lg px-3 py-2 inline-block">
                {session.title}
              </div>
            )}
          </div>
        )}

        {screen === 'form' && session && (
          <>
            <header className="space-y-1.5 border-b border-slate-100 pb-4">
              <h1 className="text-lg font-bold text-text">{session.title}</h1>
              <div className="text-xs text-muted">
                {new Date(session.session_date).toLocaleDateString('ko-KR')}
                {(session.start_time || session.end_time) && (
                  <> · {formatTime(session.start_time)}{session.end_time ? `~${formatTime(session.end_time)}` : ''}</>
                )}
                {session.location && <> · {session.location}</>}
              </div>
            </header>

            <form onSubmit={handleSubmit} className="space-y-4" noValidate>
              <div className="space-y-1.5">
                <label className="text-sm font-semibold text-slate-700">역할</label>
                <div className="grid grid-cols-3 gap-2">
                  {(['student', 'instructor', 'ta'] as AttendeeRole[]).map((r) => (
                    <label key={r} className={[
                      'flex items-center justify-center gap-1.5 rounded-xl border px-3 py-2.5 text-sm font-semibold cursor-pointer transition-colors',
                      role === r ? 'border-primary bg-primary/10 text-primary' : 'border-slate-200 bg-white text-slate-600',
                    ].join(' ')}>
                      <input
                        type="radio"
                        name="role"
                        value={r}
                        checked={role === r}
                        onChange={() => setRole(r)}
                        className="sr-only"
                      />
                      {ROLE_LABELS[r]}
                    </label>
                  ))}
                </div>
              </div>

              <div className="space-y-1.5">
                <label htmlFor="checkin-name" className="text-sm font-semibold text-slate-700">이름 <span className="text-danger">*</span></label>
                <input
                  id="checkin-name"
                  type="text"
                  required
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  disabled={submitting}
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              <div className="space-y-1.5">
                <label htmlFor="checkin-phone" className="text-sm font-semibold text-slate-700">전화번호 <span className="text-danger">*</span></label>
                <input
                  id="checkin-phone"
                  type="tel"
                  required
                  value={phone}
                  onChange={(e) => setPhone(e.target.value)}
                  disabled={submitting}
                  placeholder="010-0000-0000"
                  className="w-full rounded-xl border border-slate-200 bg-white px-4 py-2.5 text-sm outline-none focus:border-primary focus:ring-2 focus:ring-primary/20"
                />
              </div>

              {errorMsg && (
                <div role="alert" className="rounded-xl bg-danger/10 border border-danger/20 px-4 py-2.5 text-sm text-danger">{errorMsg}</div>
              )}

              <button
                type="submit"
                disabled={submitting}
                className="w-full rounded-xl py-3 text-sm font-bold text-white shadow-lg shadow-primary/20 bg-gradient-to-r from-[#7C3AED] to-[#EC4899] hover:opacity-95 disabled:opacity-60 transition"
              >
                {submitting ? '처리 중…' : '출석 체크인'}
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
