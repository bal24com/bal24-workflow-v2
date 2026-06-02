// 박경수님 2026-06-02 CLUB-4 — 동아리(팀) 외부 페이지.
// /share/club/:token — 동아리 토큰 진입 → 기본정보 확인 + 활동 등록·열람 (activity_logs 재사용).
// 무인증. 팀 본인이 활동을 누적 등록.

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import {
  Loader2, ShieldAlert, Users, Plus, CalendarDays, CheckCircle2,
} from 'lucide-react';
import { supabase } from '../../lib/supabase';
import type { ProgramClub, ActivityLog } from '../../types/database';

type Screen = 'loading' | 'notfound' | 'ready';

export default function ClubSharePage() {
  const { token } = useParams<{ token: string }>();
  const [screen, setScreen] = useState<Screen>('loading');
  const [club, setClub] = useState<ProgramClub | null>(null);
  const [programName, setProgramName] = useState('');
  const [logs, setLogs] = useState<ActivityLog[]>([]);

  const loadLogs = useCallback(async (clubId: string) => {
    const { data, error } = await supabase
      .from('activity_logs')
      .select('*')
      .eq('club_id', clubId)
      .is('deleted_at', null)
      .order('activity_date', { ascending: false });
    if (error) { console.error('[ClubSharePage] 활동 조회:', error.message); return; }
    setLogs((data ?? []) as ActivityLog[]);
  }, []);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      if (!token) { setScreen('notfound'); return; }
      const { data, error } = await supabase
        .from('program_clubs')
        .select('*, programs(name)')
        .eq('club_token', token)
        .maybeSingle();
      if (cancelled) return;
      if (error || !data) {
        if (error) console.warn('[ClubSharePage] 조회 실패:', error.message);
        setScreen('notfound'); return;
      }
      type Joined = ProgramClub & { programs: { name: string } | { name: string }[] | null };
      const j = data as Joined;
      const prog = Array.isArray(j.programs) ? j.programs[0] : j.programs;
      setClub(j);
      setProgramName(prog?.name ?? '');
      await loadLogs(j.id);
      setScreen('ready');
    })();
    return () => { cancelled = true; };
  }, [token, loadLogs]);

  if (screen === 'loading') {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-violet-50/40 to-orange-50/30">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }
  if (screen === 'notfound' || !club) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-gradient-to-b from-violet-50/40 to-orange-50/30 p-4">
        <div className="w-full max-w-md bg-white rounded-2xl border border-rose-100 shadow-card p-8 text-center space-y-2">
          <ShieldAlert size={32} className="mx-auto text-rose-400" aria-hidden="true" />
          <h1 className="text-base font-bold text-[#1E1B4B]">접근할 수 없는 링크예요</h1>
          <p className="text-sm text-slate-500">링크를 다시 확인하거나 담당자에게 문의해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30 px-4 py-6 sm:py-10">
      <div className="w-full max-w-md sm:max-w-2xl mx-auto flex flex-col gap-4">
        {/* 헤더 */}
        <header className="rounded-2xl border border-violet-100 bg-white p-5 shadow-card space-y-2">
          <div className="flex items-center gap-2 flex-wrap">
            <span className="inline-flex items-center gap-1 text-[11px] font-bold px-2 py-0.5 rounded-md bg-violet-100 text-violet-700">
              <Users size={11} aria-hidden="true" /> 동아리 활동
            </span>
            {club.club_type && (
              <span className="text-[11px] font-bold px-2 py-0.5 rounded-md bg-cyan-100 text-cyan-700">{club.club_type}</span>
            )}
          </div>
          <h1 className="text-lg sm:text-xl font-bold text-[#1E1B4B]">{club.club_name}</h1>
          <p className="text-xs text-slate-500">
            {club.school_name}{programName ? ` · ${programName}` : ''}
          </p>
          <div className="text-[11px] text-slate-500 flex flex-wrap gap-x-3 gap-y-0.5 pt-1 border-t border-slate-100">
            {club.teacher_name && <span>지도교사 {club.teacher_name}</span>}
            {club.mentor_name && <span>멘토 {club.mentor_name}</span>}
            {club.student_count != null && <span>학생 {club.student_count}명</span>}
          </div>
        </header>

        {/* 활동 등록 */}
        <ClubActivityForm clubId={club.id} programId={club.program_id} onSaved={() => void loadLogs(club.id)} />

        {/* 활동 목록 */}
        <section className="rounded-2xl border border-violet-100 bg-white p-5 shadow-card space-y-3">
          <h2 className="text-sm font-bold text-[#1E1B4B]">활동 기록 ({logs.length})</h2>
          {logs.length === 0 ? (
            <p className="text-xs text-slate-400 italic text-center py-4">아직 등록된 활동이 없어요. 위에서 첫 활동을 등록해 보세요.</p>
          ) : (
            <ul className="space-y-2">
              {logs.map((log) => (
                <li key={log.id} className="rounded-xl border border-slate-100 bg-slate-50 p-3 space-y-1">
                  <div className="flex items-center gap-2 flex-wrap">
                    <span className="text-sm font-bold text-[#1E1B4B]">{log.title}</span>
                    <span className="text-[11px] text-slate-500 inline-flex items-center gap-1">
                      <CalendarDays size={11} aria-hidden="true" /> {log.activity_date}
                    </span>
                  </div>
                  {log.content && <p className="text-xs text-slate-600 whitespace-pre-wrap">{log.content}</p>}
                  {log.outcome && (
                    <p className="text-xs text-emerald-700 bg-emerald-50 rounded px-2 py-1">성과 · {log.outcome}</p>
                  )}
                </li>
              ))}
            </ul>
          )}
        </section>

        <footer className="text-center pt-2 pb-1">
          <p className="text-[10px] text-slate-400">© 2026 BalanceDot WorkFlow · 동아리 활동 페이지</p>
        </footer>
      </div>
    </div>
  );
}

/** 동아리 활동 등록 폼 — activity_logs 에 club_id 와 함께 INSERT */
function ClubActivityForm({ clubId, programId, onSaved }: { clubId: string; programId: string; onSaved: () => void }) {
  const [open, setOpen] = useState(false);
  const [title, setTitle] = useState('');
  const [date, setDate] = useState('');
  const [content, setContent] = useState('');
  const [outcome, setOutcome] = useState('');
  const [saving, setSaving] = useState(false);
  const [done, setDone] = useState(false);
  const [err, setErr] = useState<string | null>(null);

  async function handleSubmit() {
    setErr(null);
    if (!title.trim()) { setErr('활동 제목을 입력해 주세요.'); return; }
    if (!date) { setErr('활동 날짜를 선택해 주세요.'); return; }
    setSaving(true);
    const { error } = await supabase.from('activity_logs').insert({
      club_id: clubId,
      program_id: programId,
      log_type: 'club',
      title: title.trim(),
      activity_date: date,
      content: content.trim() || null,
      outcome: outcome.trim() || null,
    });
    setSaving(false);
    if (error) {
      console.error('[ClubActivityForm] INSERT 실패:', error.message);
      setErr('등록에 실패했어요. 잠시 후 다시 시도해 주세요.');
      return;
    }
    setTitle(''); setDate(''); setContent(''); setOutcome('');
    setDone(true);
    setTimeout(() => setDone(false), 2000);
    setOpen(false);
    onSaved();
  }

  if (!open) {
    return (
      <button type="button" onClick={() => setOpen(true)}
        className="w-full inline-flex items-center justify-center gap-1.5 h-11 rounded-2xl bg-violet-600 text-white font-bold hover:bg-violet-700">
        {done ? <><CheckCircle2 size={16} aria-hidden="true" /> 등록 완료</> : <><Plus size={16} aria-hidden="true" /> 활동 등록하기</>}
      </button>
    );
  }

  return (
    <section className="rounded-2xl border border-violet-200 bg-white p-5 shadow-card space-y-3">
      <h2 className="text-sm font-bold text-[#1E1B4B]">새 활동 등록</h2>
      <div className="space-y-2">
        <input type="text" value={title} onChange={(e) => setTitle(e.target.value)}
          placeholder="활동 제목 (예: 1차 멘토링 — 아이디어 발굴)"
          className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
        <input type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="w-full h-10 rounded-lg border border-slate-200 px-3 text-sm outline-none focus:border-violet-500" />
        <textarea value={content} onChange={(e) => setContent(e.target.value)} rows={3}
          placeholder="활동 내용"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none outline-none focus:border-violet-500" />
        <textarea value={outcome} onChange={(e) => setOutcome(e.target.value)} rows={2}
          placeholder="성과·결과물 (선택)"
          className="w-full rounded-lg border border-slate-200 px-3 py-2 text-sm resize-none outline-none focus:border-violet-500" />
        {err && <p role="alert" className="text-xs text-rose-700 bg-rose-50 border border-rose-200 rounded-lg px-3 py-2">{err}</p>}
        <div className="flex items-center justify-end gap-2">
          <button type="button" onClick={() => setOpen(false)} className="px-4 h-10 rounded-lg text-sm text-slate-600 hover:bg-slate-100">취소</button>
          <button type="button" onClick={() => void handleSubmit()} disabled={saving}
            className="inline-flex items-center gap-1.5 px-4 h-10 rounded-lg bg-violet-600 text-white text-sm font-bold hover:bg-violet-700 disabled:opacity-50">
            {saving && <Loader2 size={14} className="animate-spin" aria-hidden="true" />}
            등록
          </button>
        </div>
      </div>
    </section>
  );
}
