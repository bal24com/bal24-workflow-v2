// 박경수님 2026-06-02 CLUB-7 — 동아리 차수별 멘토링 일정 공용 컴포넌트.
// 박경수님 2026-06-08 CLUB-C — 차수별 복수 멘토 배정 UI 추가.
// PM·외부(팀·교사·멘토) 양쪽에서 사용. 누구나 날짜·시간 수정, 확정은 PM·담당 선생님만.

import { useCallback, useEffect, useState } from 'react';
import { Loader2, Plus, CalendarDays, CheckCircle2, Trash2, UserCog, X } from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import type { ProgramClubSession, ClubSessionStatus, MentorRef } from '../../../../types/database';

interface Props {
  clubId: string;
  canEdit: boolean;
  canConfirm?: boolean;
  decidedByLabel?: string;
}

const STATUS_BADGE: Record<ClubSessionStatus, { label: string; cls: string }> = {
  wish:      { label: '미확정', cls: 'bg-amber-100 text-amber-700' },
  confirmed: { label: '확정',   cls: 'bg-violet-100 text-violet-700' },
  done:      { label: '완료',   cls: 'bg-emerald-100 text-emerald-700' },
};

export default function ClubSessionSchedule({ clubId, canEdit, canConfirm = false, decidedByLabel }: Props) {
  const toast = useToast();
  const [sessions, setSessions] = useState<ProgramClubSession[]>([]);
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  // 박경수님 2026-06-08 CLUB-C — 차수별 멘토 입력 값 관리
  const [mentorInput, setMentorInput] = useState<Record<string, string>>({});

  const reload = useCallback(async () => {
    setLoading(true);
    const { data, error } = await supabase
      .from('program_club_sessions')
      .select('*')
      .eq('club_id', clubId)
      .order('session_no');
    if (error) {
      console.error('[ClubSessionSchedule] 조회 실패:', error.message);
      setSessions([]); setLoading(false); return;
    }
    setSessions((data ?? []) as ProgramClubSession[]);
    setLoading(false);
  }, [clubId]);

  useEffect(() => { void reload(); }, [reload]);

  async function addSession() {
    const nextNo = sessions.length > 0 ? Math.max(...sessions.map((s) => s.session_no)) + 1 : 1;
    const { error } = await supabase.from('program_club_sessions').insert({
      club_id: clubId, session_no: nextNo, session_label: `${nextNo}차 멘토링`, status: 'wish',
    });
    if (error) { console.error('[ClubSessionSchedule] 추가:', error.message); toast.error('차수 추가 실패'); return; }
    void reload();
  }

  async function patch(id: string, fields: Partial<ProgramClubSession>) {
    setBusyId(id);
    const { error } = await supabase
      .from('program_club_sessions')
      .update({ ...fields, updated_at: new Date().toISOString() })
      .eq('id', id);
    setBusyId(null);
    if (error) { console.error('[ClubSessionSchedule] 수정:', error.message); toast.error('저장 실패'); return; }
    void reload();
  }

  async function confirmSession(s: ProgramClubSession) {
    if (!s.wish_date_1) { toast.error('날짜를 먼저 입력해 주세요.'); return; }
    await patch(s.id, {
      confirmed_date: s.wish_date_1, confirmed_time: s.wish_time_1, status: 'confirmed',
      decided_by: decidedByLabel ?? '담당자',
    });
    toast.success('일정을 확정했어요.');
  }

  async function removeSession(id: string) {
    if (!window.confirm('이 차수를 삭제할까요?')) return;
    const { error } = await supabase.from('program_club_sessions').delete().eq('id', id);
    if (error) { toast.error('삭제 실패'); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  // 박경수님 2026-06-08 CLUB-C — 멘토 추가
  async function addMentor(s: ProgramClubSession) {
    const name = (mentorInput[s.id] ?? '').trim();
    if (!name) return;
    const current: MentorRef[] = Array.isArray(s.mentor_names) ? s.mentor_names : [];
    if (current.some((m) => m.name === name)) {
      toast.error('이미 추가된 멘토예요.'); return;
    }
    const updated: MentorRef[] = [...current, { name, source: 'raw' }];
    await patch(s.id, { mentor_names: updated });
    setMentorInput((prev) => ({ ...prev, [s.id]: '' }));
    toast.success(`${name} 멘토를 배정했어요.`);
  }

  // 박경수님 2026-06-08 CLUB-C — 멘토 제거
  async function removeMentor(s: ProgramClubSession, idx: number) {
    const current: MentorRef[] = Array.isArray(s.mentor_names) ? s.mentor_names : [];
    const updated = current.filter((_, i) => i !== idx);
    await patch(s.id, { mentor_names: updated });
  }

  if (loading) {
    return <div className="flex justify-center py-4"><Loader2 size={16} className="animate-spin text-violet-400" aria-hidden="true" /></div>;
  }

  return (
    <div className="space-y-2">
      {sessions.length === 0 ? (
        <p className="text-xs text-slate-400 italic text-center py-3">아직 등록된 차수가 없어요.</p>
      ) : sessions.map((s) => {
        const badge = STATUS_BADGE[s.status] ?? STATUS_BADGE.wish;
        const busy = busyId === s.id;
        const mentors: MentorRef[] = Array.isArray(s.mentor_names) ? s.mentor_names : [];

        return (
          <div key={s.id} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 space-y-2">
            {/* 차수 헤더 */}
            <div className="flex items-center gap-2 flex-wrap">
              <span className="text-[10px] font-bold px-1.5 py-0.5 rounded bg-slate-200 text-slate-700">{s.session_no}차</span>
              <span className="text-sm font-bold text-[#1E1B4B] flex-1 min-w-0 truncate">{s.session_label ?? `${s.session_no}차`}</span>
              <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${badge.cls}`}>{badge.label}</span>
              {canEdit && (
                <button type="button" onClick={() => void removeSession(s.id)} className="p-1 rounded hover:bg-rose-50 text-rose-500">
                  <Trash2 size={11} aria-hidden="true" />
                </button>
              )}
            </div>

            {/* 일정 섹션 */}
            {s.status !== 'wish' && s.confirmed_date ? (
              <div className="flex items-center gap-2 text-sm text-violet-800 bg-white rounded-lg px-3 py-2 flex-wrap">
                <CheckCircle2 size={14} className="text-violet-600" aria-hidden="true" />
                <span className="font-bold">{s.confirmed_date}</span>
                {s.confirmed_time && <span>{s.confirmed_time}</span>}
                {s.decided_by && <span className="text-[11px] text-slate-500 ml-auto">{s.decided_by} 확정</span>}
                {canConfirm && (
                  <button type="button" onClick={() => void patch(s.id, { status: 'wish', confirmed_date: null, confirmed_time: null })}
                    className="text-[11px] text-slate-400 hover:text-violet-600">변경</button>
                )}
              </div>
            ) : (
              <div className="rounded-lg border border-slate-200 bg-white p-2.5 space-y-2">
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">날짜</label>
                    <input type="date" defaultValue={s.wish_date_1 ?? ''} disabled={busy}
                      onBlur={(e) => { if (e.target.value !== (s.wish_date_1 ?? '')) void patch(s.id, { wish_date_1: e.target.value || null }); }}
                      className="w-full h-9 rounded border border-slate-200 px-2 text-sm outline-none focus:border-violet-500" />
                  </div>
                  <div className="space-y-1">
                    <label className="text-[11px] font-bold text-slate-600">시간</label>
                    <input type="text" defaultValue={s.wish_time_1 ?? ''} disabled={busy}
                      placeholder="예: 13:00~15:30"
                      onBlur={(e) => { if (e.target.value !== (s.wish_time_1 ?? '')) void patch(s.id, { wish_time_1: e.target.value || null }); }}
                      className="w-full h-9 rounded border border-slate-200 px-2 text-sm outline-none focus:border-violet-500" />
                  </div>
                </div>
                {canConfirm ? (
                  <button type="button" disabled={busy || !s.wish_date_1}
                    onClick={() => void confirmSession(s)}
                    className="w-full inline-flex items-center justify-center gap-1 h-9 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700 disabled:opacity-50">
                    <CheckCircle2 size={13} aria-hidden="true" /> 이 일정으로 확정
                  </button>
                ) : (
                  <p className="text-[11px] text-amber-700 bg-amber-50 rounded-lg px-2.5 py-1.5 text-center">
                    날짜·시간을 입력해 두면 담당 선생님이 확인 후 확정해요.
                  </p>
                )}
              </div>
            )}

            {/* 박경수님 2026-06-08 CLUB-C — 차수별 멘토 배정 */}
            {canEdit && (
              <div className="rounded-lg border border-slate-100 bg-white px-2.5 py-2 space-y-1.5">
                <p className="text-[10px] font-bold text-slate-500 inline-flex items-center gap-1">
                  <UserCog size={11} aria-hidden="true" /> 이 차수 담당 멘토
                </p>
                {/* 현재 멘토 칩 */}
                {mentors.length > 0 && (
                  <div className="flex flex-wrap gap-1">
                    {mentors.map((m, idx) => (
                      <span key={idx}
                        className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[11px] font-bold">
                        {m.name}
                        <button type="button" onClick={() => void removeMentor(s, idx)}
                          className="ml-0.5 hover:text-rose-500">
                          <X size={10} aria-hidden="true" />
                        </button>
                      </span>
                    ))}
                  </div>
                )}
                {/* 멘토 추가 인풋 */}
                <div className="flex gap-1">
                  <input
                    type="text"
                    value={mentorInput[s.id] ?? ''}
                    placeholder="멘토 이름 입력"
                    onChange={(e) => setMentorInput((prev) => ({ ...prev, [s.id]: e.target.value }))}
                    onKeyDown={(e) => { if (e.key === 'Enter') void addMentor(s); }}
                    className="flex-1 h-7 px-2 rounded-lg border border-slate-200 text-xs outline-none focus:border-violet-400"
                  />
                  <button type="button" onClick={() => void addMentor(s)}
                    disabled={!(mentorInput[s.id] ?? '').trim()}
                    className="px-2 h-7 rounded-lg bg-violet-100 text-violet-700 text-[11px] font-bold hover:bg-violet-200 disabled:opacity-40 shrink-0">
                    <Plus size={11} aria-hidden="true" />
                  </button>
                </div>
              </div>
            )}

            {/* 멘토 표시 (canEdit 아닐 때 — 읽기 전용) */}
            {!canEdit && mentors.length > 0 && (
              <div className="flex flex-wrap gap-1">
                {mentors.map((m, idx) => (
                  <span key={idx}
                    className="inline-flex items-center gap-1 px-2 py-0.5 rounded-full bg-violet-100 text-violet-800 text-[11px] font-bold">
                    <UserCog size={10} aria-hidden="true" /> {m.name}
                  </span>
                ))}
              </div>
            )}

            {/* 완료 처리 */}
            {s.status === 'confirmed' && canConfirm && (
              <button type="button" onClick={() => void patch(s.id, { status: 'done' })}
                className="w-full inline-flex items-center justify-center gap-1 h-8 rounded-lg bg-emerald-50 text-emerald-700 text-xs font-bold hover:bg-emerald-100">
                <CheckCircle2 size={12} aria-hidden="true" /> 이 차수 완료 처리
              </button>
            )}
          </div>
        );
      })}

      <button type="button" onClick={() => void addSession()}
        className="w-full inline-flex items-center justify-center gap-1 h-9 rounded-lg border border-dashed border-violet-300 text-violet-700 text-xs font-bold hover:bg-violet-50">
        <Plus size={12} aria-hidden="true" /> <CalendarDays size={12} aria-hidden="true" /> 차수 추가
      </button>
    </div>
  );
}
