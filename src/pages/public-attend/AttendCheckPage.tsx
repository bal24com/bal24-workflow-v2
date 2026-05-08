// bal24 v2 — 출석 체크인 외부 페이지 (/attend/:token)
// 인증 불필요 — 모바일 우선
// 토큰으로 역할 자동 판별 (learner / instructor / ta) + O/▲/X 체크인

import { useCallback, useEffect, useMemo, useState } from 'react';
import type { FormEvent } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, CheckCircle2, Calendar, MapPin, Clock, Check, AlertTriangle, X,
} from 'lucide-react';
import { Button, Input } from '../../components/ui';
import { supabase } from '../../lib/supabase';
import { formatDateKo } from '../../lib/utils';
import { useToast } from '../../contexts/ToastContext';
import type {
  AttendanceCheckStatus, AttendanceSession, AttendeeRole,
} from '../../types/database';

type CheckStatus = 'present' | 'late' | 'absent';

const CHECK_STATUS_TO_DB: Record<CheckStatus, AttendanceCheckStatus> = {
  present: 'O',
  late: '△',
  absent: 'X',
};

const ROLE_LABEL: Record<AttendeeRole, string> = {
  student: '교육생',
  instructor: '강사',
  ta: 'TA',
};

const STATUS_OPTIONS: Array<{ value: CheckStatus; label: string; icon: typeof Check; color: string }> = [
  { value: 'present', label: '출석', icon: Check, color: 'emerald' },
  { value: 'late', label: '지각', icon: AlertTriangle, color: 'amber' },
  { value: 'absent', label: '결석', icon: X, color: 'rose' },
];

const STATUS_BUTTON_STYLE: Record<CheckStatus, { active: string; inactive: string }> = {
  present: {
    active: 'bg-emerald-500 text-white border-emerald-500 shadow-md',
    inactive: 'bg-white text-emerald-600 border-emerald-200 hover:bg-emerald-50',
  },
  late: {
    active: 'bg-amber-500 text-white border-amber-500 shadow-md',
    inactive: 'bg-white text-amber-600 border-amber-200 hover:bg-amber-50',
  },
  absent: {
    active: 'bg-rose-500 text-white border-rose-500 shadow-md',
    inactive: 'bg-white text-rose-600 border-rose-200 hover:bg-rose-50',
  },
};

interface ProgramRef {
  id: string;
  name: string;
}

export default function AttendCheckPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [session, setSession] = useState<AttendanceSession | null>(null);
  const [program, setProgram] = useState<ProgramRef | null>(null);
  const [role, setRole] = useState<AttendeeRole | null>(null);
  const [loading, setLoading] = useState(true);
  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');
  const [status, setStatus] = useState<CheckStatus>('present');
  const [submitting, setSubmitting] = useState(false);
  const [submitted, setSubmitted] = useState(false);

  useEffect(() => {
    if (!token) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      // 3 토큰 중 일치하는 컬럼으로 역할 판별 (student/instructor/ta)
      const { data, error } = await supabase
        .from('attendance_sessions')
        .select('*, program:programs(id, name)')
        .or(
          `student_token.eq.${token},instructor_token.eq.${token},ta_token.eq.${token}`,
        )
        .maybeSingle();

      if (cancelled) return;
      if (error) {
        console.error('[attend] 세션 조회 실패:', error.message);
        setLoading(false);
        return;
      }
      if (!data) {
        setLoading(false);
        return;
      }

      const sess = data as AttendanceSession & {
        program: ProgramRef | ProgramRef[] | null;
      };
      setSession(sess);
      const prog = Array.isArray(sess.program) ? sess.program[0] : sess.program;
      setProgram(prog ?? null);

      // 역할 판별 — instructor·ta가 아니면 학생
      let detectedRole: AttendeeRole = 'student';
      if (sess.instructor_token === token) detectedRole = 'instructor';
      else if (sess.ta_token === token) detectedRole = 'ta';
      else detectedRole = 'student';
      setRole(detectedRole);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  const closed = useMemo(() => {
    if (!session) return false;
    if (!session.check_in_open) return true;
    if (session.token_expires_at && new Date(session.token_expires_at) < new Date()) return true;
    return false;
  }, [session]);

  const handleSubmit = useCallback(async (e: FormEvent<HTMLFormElement>) => {
    e.preventDefault();
    if (!session || !role) return;
    if (!name.trim()) {
      toast.error('이름을 입력해 주세요.');
      return;
    }
    if (!phone.trim()) {
      toast.error('연락처를 입력해 주세요.');
      return;
    }

    setSubmitting(true);
    try {
      const payload = {
        session_id: session.id,
        attendee_role: role,
        attendee_name: name.trim(),
        attendee_phone: phone.trim(),
        check_in_method: 'link' as const,
        status: CHECK_STATUS_TO_DB[status],
        note: null,
      };
      const { error } = await supabase.from('attendance_records').insert(payload);
      if (error) throw error;
      toast.success(`${STATUS_OPTIONS.find((o) => o.value === status)?.label} 처리되었어요.`);
      setSubmitted(true);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[attend] 체크인 실패:', raw);
      const m = raw.toLowerCase();
      if (m.includes('duplicate') || m.includes('unique')) {
        toast.error('이미 같은 연락처로 체크인하신 기록이 있어요.');
      } else {
        toast.error('체크인 중 오류가 발생했어요. 잠시 후 다시 시도해 주세요.');
      }
    } finally {
      setSubmitting(false);
    }
  }, [session, role, name, phone, status, toast]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 className="animate-spin text-violet-400" size={28} aria-hidden="true" />
      </div>
    );
  }

  if (!session || !role) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-rose-100 bg-white p-8 text-center max-w-md">
          <p className="text-lg font-bold text-[#1E1B4B] mb-2">유효하지 않은 링크예요</p>
          <p className="text-sm text-slate-500">링크를 다시 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  if (submitted) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-emerald-100 bg-white p-8 text-center max-w-md w-full">
          <CheckCircle2 className="mx-auto text-emerald-500 mb-3" size={56} aria-hidden="true" />
          <h1 className="text-xl font-bold text-[#1E1B4B] mb-2">체크인 완료!</h1>
          <p className="text-sm text-slate-500">
            <span className="font-semibold text-violet-700">{session.title}</span> · {ROLE_LABEL[role]}
          </p>
        </div>
      </div>
    );
  }

  if (closed) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50 p-4">
        <div className="rounded-2xl border border-amber-200 bg-white p-8 text-center max-w-md">
          <p className="text-lg font-bold text-[#1E1B4B] mb-2">체크인이 마감되었어요</p>
          <p className="text-sm text-slate-500">담당자에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 flex flex-col">
      <header className="bg-gradient-to-br from-violet-600 to-violet-500 text-white">
        <div className="max-w-md mx-auto px-5 py-8">
          <div className="inline-flex items-center gap-1.5 rounded-full bg-white/20 px-3 py-1 text-xs font-semibold mb-3">
            출석 체크인 — {ROLE_LABEL[role]}
          </div>
          <h1 className="text-xl font-bold mb-2">{session.title}</h1>
          {program && <p className="text-sm opacity-90 mb-3">{program.name}</p>}
          <div className="flex flex-col gap-1 text-xs opacity-95">
            <span className="inline-flex items-center gap-1.5">
              <Calendar size={12} aria-hidden="true" />
              {formatDateKo(session.session_date)}
            </span>
            {(session.start_time || session.end_time) && (
              <span className="inline-flex items-center gap-1.5">
                <Clock size={12} aria-hidden="true" />
                {session.start_time ?? ''} {session.end_time ? `~ ${session.end_time}` : ''}
              </span>
            )}
            {session.location && (
              <span className="inline-flex items-center gap-1.5">
                <MapPin size={12} aria-hidden="true" />
                {session.location}
              </span>
            )}
          </div>
        </div>
      </header>

      <main className="flex-1 max-w-md mx-auto w-full px-5 py-6">
        <form onSubmit={handleSubmit} className="rounded-2xl border border-violet-100 bg-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.06)] space-y-4" noValidate>
          <Input label="이름" required value={name} onChange={(e) => setName(e.target.value)} disabled={submitting} placeholder="홍길동" />
          <Input type="tel" label="연락처" required value={phone} onChange={(e) => setPhone(e.target.value)} disabled={submitting} placeholder="010-0000-0000" />

          <div className="space-y-2">
            <label className="text-sm font-semibold text-slate-700">출석 상태</label>
            <div className="grid grid-cols-3 gap-2">
              {STATUS_OPTIONS.map((opt) => {
                const Icon = opt.icon;
                const active = status === opt.value;
                const tone = STATUS_BUTTON_STYLE[opt.value];
                return (
                  <button
                    key={opt.value}
                    type="button"
                    onClick={() => setStatus(opt.value)}
                    disabled={submitting}
                    className={`flex flex-col items-center gap-1 rounded-xl border-2 px-3 py-3 text-sm font-bold transition ${
                      active ? tone.active : tone.inactive
                    }`}
                  >
                    <Icon size={20} aria-hidden="true" />
                    {opt.label}
                  </button>
                );
              })}
            </div>
          </div>

          <Button type="submit" variant="primary" loading={submitting} className="!w-full !py-3 text-base font-semibold">
            체크인 제출
          </Button>
        </form>

        <p className="mt-6 text-center text-xs text-slate-400">© 2026 BalanceDot WorkFlow</p>
      </main>
    </div>
  );
}
