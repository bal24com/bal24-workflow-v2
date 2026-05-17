// bal24 v2 — 멘토링 PM 탭 (STEP-MENTORING)
// 현황 카드 4개 + 보고서 목록 테이블 (멘토 필터 + 보고서/배정 추가).

import { useCallback, useEffect, useMemo, useState } from 'react';
import { Copy, FileDown, Loader2, Plus, Users2, UserCheck, UserX, MessageSquare, ChevronDown, ChevronUp } from 'lucide-react';
import MentoringLogCard from './MentoringLogCard';
import { Button, Card, CardContent } from '../../../components/ui';
import EmptyState from '../../../components/EmptyState';
import { supabase } from '../../../lib/supabase';
import { useToast } from '../../../contexts/ToastContext';
import { copyToClipboard } from '../../../lib/clipboard';
import { formatDateKo } from '../../../lib/utils';
import {
  fetchMentoringAssignments, downloadSessionAsWord, countCompletedSessions,
} from './mentoringUtils';
import { formatDuration, getMentorName, isUnregisteredMentor } from '../../../types/mentoring';
import type {
  MentoringAssignment, MentoringSession,
} from '../../../types/mentoring';
import MentoringAssignModal from './MentoringAssignModal';
import MentoringSessionModal from './MentoringSessionModal';

interface Props {
  programId: string;
}

export default function MentoringTab({ programId }: Props) {
  const toast = useToast();
  const [assignments, setAssignments] = useState<MentoringAssignment[]>([]);
  const [feedbackCount, setFeedbackCount] = useState(0);
  const [loading, setLoading] = useState(true);
  const [filterMentor, setFilterMentor] = useState<string>('all');
  const [assignOpen, setAssignOpen] = useState(false);
  const [sessionTarget, setSessionTarget] = useState<{
    assignmentId: string;
    mentorName: string;
    session: MentoringSession | null;
  } | null>(null);
  // STEP-MENTOR-PORTAL-FULL — 카드 펼침 상태 (lazy fetch 트리거)
  const [expandedId, setExpandedId] = useState<string | null>(null);

  const refresh = useCallback(async () => {
    setLoading(true);
    const list = await fetchMentoringAssignments(programId);
    setAssignments(list);
    // 피드백 합계
    const sessionIds = list.flatMap((a) => (a.sessions ?? []).map((s) => s.id));
    if (sessionIds.length > 0) {
      const { count, error } = await supabase
        .from('mentoring_feedbacks')
        .select('id', { count: 'exact', head: true })
        .in('session_id', sessionIds);
      if (error) console.error('[mentoring] 피드백 카운트 실패:', error.message);
      else setFeedbackCount(count ?? 0);
    } else {
      setFeedbackCount(0);
    }
    setLoading(false);
  }, [programId]);

  useEffect(() => {
    let cancelled = false;
    void (async () => {
      await refresh();
      if (cancelled) return;
    })();
    return () => { cancelled = true; };
  }, [refresh]);

  const stats = useMemo(() => {
    const total = assignments.length;
    const assigned = assignments.filter((a) => a.status === '진행').length;
    const inactive = assignments.filter((a) => a.status !== '진행').length;
    return { total, assigned, inactive, feedback: feedbackCount };
  }, [assignments, feedbackCount]);

  const sessionRows = useMemo(() => {
    const rows: Array<{ a: MentoringAssignment; s: MentoringSession }> = [];
    for (const a of assignments) {
      if (filterMentor !== 'all' && a.id !== filterMentor) continue;
      for (const s of a.sessions ?? []) {
        rows.push({ a, s });
      }
    }
    return rows.sort((x, y) => y.s.session_date.localeCompare(x.s.session_date));
  }, [assignments, filterMentor]);

  async function handleCopyMentorLink(token: string, name: string) {
    const url = `${window.location.origin}/mentoring-mentor/${token}`;
    const ok = await copyToClipboard(url);
    if (ok) toast.success(`${name}님 멘토 링크 복사 완료`);
    else toast.error('링크 복사에 실패했어요.');
  }

  return (
    <div className="space-y-4">
      {/* 현황 카드 */}
      <div className="grid grid-cols-2 lg:grid-cols-4 gap-3">
        <StatCard icon={<Users2 size={16} />} label="총 멘토 수" value={`${stats.total}명`} color="violet" />
        <StatCard icon={<UserCheck size={16} />} label="배정 멘토" value={`${stats.assigned}명`} color="emerald" />
        <StatCard icon={<UserX size={16} />} label="비활성 멘토" value={`${stats.inactive}명`} color="slate" />
        <StatCard icon={<MessageSquare size={16} />} label="총 피드백" value={`${stats.feedback}건`} color="orange" />
      </div>

      {/* 보고서 목록 헤더 */}
      <div className="flex items-center justify-between gap-2 flex-wrap">
        <div className="flex items-center gap-1.5">
          <span aria-hidden="true">🤝</span>
          <h3 className="text-sm font-bold text-[#1E1B4B]">멘토링 보고서</h3>
          <span className="text-[11px] text-slate-400">({sessionRows.length}건)</span>
        </div>
        <div className="flex items-center gap-2 flex-wrap">
          <select
            value={filterMentor}
            onChange={(e) => setFilterMentor(e.target.value)}
            className="text-xs rounded-lg border border-slate-200 bg-white px-2.5 py-1.5 text-slate-700 outline-none focus:border-primary"
          >
            <option value="all">전체 멘토</option>
            {assignments.map((a) => (
              <option key={a.id} value={a.id}>{getMentorName(a)}</option>
            ))}
          </select>
          <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAssignOpen(true)}>
            멘토 배정
          </Button>
        </div>
      </div>

      {loading ? (
        <div className="flex justify-center py-12">
          <Loader2 size={20} className="animate-spin text-violet-400" aria-hidden="true" />
        </div>
      ) : assignments.length === 0 ? (
        <EmptyState
          emoji="🤝"
          title="아직 배정된 멘토가 없어요"
          description="첫 멘토를 배정해 멘토링을 시작해 보세요."
          action={
            <Button variant="primary" size="sm" leftIcon={<Plus size={14} />} onClick={() => setAssignOpen(true)}>
              멘토 배정
            </Button>
          }
        />
      ) : (
        <Card>
          <CardContent className="p-0 overflow-x-auto">
            {sessionRows.length === 0 ? (
              <p className="text-xs text-slate-400 italic text-center py-8">
                아직 작성된 보고서가 없어요. 멘토가 보고서를 작성하면 여기에 표시돼요.
              </p>
            ) : (
              <table className="w-full text-sm">
                <thead className="bg-violet-50/40 text-slate-500 text-xs">
                  <tr>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">날짜</th>
                    <th className="text-left px-3 py-2 font-semibold">팀명</th>
                    <th className="text-left px-3 py-2 font-semibold">아이템</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">유형</th>
                    <th className="text-left px-3 py-2 font-semibold whitespace-nowrap">소요</th>
                    <th className="text-left px-3 py-2 font-semibold">제목</th>
                    <th className="text-left px-3 py-2 font-semibold">멘토</th>
                    <th className="text-center px-3 py-2 font-semibold whitespace-nowrap">Word</th>
                  </tr>
                </thead>
                <tbody className="divide-y divide-slate-100">
                  {sessionRows.map(({ a, s }) => (
                    <tr key={s.id} className="hover:bg-violet-50/40">
                      <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDateKo(s.session_date)}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[120px]">{s.team_name ?? '-'}</td>
                      <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[140px]">{s.item_name ?? '-'}</td>
                      <td className="px-3 py-2">
                        {s.meet_type ? (
                          <span className={`inline-flex text-[10px] font-semibold px-1.5 py-0.5 rounded border ${
                            s.meet_type === '대면'
                              ? 'bg-blue-50 text-blue-600 border-blue-200'
                              : 'bg-emerald-50 text-emerald-600 border-emerald-200'
                          }`}>{s.meet_type}</span>
                        ) : <span className="text-slate-400">-</span>}
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-600 tabular-nums whitespace-nowrap">
                        {formatDuration(s.duration_min)}
                      </td>
                      <td className="px-3 py-2">
                        <button
                          type="button"
                          onClick={() => setSessionTarget({ assignmentId: a.id, mentorName: getMentorName(a), session: s })}
                          className="text-xs font-semibold text-violet-700 hover:underline truncate max-w-[200px] text-left"
                        >
                          {s.title}
                        </button>
                      </td>
                      <td className="px-3 py-2 text-xs text-slate-700 truncate max-w-[100px]">{getMentorName(a)}</td>
                      <td className="px-3 py-2 text-center">
                        <button
                          type="button"
                          onClick={() => downloadSessionAsWord(s, getMentorName(a))}
                          className="inline-flex items-center justify-center w-7 h-7 rounded-md text-slate-500 hover:bg-violet-50 hover:text-violet-700"
                          aria-label="Word 다운로드"
                        >
                          <FileDown size={12} aria-hidden="true" />
                        </button>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            )}
          </CardContent>
        </Card>
      )}

      {/* 멘토 카드 (배정 + 토큰 복사 + 보고서 추가) */}
      {assignments.length > 0 && (
        <Card>
          <CardContent className="p-3 space-y-2">
            <p className="text-[11px] font-bold text-slate-500 uppercase tracking-wider">배정된 멘토 ({assignments.length})</p>
            <ul className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {assignments.map((a) => {
                const completed = countCompletedSessions(a.sessions);
                const planned = a.session_count ?? 0;
                const menteeCount = a.mentee_ids?.length ?? 0;
                const unregistered = isUnregisteredMentor(a);
                return (
                  <li key={a.id} className="rounded-xl border border-violet-100 bg-violet-50/30 p-3 flex flex-col gap-1.5">
                    <div className="flex items-center justify-between">
                      <span className="text-sm font-bold text-[#1E1B4B] truncate inline-flex items-center gap-1">
                        {getMentorName(a)}
                        {/* STEP-MENTORING-FULL — 미등록 멘토 표시 */}
                        {unregistered && (
                          <span className="text-[9px] font-bold text-rose-700 bg-rose-50 border border-rose-200 rounded px-1 py-0.5">미등록</span>
                        )}
                      </span>
                      <span className="text-[10px] text-slate-500 shrink-0">{a.meet_type ?? '-'} · {a.pay_type ?? '-'}</span>
                    </div>
                    {/* STEP-MENTORING-FULL — 담당 멘티 수 + 미등록 멘토 초대 링크 */}
                    <div className="flex items-center justify-between text-[10px]">
                      <span className="text-slate-500">
                        담당 멘티 <strong className="text-slate-700 tabular-nums">{menteeCount}</strong>명
                        {menteeCount === 0 && <span className="ml-1 text-slate-400 italic">(미지정)</span>}
                      </span>
                      {unregistered && a.mentor_invite_token && (
                        <button type="button"
                          onClick={() => void copyToClipboard(`${window.location.origin}/mentor-invite/${a.mentor_invite_token}`)
                            .then((ok) => toast.success(ok ? '초대 링크 복사됨' : '복사 실패'))}
                          className="text-violet-600 hover:underline font-semibold">
                          초대 링크 복사
                        </button>
                      )}
                    </div>
                    <div className="flex items-center justify-between text-[11px] text-slate-500">
                      <span>완료 {completed}/{planned}회 · 원천 {a.tax_type}</span>
                      <div className="flex items-center gap-1">
                        <button
                          type="button"
                          onClick={() => void handleCopyMentorLink(a.mentor_access_token, getMentorName(a))}
                          title="멘토 링크 복사"
                          className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:bg-violet-100 hover:text-violet-700"
                        >
                          <Copy size={11} aria-hidden="true" />
                        </button>
                        <button
                          type="button"
                          onClick={() => setSessionTarget({ assignmentId: a.id, mentorName: getMentorName(a), session: null })}
                          className="text-[10px] font-semibold text-violet-700 hover:underline"
                        >
                          보고서 추가
                        </button>
                        {/* STEP-MENTOR-PORTAL-FULL — 펼침 토글 */}
                        <button type="button"
                          onClick={() => setExpandedId(expandedId === a.id ? null : a.id)}
                          aria-label={expandedId === a.id ? '접기' : '펼치기'}
                          className="inline-flex items-center justify-center w-6 h-6 rounded text-slate-500 hover:bg-violet-100 hover:text-violet-700">
                          {expandedId === a.id ? <ChevronUp size={11} /> : <ChevronDown size={11} />}
                        </button>
                      </div>
                    </div>
                    {/* STEP-MENTOR-PORTAL-FULL — 펼친 영역 (멘티 + 최근 일지 3건) */}
                    {expandedId === a.id && (
                      <MentoringLogCard assignmentId={a.id} menteeIds={a.mentee_ids ?? []} />
                    )}
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      )}

      <MentoringAssignModal
        open={assignOpen}
        programId={programId}
        onClose={() => setAssignOpen(false)}
        onSaved={() => void refresh()}
      />

      {sessionTarget && (
        <MentoringSessionModal
          open={!!sessionTarget}
          assignmentId={sessionTarget.assignmentId}
          mentorName={sessionTarget.mentorName}
          session={sessionTarget.session}
          onClose={() => setSessionTarget(null)}
          onSaved={() => void refresh()}
        />
      )}
    </div>
  );
}

interface StatCardProps {
  icon: React.ReactNode;
  label: string;
  value: string;
  color: 'violet' | 'emerald' | 'slate' | 'orange';
}

function StatCard({ icon, label, value, color }: StatCardProps) {
  const colorMap: Record<StatCardProps['color'], string> = {
    violet:  'bg-violet-50 text-violet-700 border-violet-100',
    emerald: 'bg-emerald-50 text-emerald-700 border-emerald-100',
    slate:   'bg-slate-50 text-slate-700 border-slate-100',
    orange:  'bg-orange-50 text-orange-700 border-orange-100',
  };
  return (
    <div className={`rounded-2xl border p-3 ${colorMap[color]}`}>
      <div className="flex items-center gap-1.5 text-[11px] font-semibold opacity-80">
        {icon}
        {label}
      </div>
      <p className="mt-1 text-xl font-bold tabular-nums">{value}</p>
    </div>
  );
}
