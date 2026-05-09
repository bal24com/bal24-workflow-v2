// bal24 v2 — PARTNER 로그인 멘토 본인 배정 뷰 (STEP-MENTORING)
// /mentoring 메뉴 또는 카드 진입 — 본인이 멘토로 배정된 프로그램 목록.

import { useEffect, useState } from 'react';
import { Loader2, ExternalLink, Users2 } from 'lucide-react';
import { useAuth } from '../../contexts/AuthContext';
import EmptyState from '../../components/EmptyState';
import { Card, CardContent } from '../../components/ui';
import { fetchMyMentorAssignments, countCompletedSessions } from '../programs/detail/mentoringUtils';
import { calcMentoringPay, getMentorName } from '../../types/mentoring';
import type { MentoringAssignment } from '../../types/mentoring';

interface AssignmentWithProgram extends MentoringAssignment {
  program?: { id: string; name: string; status: string } | null;
}

export default function MentoringPartnerView() {
  const { user } = useAuth();
  const [assignments, setAssignments] = useState<AssignmentWithProgram[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    if (!user) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const list = await fetchMyMentorAssignments(user.id);
      if (cancelled) return;
      setAssignments(list as AssignmentWithProgram[]);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [user]);

  if (!user) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-slate-500">로그인이 필요해요.</p>
      </div>
    );
  }

  return (
    <div className="space-y-4 max-w-[1400px]">
      <h1 className="text-2xl font-bold text-[#1E1B4B] flex items-center gap-2">
        <span aria-hidden="true">🤝</span>
        내 멘토링
      </h1>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="아직 배정된 멘토링이 없어요"
          description="담당자가 배정하면 여기에 표시돼요."
        />
      ) : (
        <ul className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 gap-3">
          {assignments.map((a) => {
            const completed = countCompletedSessions(a.sessions);
            const planned = a.session_count ?? 0;
            const pay = calcMentoringPay(a, completed);
            const link = `/mentoring-mentor/${a.mentor_access_token}`;
            return (
              <li key={a.id}>
                <Card className="h-full hover:border-violet-300 hover:shadow-md transition-all">
                  <CardContent className="p-4 space-y-3">
                    <header className="space-y-1">
                      <div className="flex items-center gap-1.5 text-[11px] text-slate-500">
                        <Users2 size={11} aria-hidden="true" />
                        {getMentorName(a)} · {a.meet_type ?? '-'}
                      </div>
                      <h3 className="text-sm font-bold text-[#1E1B4B] truncate">{a.program?.name ?? '프로그램 미연결'}</h3>
                    </header>
                    <div className="rounded-xl bg-violet-50/60 p-2.5 text-xs space-y-0.5">
                      <div className="flex justify-between text-slate-600">
                        <span>진행</span>
                        <span className="tabular-nums">{completed}/{planned}회</span>
                      </div>
                      <div className="flex justify-between text-slate-600">
                        <span>지급액</span>
                        <span className="tabular-nums">{pay.base.toLocaleString()}원</span>
                      </div>
                      <div className="flex justify-between font-semibold text-violet-700">
                        <span>예상 수령</span>
                        <span className="tabular-nums">{pay.net.toLocaleString()}원</span>
                      </div>
                    </div>
                    <a
                      href={link}
                      className="inline-flex items-center gap-1 px-3 py-1.5 rounded-xl bg-violet-600 text-white text-xs font-semibold hover:bg-violet-700 transition-colors w-full justify-center"
                    >
                      <ExternalLink size={12} aria-hidden="true" />
                      보고서 작성하기
                    </a>
                  </CardContent>
                </Card>
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
