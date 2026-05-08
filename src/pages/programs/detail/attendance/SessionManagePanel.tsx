// bal24 v2 — 출석 세션 관리 패널 (Stage 11-②)
// 세션 생성·삭제 + QR 코드 (3 토큰) + O/△/X 매트릭스 미리보기.

import { useCallback, useEffect, useState } from 'react';
import {
  Plus, Loader2, Calendar, Clock, Users, Copy, ExternalLink, Trash2, ChevronDown, ChevronRight,
} from 'lucide-react';
import { Link } from 'react-router-dom';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import { formatDateKo } from '../../../../lib/utils';
import type {
  AttendanceCheckStatus, AttendanceSession,
} from '../../../../types/database';

interface Props {
  programId: string;
}

type SessionRow = Pick<
  AttendanceSession,
  'id' | 'title' | 'session_no' | 'session_date' | 'start_time' | 'end_time' | 'check_in_open' |
  'student_token' | 'instructor_token' | 'ta_token'
> & {
  record_count?: number;
};

const STATUS_TONE: Record<AttendanceCheckStatus, string> = {
  O: 'bg-emerald-50 text-emerald-700 border-emerald-200',
  '△': 'bg-amber-50 text-amber-700 border-amber-200',
  X: 'bg-rose-50 text-rose-600 border-rose-200',
};

function buildBase(): string {
  return typeof window !== 'undefined' ? window.location.origin : '';
}

function trimTime(t?: string | null): string {
  return t ? t.slice(0, 5) : '';
}

export default function SessionManagePanel({ programId }: Props) {
  const toast = useToast();
  const [sessions, setSessions] = useState<SessionRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [creating, setCreating] = useState(false);
  const [openId, setOpenId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    const { data, error } = await supabase
      .from('attendance_sessions')
      .select(
        'id, title, session_no, session_date, start_time, end_time, check_in_open, student_token, instructor_token, ta_token, records:attendance_records(id)',
      )
      .eq('program_id', programId)
      .order('session_date', { ascending: true });
    if (error) {
      console.error('[step-11/attendance] 세션 조회 실패:', error.message);
      toast.error('출석 세션을 불러오지 못했어요.');
      return;
    }
    type Row = SessionRow & { records: { id: string }[] };
    setSessions(((data as Row[] | null) ?? []).map((r) => ({
      id: r.id,
      title: r.title,
      session_no: r.session_no,
      session_date: r.session_date,
      start_time: r.start_time,
      end_time: r.end_time,
      check_in_open: r.check_in_open,
      student_token: r.student_token,
      instructor_token: r.instructor_token,
      ta_token: r.ta_token,
      record_count: r.records?.length ?? 0,
    })));
  }, [programId, toast]);

  useEffect(() => {
    if (!programId) return;
    let cancelled = false;
    setLoading(true);
    void (async () => {
      await refresh();
      if (cancelled) return;
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [programId, refresh]);

  async function addSession() {
    setCreating(true);
    try {
      const nextNo = sessions.reduce((m, s) => Math.max(m, s.session_no ?? 0), 0) + 1;
      const today = new Date().toISOString().slice(0, 10);
      const { error } = await supabase.from('attendance_sessions').insert({
        program_id: programId,
        title: `${nextNo}차시 출석`,
        session_no: nextNo,
        session_date: today,
        check_in_open: true,
      });
      if (error) {
        console.error('[step-11/attendance] 세션 추가 실패:', error.message);
        toast.error('세션 추가에 실패했어요.');
        return;
      }
      toast.success('세션을 추가했어요. 날짜·시간을 편집해 주세요.');
      void refresh();
    } finally {
      setCreating(false);
    }
  }

  async function toggleOpen(id: string, next: boolean) {
    const { error } = await supabase
      .from('attendance_sessions')
      .update({ check_in_open: next })
      .eq('id', id);
    if (error) {
      console.error('[step-11/attendance] 체크인 토글 실패:', error.message);
      toast.error('상태 변경에 실패했어요.');
      return;
    }
    setSessions((prev) => prev.map((s) => (s.id === id ? { ...s, check_in_open: next } : s)));
  }

  async function removeSession(id: string) {
    if (!window.confirm('이 세션과 모든 출석 기록을 삭제할까요?')) return;
    const { error } = await supabase.from('attendance_sessions').delete().eq('id', id);
    if (error) {
      console.error('[step-11/attendance] 세션 삭제 실패:', error.message);
      toast.error('세션 삭제에 실패했어요.');
      return;
    }
    toast.success('세션을 삭제했어요.');
    setSessions((prev) => prev.filter((s) => s.id !== id));
  }

  async function copyToken(token: string, role: string) {
    const url = `${buildBase()}/attend/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${role} 링크 복사 완료`);
    else toast.error('링크 복사에 실패했어요.');
  }

  if (loading) {
    return (
      <div className="flex justify-center py-10">
        <Loader2 className="animate-spin text-violet-400" size={20} aria-hidden="true" />
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-3">
      <header className="flex items-center justify-between">
        <p className="text-[11px] text-slate-500">
          세션마다 학생/강사/TA 3 토큰 자동 발급. 클릭하여 펼치면 O/△/X 매트릭스 미리보기.
        </p>
        <button
          type="button"
          onClick={() => void addSession()}
          disabled={creating}
          className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50 transition-colors"
        >
          {creating ? <Loader2 size={12} className="animate-spin" aria-hidden="true" /> : <Plus size={12} aria-hidden="true" />}
          세션 추가
        </button>
      </header>

      {sessions.length === 0 ? (
        <p className="text-sm text-slate-400 italic text-center py-6">
          등록된 출석 세션이 없어요. "세션 추가"로 시작하세요.
        </p>
      ) : (
        <ul className="flex flex-col gap-2">
          {sessions.map((s) => {
            const isOpen = openId === s.id;
            return (
              <li
                key={s.id}
                className="rounded-xl border border-violet-100 bg-white overflow-hidden"
              >
                <header className="flex items-center gap-2 px-3 py-2.5">
                  <button
                    type="button"
                    onClick={() => setOpenId(isOpen ? null : s.id)}
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-violet-600 hover:bg-violet-50"
                    aria-label={isOpen ? '접기' : '펼치기'}
                  >
                    {isOpen ? <ChevronDown size={13} aria-hidden="true" /> : <ChevronRight size={13} aria-hidden="true" />}
                  </button>
                  <span className="inline-flex items-center justify-center min-w-[2.5rem] h-6 px-2 rounded-md bg-violet-100 text-violet-700 text-[11px] font-bold tabular-nums">
                    {s.session_no ?? '?'}차시
                  </span>
                  <Link
                    to={`/attendance/${s.id}`}
                    className="flex-1 min-w-0 text-sm font-bold text-[#1E1B4B] hover:underline truncate"
                  >
                    {s.title}
                  </Link>
                  <span className="shrink-0 text-[11px] text-slate-500 tabular-nums inline-flex items-center gap-1">
                    <Calendar size={11} aria-hidden="true" />
                    {formatDateKo(s.session_date)}
                  </span>
                  {(s.start_time || s.end_time) && (
                    <span className="hidden sm:inline shrink-0 text-[11px] text-slate-500 tabular-nums">
                      <Clock size={11} className="inline mr-0.5" aria-hidden="true" />
                      {trimTime(s.start_time)}{s.end_time && `~${trimTime(s.end_time)}`}
                    </span>
                  )}
                  <span className="shrink-0 inline-flex items-center gap-1 text-[11px] text-slate-500">
                    <Users size={11} aria-hidden="true" />
                    {s.record_count ?? 0}
                  </span>
                  <label className="shrink-0 inline-flex items-center gap-1 text-[10px] cursor-pointer">
                    <input
                      type="checkbox"
                      checked={s.check_in_open}
                      onChange={(e) => void toggleOpen(s.id, e.target.checked)}
                      className="w-3.5 h-3.5 rounded border-violet-200 text-violet-600 focus:ring-violet-300"
                    />
                    {s.check_in_open ? '진행' : '마감'}
                  </label>
                  <button
                    type="button"
                    onClick={() => void removeSession(s.id)}
                    title="세션 삭제"
                    className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-400 hover:bg-rose-50 hover:text-rose-500"
                  >
                    <Trash2 size={12} aria-hidden="true" />
                  </button>
                </header>

                {isOpen && (
                  <div className="px-3 pb-3 border-t border-violet-100/70 bg-violet-50/20 flex flex-col gap-2 pt-2.5">
                    {/* 3 토큰 링크 */}
                    {(['student', 'instructor', 'ta'] as const).map((role) => {
                      const token = role === 'student' ? s.student_token : role === 'instructor' ? s.instructor_token : s.ta_token;
                      const label = role === 'student' ? '교육생' : role === 'instructor' ? '강사' : 'TA';
                      const url = `${buildBase()}/attend/${token}`;
                      return (
                        <div key={role} className="flex items-center gap-2 rounded-md border border-violet-100 bg-white px-2 py-1.5">
                          <span className="shrink-0 inline-flex items-center px-1.5 py-0.5 rounded text-[10px] font-bold bg-violet-100 text-violet-700">
                            {label}
                          </span>
                          <span className="flex-1 min-w-0 truncate text-[11px] text-slate-600 tabular-nums">{url}</span>
                          <button
                            type="button"
                            onClick={() => void copyToken(token, label)}
                            title="링크 복사"
                            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                          >
                            <Copy size={12} aria-hidden="true" />
                          </button>
                          <a
                            href={url}
                            target="_blank"
                            rel="noreferrer"
                            title="새 탭"
                            className="shrink-0 inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                          >
                            <ExternalLink size={12} aria-hidden="true" />
                          </a>
                        </div>
                      );
                    })}

                    {/* 매트릭스 미리보기 */}
                    <SessionMatrix sessionId={s.id} />
                  </div>
                )}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}

function SessionMatrix({ sessionId }: { sessionId: string }) {
  const toast = useToast();
  const [rows, setRows] = useState<Array<{
    id: string; name: string; role: string; status: AttendanceCheckStatus;
  }>>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const { data, error } = await supabase
        .from('attendance_records')
        .select('id, attendee_name, attendee_role, status')
        .eq('session_id', sessionId)
        .order('attendee_role', { ascending: true })
        .order('attendee_name', { ascending: true });
      if (cancelled) return;
      if (error) {
        console.error('[step-11/attendance] 매트릭스 조회 실패:', error.message);
        toast.error('출석 기록을 불러오지 못했어요.');
        setLoading(false);
        return;
      }
      type Row = { id: string; attendee_name: string; attendee_role: string; status: AttendanceCheckStatus };
      setRows(((data as Row[] | null) ?? []).map((r) => ({
        id: r.id,
        name: r.attendee_name,
        role: r.attendee_role,
        status: r.status,
      })));
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [sessionId, toast]);

  if (loading) {
    return (
      <div className="flex justify-center py-2">
        <Loader2 className="animate-spin text-violet-400" size={14} aria-hidden="true" />
      </div>
    );
  }

  if (rows.length === 0) {
    return <p className="text-[11px] text-slate-400 italic text-center py-1">아직 체크인 기록이 없어요.</p>;
  }

  return (
    <div className="flex flex-wrap gap-1.5 pt-1">
      {rows.map((r) => (
        <span
          key={r.id}
          className={`inline-flex items-center gap-1 px-2 py-1 rounded-md border text-[11px] ${STATUS_TONE[r.status]}`}
        >
          <span className="font-bold">{r.status}</span>
          <span>{r.name}</span>
          <span className="opacity-60 text-[9px]">({r.role === 'student' ? '학' : r.role === 'instructor' ? '강' : 'T'})</span>
        </span>
      ))}
    </div>
  );
}
