// 박경수님 2026-06-02 CLUB-2 — 동아리(팀) 운영 관리 탭.
// 캡쳐 표2 데이터 등록·관리 + 동아리별 외부 링크 + 학교별 그룹 + 활동 현황.

import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Loader2, Upload, Copy, Trash2, ExternalLink, School, Users, CalendarDays, ChevronDown, ChevronUp, List, LayoutGrid, UserCog,
} from 'lucide-react';
import { supabase } from '../../../../lib/supabase';
import { useToast } from '../../../../contexts/ToastContext';
import { copyToClipboard } from '../../../../lib/clipboard';
import type { ProgramClub } from '../../../../types/database';
import ClubBulkModal from './ClubBulkModal';
import ClubSessionSchedule from './ClubSessionSchedule';
import ClubCardGrid from './ClubCardGrid';
import ClubMentorSummary from './ClubMentorSummary';

interface Props {
  programId: string;
}

interface ClubWithActivity extends ProgramClub {
  activity_count: number;
}

const TYPE_TONE: Record<string, string> = {
  창업: 'bg-violet-100 text-violet-700',
  융합: 'bg-cyan-100 text-cyan-700',
};

export default function ClubManageTab({ programId }: Props) {
  const toast = useToast();
  const [clubs, setClubs] = useState<ClubWithActivity[]>([]);
  const [loading, setLoading] = useState(true);
  const [bulkOpen, setBulkOpen] = useState(false);
  // 박경수님 2026-06-02 CLUB-7a — 차수 일정 펼친 동아리 id
  const [scheduleOpen, setScheduleOpen] = useState<string | null>(null);
  // 박경수님 2026-06-02 CLUB-8/9 — 리스트 / 카드 / 멘토별 보기 토글
  const [view, setView] = useState<'list' | 'card' | 'mentor'>('list');

  const reload = useCallback(async () => {
    setLoading(true);
    const cRes = await supabase
      .from('program_clubs')
      .select('*')
      .eq('program_id', programId)
      .order('school_name');
    if (cRes.error) {
      console.error('[ClubManageTab] 동아리 조회 실패:', cRes.error.message);
      const m = cRes.error.message.toLowerCase();
      if (m.includes('could not find the table') || m.includes('pgrst205')) {
        toast.error('동아리 테이블이 아직 적용되지 않았어요. SQL을 먼저 실행해 주세요.');
      } else {
        toast.error('동아리를 불러오지 못했어요.');
      }
      setClubs([]); setLoading(false); return;
    }
    const list = (cRes.data ?? []) as ProgramClub[];

    // 활동일지 개수 (club_id 기준)
    const counts = new Map<string, number>();
    if (list.length > 0) {
      const aRes = await supabase
        .from('activity_logs')
        .select('club_id')
        .in('club_id', list.map((c) => c.id))
        .is('deleted_at', null);
      if (!aRes.error) {
        (aRes.data ?? []).forEach((r) => {
          const cid = (r as { club_id: string | null }).club_id;
          if (cid) counts.set(cid, (counts.get(cid) ?? 0) + 1);
        });
      }
    }
    setClubs(list.map((c) => ({ ...c, activity_count: counts.get(c.id) ?? 0 })));
    setLoading(false);
  }, [programId, toast]);

  useEffect(() => { void reload(); }, [reload]);

  // 학교별 그룹핑
  const bySchool = useMemo(() => {
    const map = new Map<string, ClubWithActivity[]>();
    clubs.forEach((c) => {
      const arr = map.get(c.school_name) ?? [];
      arr.push(c);
      map.set(c.school_name, arr);
    });
    return Array.from(map.entries());
  }, [clubs]);

  async function copyClubLink(club: ProgramClub) {
    const url = `${window.location.origin}/share/club/${club.club_token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${club.club_name} 동아리 링크를 복사했어요.`);
    else toast.error('링크 복사에 실패했어요.');
  }

  async function handleDelete(club: ProgramClub) {
    if (!window.confirm(`"${club.club_name}" 동아리를 삭제할까요? 활동 기록도 함께 사라져요.`)) return;
    const { error } = await supabase.from('program_clubs').delete().eq('id', club.id);
    if (error) { console.error('[ClubManageTab] 삭제:', error.message); toast.error('삭제 실패'); return; }
    toast.success('삭제했어요.');
    void reload();
  }

  const totalStudents = clubs.reduce((s, c) => s + (c.student_count ?? 0), 0);

  return (
    <div className="space-y-4">
      <header className="flex items-center justify-between gap-2 flex-wrap">
        <div>
          <h2 className="text-base font-bold text-[#1E1B4B] inline-flex items-center gap-1.5">
            <Users size={18} className="text-violet-600" aria-hidden="true" />
            동아리 운영 ({clubs.length})
          </h2>
          <p className="text-[11px] text-slate-500 mt-0.5">
            {bySchool.length}개 학교 · {clubs.length}개 팀 · 학생 {totalStudents}명
          </p>
        </div>
        <div className="flex items-center gap-2">
          {/* 박경수님 2026-06-02 CLUB-8 — 보기 토글 */}
          <div className="inline-flex items-center bg-slate-100 rounded-lg p-0.5">
            <button type="button" onClick={() => setView('list')}
              className={`p-1.5 rounded-md ${view === 'list' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-400'}`}
              title="목록 보기"><List size={14} aria-hidden="true" /></button>
            <button type="button" onClick={() => setView('card')}
              className={`p-1.5 rounded-md ${view === 'card' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-400'}`}
              title="카드 보기"><LayoutGrid size={14} aria-hidden="true" /></button>
            <button type="button" onClick={() => setView('mentor')}
              className={`p-1.5 rounded-md ${view === 'mentor' ? 'bg-white shadow-sm text-violet-700' : 'text-slate-400'}`}
              title="멘토별 보기"><UserCog size={14} aria-hidden="true" /></button>
          </div>
          <button type="button" onClick={() => setBulkOpen(true)}
            className="inline-flex items-center gap-1 px-3 h-9 rounded-lg bg-violet-600 text-white text-xs font-bold hover:bg-violet-700">
            <Upload size={13} aria-hidden="true" /> 엑셀 일괄 등록
          </button>
        </div>
      </header>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : clubs.length === 0 ? (
        <div className="rounded-2xl border border-violet-100 bg-violet-50/30 p-8 text-center">
          <Users size={28} className="mx-auto text-violet-300 mb-2" aria-hidden="true" />
          <p className="text-sm text-slate-500 mb-1">아직 등록된 동아리가 없어요.</p>
          <p className="text-xs text-slate-400">[엑셀 일괄 등록] 으로 학교별 동아리를 한 번에 등록하세요.</p>
        </div>
      ) : view === 'card' ? (
        <ClubCardGrid
          bySchool={bySchool}
          onCopyLink={(c) => void copyClubLink(c)}
          onDelete={(c) => void handleDelete(c)}
          onSchedule={(id) => { setView('list'); setScheduleOpen(id); }}
        />
      ) : view === 'mentor' ? (
        <ClubMentorSummary
          clubs={clubs}
          onSchedule={(id) => { setView('list'); setScheduleOpen(id); }}
        />
      ) : (
        <div className="space-y-4">
          {bySchool.map(([school, schoolClubs]) => (
            <section key={school} className="rounded-2xl border border-violet-100 bg-white overflow-hidden">
              <div className="px-4 py-2.5 bg-violet-50/50 border-b border-violet-100 flex items-center gap-2">
                <School size={14} className="text-violet-600" aria-hidden="true" />
                <span className="text-sm font-bold text-[#1E1B4B]">{school}</span>
                <span className="text-[11px] text-slate-500">· {schoolClubs.length}개 동아리</span>
              </div>
              <ul className="divide-y divide-slate-100">
                {schoolClubs.map((c) => (
                  <li key={c.id} className="p-3">
                  <div className="flex items-start gap-3 flex-wrap">
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5 flex-wrap">
                        <span className="text-sm font-bold text-[#1E1B4B]">{c.club_name}</span>
                        {c.club_type && (
                          <span className={`text-[10px] font-bold px-1.5 py-0.5 rounded ${TYPE_TONE[c.club_type] ?? 'bg-slate-100 text-slate-600'}`}>
                            {c.club_type}
                          </span>
                        )}
                        <span className="text-[10px] text-slate-500">활동 <strong className="text-violet-700">{c.activity_count}</strong>건</span>
                      </div>
                      <div className="text-[11px] text-slate-500 mt-0.5 flex flex-wrap gap-x-3 gap-y-0.5">
                        {c.teacher_name && <span>지도 {c.teacher_name}{c.teacher_phone ? ` (${c.teacher_phone})` : ''}</span>}
                        {c.mentor_name && <span>멘토 {c.mentor_name}{c.mentor_phone ? ` (${c.mentor_phone})` : ''}</span>}
                        {c.student_count != null && <span>학생 {c.student_count}명</span>}
                        {c.operating_budget != null && <span>운영비 {c.operating_budget}천원</span>}
                      </div>
                      {c.operating_method && (
                        <p className="text-[11px] text-slate-400 mt-0.5 truncate">{c.operating_method}</p>
                      )}
                    </div>
                    <div className="flex items-center gap-1 shrink-0">
                      <button type="button" onClick={() => setScheduleOpen(scheduleOpen === c.id ? null : c.id)}
                        title="멘토링 일정" className="p-1.5 rounded hover:bg-violet-50 text-violet-700 inline-flex items-center gap-0.5">
                        <CalendarDays size={13} aria-hidden="true" />
                        {scheduleOpen === c.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                      </button>
                      <button type="button" onClick={() => void copyClubLink(c)}
                        title="동아리 링크 복사" className="p-1.5 rounded hover:bg-violet-50 text-violet-700">
                        <Copy size={13} aria-hidden="true" />
                      </button>
                      <a href={`${window.location.origin}/share/club/${c.club_token}`} target="_blank" rel="noreferrer"
                        title="동아리 페이지 열기" className="p-1.5 rounded hover:bg-violet-50 text-violet-700">
                        <ExternalLink size={13} aria-hidden="true" />
                      </a>
                      <button type="button" onClick={() => void handleDelete(c)}
                        title="삭제" className="p-1.5 rounded hover:bg-rose-50 text-rose-500">
                        <Trash2 size={13} aria-hidden="true" />
                      </button>
                    </div>
                  </div>
                  {/* 박경수님 2026-06-02 CLUB-7a — 차수 멘토링 일정 펼침 */}
                  {scheduleOpen === c.id && (
                    <div className="mt-3 pt-3 border-t border-slate-100">
                      <p className="text-[11px] font-bold text-violet-700 mb-2 inline-flex items-center gap-1">
                        <CalendarDays size={12} aria-hidden="true" /> 멘토링 일정 — {c.mentor_name ?? '멘토 미지정'}
                      </p>
                      <ClubSessionSchedule clubId={c.id} canEdit decidedByLabel="관리자" />
                    </div>
                  )}
                  </li>
                ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      <ClubBulkModal
        programId={programId}
        isOpen={bulkOpen}
        onClose={() => setBulkOpen(false)}
        onSuccess={() => { void reload(); }}
      />
    </div>
  );
}
