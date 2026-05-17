// bal24 v2 — STEP-MENTOR-PORTAL-FULL
// /mentor-invite/:token 외부 멘토 포털 (비로그인 token 기반 접근)

import { useCallback, useEffect, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, Sparkles } from 'lucide-react';
import { supabase } from '../../lib/supabase';
import { useToast } from '../../contexts/ToastContext';
import MentorPortalInfo from './MentorPortalInfo';
import MentorPortalLogs from './MentorPortalLogs';
import type { MentoringAssignment } from '../../types/mentoring';

interface ProgramLite {
  id: string;
  name: string;
  client?: { id: string; name: string } | null;
}

interface MenteeLite {
  id: string;
  name: string;
  organization: string | null;
}

interface AssignmentJoin extends MentoringAssignment {
  program?: ProgramLite | ProgramLite[] | null;
}

function pickOne<T>(v: T | T[] | null | undefined): T | null {
  if (Array.isArray(v)) return v[0] ?? null;
  return v ?? null;
}

export default function MentorPortalPage() {
  const { token } = useParams<{ token: string }>();
  const toast = useToast();
  const [loading, setLoading] = useState(true);
  const [assignment, setAssignment] = useState<MentoringAssignment | null>(null);
  const [program, setProgram] = useState<ProgramLite | null>(null);
  const [mentees, setMentees] = useState<MenteeLite[]>([]);
  const [invalidLink, setInvalidLink] = useState(false);

  const refresh = useCallback(async () => {
    if (!token) { setInvalidLink(true); setLoading(false); return; }
    setLoading(true);
    // 토큰으로 배정 정보 + 프로그램·고객사 조회
    const { data, error } = await supabase
      .from('mentoring_assignments')
      .select('*, program:programs(id, name, client:clients(id, name))')
      .eq('mentor_invite_token', token)
      .maybeSingle();
    if (error) {
      const msg = (error.message ?? '').toLowerCase();
      if (msg.includes('does not exist') || msg.includes('pgrst205') || msg.includes('mentor_invite_token')) {
        // 컬럼 미적용 환경 — 안내만 표시
        console.warn('[mentor-portal] mentor_invite_token 컬럼 미적용:', error.message);
        setInvalidLink(true); setLoading(false); return;
      }
      console.error('[mentor-portal] 배정 조회 실패:', error.message);
      toast.error('배정 정보를 불러오지 못했어요.');
      setInvalidLink(true); setLoading(false); return;
    }
    if (!data) { setInvalidLink(true); setLoading(false); return; }
    const join = data as AssignmentJoin;
    setAssignment(join);
    setProgram(pickOne(join.program));
    // 멘티 정보 fetch (program_participants 기준)
    if (join.mentee_ids && join.mentee_ids.length > 0) {
      const { data: mRows, error: mErr } = await supabase.from('program_participants')
        .select('id, name, organization').in('id', join.mentee_ids);
      if (mErr) console.warn('[mentor-portal] 멘티 조회 경고:', mErr.message);
      else setMentees((mRows ?? []) as MenteeLite[]);
    } else {
      setMentees([]);
    }
    setLoading(false);
  }, [token, toast]);

  useEffect(() => { void refresh(); }, [refresh]);

  if (loading) {
    return (
      <div className="min-h-screen flex items-center justify-center bg-slate-50">
        <Loader2 size={28} className="animate-spin text-violet-500" aria-hidden="true" />
      </div>
    );
  }

  if (invalidLink || !assignment) {
    return (
      <div className="min-h-screen flex flex-col items-center justify-center bg-slate-50 p-4">
        <div className="max-w-md w-full bg-white rounded-2xl border border-rose-100 shadow p-6 text-center space-y-2">
          <p className="text-base font-bold text-rose-600">유효하지 않은 링크예요.</p>
          <p className="text-sm text-slate-500">PM에게 새 초대 링크를 요청해 주세요.</p>
        </div>
      </div>
    );
  }

  return (
    <div className="min-h-screen bg-slate-50 pb-12">
      <header className="bg-white border-b border-violet-100 px-4 py-4">
        <div className="max-w-3xl mx-auto flex items-center gap-2">
          <span className="inline-flex items-center justify-center w-9 h-9 rounded-lg bg-violet-100 text-violet-600">
            <Sparkles size={16} aria-hidden="true" />
          </span>
          <div className="min-w-0">
            <p className="text-sm font-bold text-[#1E1B4B] truncate">WorkFlow · 멘토 포털</p>
            {program && (
              <p className="text-[11px] text-slate-500 truncate">
                {program.name}
                {program.client?.name && <span className="ml-1">· {program.client.name}</span>}
              </p>
            )}
          </div>
        </div>
      </header>

      <main className="max-w-3xl mx-auto px-4 py-6 space-y-5">
        <MentorPortalInfo assignment={assignment} mentees={mentees} onUpdated={() => void refresh()} />
        <MentorPortalLogs assignment={assignment} mentees={mentees} />
      </main>
    </div>
  );
}
