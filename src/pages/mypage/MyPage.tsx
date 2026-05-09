// bal24 v2 — STEP-MYPAGE 메인
// /my/:token 참여자 마이페이지. 환영 배너 + 요약 카드 4 + 탭 2개.
// 입장코드 분기: 사용자의 참여 프로그램 중 entry_code 가 있는 게 있으면 게이트 표시.
// sessionStorage 인증 플래그 — STEP-MYPAGE 한정 허용.

import { useEffect, useMemo, useState } from 'react';
import { useParams } from 'react-router-dom';
import { Loader2, ShieldAlert } from 'lucide-react';
import EmptyState from '../../components/EmptyState';
import { Card, CardContent } from '../../components/ui';
import { usePMViewer } from '../../hooks/usePMViewer';
import PMViewerBanner from '../../components/PMViewerBanner';
import {
  fetchMyProfile, fetchMyPrograms, fetchMyMentorings, countPendingFeedback,
} from './myPageUtils';
import type {
  MyPageProfile, MyPageProgram, MyPageMentoring, MyPageStats,
} from '../../types/mypage';
import MyEntryCodeGate from './MyEntryCodeGate';
import MyProgramCard from './MyProgramCard';
import MyMentoringCard from './MyMentoringCard';

type TabKey = 'programs' | 'mentoring';

interface StatCardProps {
  label: string;
  value: number;
  unit: string;
  emoji: string;
}

function StatCard({ label, value, unit, emoji }: StatCardProps) {
  return (
    <Card className="h-full">
      <CardContent className="p-4 text-center space-y-1">
        <div className="text-xl" aria-hidden="true">{emoji}</div>
        <p className="text-[11px] font-semibold text-slate-500">{label}</p>
        <p className="text-xl font-bold text-[#1E1B4B] tabular-nums">
          {value}<span className="text-sm font-semibold text-slate-400 ml-0.5">{unit}</span>
        </p>
      </CardContent>
    </Card>
  );
}

export default function MyPage() {
  const { token } = useParams<{ token: string }>();
  const { isViewer, viewerName } = usePMViewer();
  const [loading, setLoading] = useState(true);
  const [profile, setProfile] = useState<MyPageProfile | null>(null);
  const [programs, setPrograms] = useState<MyPageProgram[]>([]);
  const [mentorings, setMentorings] = useState<MyPageMentoring[]>([]);
  const [pendingFeedback, setPendingFeedback] = useState(0);
  const [tab, setTab] = useState<TabKey>('programs');
  const [authed, setAuthed] = useState(false);

  // 1) 프로필 + 데이터 fetch
  useEffect(() => {
    if (!token) {
      setLoading(false);
      return;
    }
    let cancelled = false;
    setLoading(true);
    void (async () => {
      const p = await fetchMyProfile(token);
      if (cancelled) return;
      if (!p) {
        setProfile(null);
        setLoading(false);
        return;
      }
      setProfile(p);
      const [pgs, mts, pending] = await Promise.all([
        fetchMyPrograms(p.id, p.email, p.consortium_member_id),
        fetchMyMentorings(p.id),
        countPendingFeedback(p.id, p.name),
      ]);
      if (cancelled) return;
      setPrograms(pgs);
      setMentorings(mts);
      setPendingFeedback(pending);
      setLoading(false);
    })();
    return () => { cancelled = true; };
  }, [token]);

  // 2) 입장코드 게이트 — sessionStorage 인증 플래그 (STEP-MYPAGE 한정 허용)
  const validCodes = useMemo(
    () => programs.map((p) => p.entry_code).filter((c): c is string => !!c),
    [programs],
  );
  const needsCode = validCodes.length > 0;

  useEffect(() => {
    if (!token || !needsCode) {
      setAuthed(true);
      return;
    }
    try {
      const stored = sessionStorage.getItem(`mypage_auth_${token}`) === 'true';
      setAuthed(stored);
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[mypage] sessionStorage 읽기 실패:', raw);
      setAuthed(false);
    }
  }, [token, needsCode]);

  const handleGateSuccess = () => {
    if (!token) return;
    try {
      sessionStorage.setItem(`mypage_auth_${token}`, 'true');
    } catch (err) {
      const raw = err instanceof Error ? err.message : '';
      console.error('[mypage] sessionStorage 쓰기 실패:', raw);
    }
    setAuthed(true);
  };

  // 3) 통계
  const stats: MyPageStats = useMemo(() => ({
    programCount: programs.length,
    mentoringCount: mentorings.length,
    completedSessionCount: mentorings.reduce((sum, m) => sum + m.completed_count, 0),
    pendingFeedbackCount: pendingFeedback,
  }), [programs, mentorings, pendingFeedback]);

  // 4) 화면 분기 (모든 훅 호출 완료 후)
  if (loading) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center">
        <Loader2 size={28} className="animate-spin text-violet-400" aria-hidden="true" />
      </div>
    );
  }

  if (!profile) {
    return (
      <div className="min-h-screen bg-bg flex items-center justify-center px-4">
        <div className="bg-white rounded-2xl border border-rose-100 p-8 max-w-md w-full text-center space-y-3">
          <ShieldAlert className="mx-auto text-rose-400" size={32} aria-hidden="true" />
          <p className="text-base font-bold text-[#1E1B4B]">유효하지 않은 링크예요</p>
          <p className="text-sm text-slate-500">링크를 다시 확인해 주세요.</p>
        </div>
      </div>
    );
  }

  if (needsCode && !authed) {
    return (
      <MyEntryCodeGate
        validCodes={validCodes}
        programName={programs[0]?.name}
        onSuccess={handleGateSuccess}
      />
    );
  }

  return (
    <div className="min-h-screen bg-gradient-to-b from-violet-50/40 to-orange-50/30">
      {isViewer && <PMViewerBanner viewerName={viewerName} />}
      <div className="max-w-3xl mx-auto px-4 py-6 sm:py-10 space-y-5">
        {/* 환영 배너 */}
        <header className="rounded-2xl bg-gradient-to-br from-violet-600 to-violet-500 text-white p-5 shadow-[0_4px_16px_rgba(124,58,237,0.18)]">
          <p className="text-xs font-semibold opacity-80">My Page</p>
          <h1 className="mt-1 text-xl font-bold">
            안녕하세요, {profile.name}님! <span aria-hidden="true">👋</span>
          </h1>
          <p className="mt-1 text-xs opacity-90">
            WorkFlow 에서 참여 현황을 한눈에 확인하세요.
          </p>
        </header>

        {/* 요약 카드 4 */}
        <ul className="grid grid-cols-2 sm:grid-cols-4 gap-3">
          <li><StatCard label="참여 프로그램" value={stats.programCount} unit="개" emoji="📚" /></li>
          <li><StatCard label="멘토링 배정" value={stats.mentoringCount} unit="개" emoji="🤝" /></li>
          <li><StatCard label="완료 세션" value={stats.completedSessionCount} unit="회" emoji="✅" /></li>
          <li><StatCard label="미제출 피드백" value={stats.pendingFeedbackCount} unit="건" emoji="📝" /></li>
        </ul>

        {/* 탭 */}
        <nav role="tablist" aria-label="마이페이지 탭" className="flex items-center gap-1 border-b border-slate-200">
          {([
            ['programs', `참여 프로그램 (${stats.programCount})`],
            ['mentoring', `멘토링 (${stats.mentoringCount})`],
          ] as const).map(([key, label]) => {
            const active = tab === key;
            return (
              <button
                key={key}
                type="button"
                role="tab"
                aria-selected={active}
                onClick={() => setTab(key)}
                className={[
                  'px-4 py-2.5 text-sm font-semibold border-b-2 transition-colors whitespace-nowrap',
                  active
                    ? 'text-violet-700 border-violet-600'
                    : 'text-slate-500 border-transparent hover:text-[#1E1B4B]',
                ].join(' ')}
              >
                {label}
              </button>
            );
          })}
        </nav>

        {/* 본문 */}
        <div role="tabpanel">
          {tab === 'programs' && (
            programs.length === 0 ? (
              <EmptyState
                emoji="📚"
                title="참여 중인 프로그램이 없어요"
                description="담당자가 배정하면 여기에 표시돼요."
              />
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {programs.map((p) => (
                  <li key={p.id}><MyProgramCard program={p} /></li>
                ))}
              </ul>
            )
          )}

          {tab === 'mentoring' && (
            mentorings.length === 0 ? (
              <EmptyState
                emoji="🤝"
                title="아직 배정된 멘토링이 없어요"
                description="멘토 또는 멘티로 배정되면 여기에 표시돼요."
              />
            ) : (
              <ul className="grid grid-cols-1 sm:grid-cols-2 gap-3">
                {mentorings.map((m) => (
                  <li key={`${m.id}-${m.role}`}>
                    <MyMentoringCard mentoring={m} myToken={profile.my_token} />
                  </li>
                ))}
              </ul>
            )
          )}
        </div>

        <p className="text-center text-[10px] text-slate-400 pt-2">© 2026 (주)밸런스닷 · WorkFlow</p>
      </div>
    </div>
  );
}
